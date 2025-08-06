// 777lotto/portal/portal-bet/worker/src/handlers/google.ts
import { Context } from 'hono';
import { AppEnv } from '../index.js';
// Removed unused imports 'User', 'errorResponse', and 'successResponse'

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
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/contacts.readonly');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // Important to get a refresh token every time

  return c.redirect(authUrl.toString());
};

// 2. Handles the callback from Google after user gives consent
export const handleGoogleCallback = async (c: Context<AppEnv>) => {
  const { code } = c.req.query();
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = c.env;
  const db = c.env.DB;
  const portalRedirectUrl = new URL(c.env.PORTAL_URL);
  portalRedirectUrl.pathname = '/admin/users'; // Redirect back to the admin dashboard

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

    // Fetch contacts from Google People API
    const peopleResponse = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations,addresses', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const peopleData: { connections: GoogleContact[] } = await peopleResponse.json();
    const contacts = peopleData.connections || [];
    let importedCount = 0;

    for (const contact of contacts) {
      const email = contact.emailAddresses?.[0]?.value?.toLowerCase();
      const phone = contact.phoneNumbers?.[0]?.value?.replace(/\D/g, '');

      if (!email && !phone) {
        continue; // Skip contacts without email or phone
      }

      // Check if user already exists
      const existingUser = await db.prepare(
        `SELECT id FROM users WHERE email = ? OR phone = ?`
      ).bind(email || null, phone || null).first();

      if (existingUser) {
        continue; // Ignore existing users
      }

      // Insert new user
      const name = contact.names?.[0]?.displayName || email || phone;
      const companyName = contact.organizations?.[0]?.name;
      const address = contact.addresses?.[0]?.formattedValue;

      await db.prepare(
        `INSERT INTO users (name, company_name, email, phone, address, role) VALUES (?, ?, ?, ?, ?, 'guest')`
      ).bind(name, companyName, email, phone, address).run();

      importedCount++;
    }

    portalRedirectUrl.searchParams.set('import_status', 'success');
    portalRedirectUrl.searchParams.set('count', importedCount.toString());
    return c.redirect(portalRedirectUrl.toString());

  } catch (err: any) {
    console.error("Google callback error:", err);
    portalRedirectUrl.searchParams.set('import_status', 'error');
    portalRedirectUrl.searchParams.set('error_message', err.message || 'An unknown error occurred.');
    return c.redirect(portalRedirectUrl.toString());
  }
};
