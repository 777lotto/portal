// 777lotto/portal/portal-fold/worker/src/handlers/google.ts

import { v4 as uuidv4 } from 'uuid';
import { Context } from 'hono';
import { AppEnv } from '../index.js';
import { errorResponse, successResponse } from '../utils.js';


interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: 'Bearer';
}

interface GoogleContact {
  resourceName: string;
  names?: { displayName: string }[];
  emailAddresses?: { value: string }[];
  phoneNumbers?: { value: string }[];
  organizations?: { name: string }[];
  addresses?: { formattedValue: string }[];
}

// 1. Redirects the user to Google's consent screen
export const handleGoogleLogin = async (c: Context<AppEnv>) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = c.env;
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  // MODIFIED: Added 'contacts.other.readonly' to get all contacts
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/contacts.other.readonly');
  authUrl.searchParams.set('access_type', 'offline');
  // REMOVED: The following line forces the consent screen every time.
  // authUrl.searchParams.set('prompt', 'consent');

  return c.redirect(authUrl.toString());
};

async function fetchAllGoogleContacts(
  initialUrl: string,
  accessToken: string
): Promise<GoogleContact[]> {
  let allContacts: GoogleContact[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    const url = new URL(initialUrl);
    if (nextPageToken) {
      url.searchParams.set('pageToken', nextPageToken);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data: { connections?: GoogleContact[], otherContacts?: GoogleContact[], nextPageToken?: string } = await response.json();

    // The API returns contacts in either 'connections' or 'otherContacts'
    const contacts = data.connections || data.otherContacts || [];
    allContacts = allContacts.concat(contacts);
    nextPageToken = data.nextPageToken;

  } while (nextPageToken);

  return allContacts;
}


// 2. MODIFIED: Handles the callback, fetches ALL contacts, and returns them to the frontend
export const handleGoogleCallback = async (c: Context<AppEnv>) => {
  const { code } = c.req.query();
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, PORTAL_URL } = c.env;
  const portalRedirectUrl = new URL(PORTAL_URL);
  portalRedirectUrl.pathname = '/admin/users';

  if (!code) {
    portalRedirectUrl.searchParams.set('import_status', 'error');
    portalRedirectUrl.searchParams.set('error_message', 'No code received from Google');
    return c.redirect(portalRedirectUrl.toString());
  }

  try {
    // Exchange authorization code for an access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData: GoogleTokenResponse = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error('Failed to retrieve access token from Google.');
    }

    // --- NEW PAGINATED FETCHING LOGIC ---
    const personFields = 'names,emailAddresses,phoneNumbers,organizations,addresses';

    // Fetch primary contacts
    const connectionsUrl = `https://people.googleapis.com/v1/people/me/connections?personFields=${personFields}`;
    const primaryContacts = await fetchAllGoogleContacts(connectionsUrl, tokenData.access_token);

    // Fetch "Other" contacts
    const otherContactsUrl = `https://people.googleapis.com/v1/otherContacts?readMask=${personFields}`;
    const otherContacts = await fetchAllGoogleContacts(otherContactsUrl, tokenData.access_token);

    // Combine and deduplicate contacts based on resourceName
    const allContactsMap = new Map<string, GoogleContact>();
    [...primaryContacts, ...otherContacts].forEach(contact => {
      if (contact.resourceName) {
        allContactsMap.set(contact.resourceName, contact);
      }
    });

    const contacts = Array.from(allContactsMap.values());
    // --- END NEW LOGIC ---


    // 1. Generate a secure, random token
    const importToken = uuidv4();

    // 2. Store the contacts in KV with a 15-minute expiration (900 seconds)
    await c.env.TEMP_STORAGE.put(importToken, JSON.stringify(contacts), { expirationTtl: 900 });

    // 3. Redirect with the short token instead of the large JWT
    portalRedirectUrl.searchParams.set('import_token', importToken);
    return c.redirect(portalRedirectUrl.toString());

  } catch (err: any) {
    console.error("Google callback error:", err);
    portalRedirectUrl.searchParams.set('import_status', 'error');
    portalRedirectUrl.searchParams.set('error_message', err.message || 'An unknown error occurred.');
    return c.redirect(portalRedirectUrl.toString());
  }
};



// 3. NEW: Handles the import of admin-selected contacts
export const handleAdminImportSelectedContacts = async (c: Context<AppEnv>) => {
    const { contacts } = await c.req.json();
    const db = c.env.DB;
    let importedCount = 0;

    if (!Array.isArray(contacts)) {
        return errorResponse("Invalid payload. 'contacts' must be an array.", 400);
    }

    for (const contact of contacts) {
      // **FIX START**: Safely access and clean email and phone data
      const emailValue = contact.emailAddresses?.[0]?.value;
      const email = emailValue ? emailValue.toLowerCase() : null;

      const phoneValue = contact.phoneNumbers?.[0]?.value;
      const phone = phoneValue ? phoneValue.replace(/\D/g, '') : null;
      // **FIX END**

      if (!email && !phone) {
        continue; // Skip contacts without email or phone
      }

      // Check if user already exists
      const existingUser = await db.prepare(
        `SELECT id FROM users WHERE email = ? OR phone = ?`
      ).bind(email, phone).first();

      if (existingUser) {
        continue; // Ignore existing users
      }

      // Insert new user as a 'guest' without a Stripe account
      const name = contact.names?.[0]?.displayName || email || phone;
      const companyName = contact.organizations?.[0]?.name;
      const address = contact.addresses?.[0]?.formattedValue;

      await db.prepare(
        `INSERT INTO users (name, company_name, email, phone, address, role) VALUES (?, ?, ?, ?, ?, 'guest')`
      ).bind(
          name || null,
          companyName || null,
          email,
          phone,
          address || null
      ).run();

      importedCount++;
    }

    return successResponse({ importedCount });
}

export const handleGetImportedContacts = async (c: Context<AppEnv>) => {
    const { token } = await c.req.json();
    if (!token) {
        return errorResponse("Missing import token.", 400);
    }

    const contactsJSON = await c.env.TEMP_STORAGE.get(token);

    if (!contactsJSON) {
        return errorResponse("Import session expired or is invalid.", 404);
    }

    // It's good practice to delete the token after it's been used once
    await c.env.TEMP_STORAGE.delete(token);

    // Return the JSON string directly
    return new Response(contactsJSON, { headers: { 'Content-Type': 'application/json' } });
}
