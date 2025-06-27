import { Env, EmailParamsSchema } from '@portal/shared';

// AWS Signature v4 helpers
async function sha256(message: string): Promise<ArrayBuffer> {
  const data = new TextEncoder().encode(message);
  return crypto.subtle.digest('SHA-256', data);
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<ArrayBuffer> {
    const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp);
    const kRegion = await hmacSha256(kDate, regionName);
    const kService = await hmacSha256(kRegion, serviceName);
    return hmacSha256(kService, 'aws4_request');
}

// Main function to send an email with Amazon SES
export async function sendEmailNotification(
  env: Env,
  params: { to: string; subject: string; html: string; text: string }
): Promise<{ success: boolean; error?: string }> {
    const validation = EmailParamsSchema.safeParse(params);
    if (!validation.success) {
        const error = "Invalid email parameters";
        console.error(error, validation.error);
        return { success: false, error };
    }

    const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, EMAIL_FROM } = env;

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !EMAIL_FROM) {
        console.warn("Email service not configured. Missing AWS SES credentials or EMAIL_FROM.");
        return { success: false, error: "Email service not configured." };
    }

    const service = 'ses';
    const host = `email.${AWS_REGION}.amazonaws.com`;
    const endpoint = `https://${host}/v2/email/outbound-emails`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const payload = {
        Content: {
            Simple: {
                Body: {
                    Html: { Data: params.html, Charset: 'UTF-8' },
                    Text: { Data: params.text, Charset: 'UTF-8' },
                },
                Subject: { Data: params.subject, Charset: 'UTF-8' },
            },
        },
        Destination: { ToAddresses: [params.to] },
        FromEmailAddress: EMAIL_FROM,
    };
    const payloadStr = JSON.stringify(payload);
    const payloadHash = toHex(await sha256(payloadStr));

    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-date';

    const canonicalRequest = [
        'POST', // Method
        '/v2/email/outbound-emails', // Canonical URI
        '', // Canonical Query String
        canonicalHeaders, // Canonical Headers
        signedHeaders, // Signed Headers
        payloadHash, // Hashed Payload
    ].join('\n');

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;

    const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        toHex(await sha256(canonicalRequest)),
    ].join('\n');

    const signingKey = await getSignatureKey(AWS_SECRET_ACCESS_KEY, dateStamp, AWS_REGION, service);
    const signature = toHex(await hmacSha256(signingKey, stringToSign));

    const authorizationHeader = `${algorithm} Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Amz-Date': amzDate,
                'Authorization': authorizationHeader,
            },
            body: payloadStr,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`SES API Error: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        const result = await response.json() as { MessageId: string };
        console.log(`Email sent to ${params.to} via SES. Message ID: ${result.MessageId}`);
        return { success: true };

    } catch (error: any) {
        console.error('Email sending failed via SES:', error);
        return { success: false, error: error.message };
    }
}


// Helper functions to generate email content based on type (unchanged)
export function generateEmailHTML(type: string, name: string, data: Record<string, any>): string {
    // A simple template engine. You can use a library like Handlebars for more complex emails.
    switch(type) {
        case 'welcome':
            return `<h1>Welcome, ${name}!</h1><p>Thanks for joining Gutter Portal.</p>`;
        case 'password_reset':
            return `<p>Hi ${name},</p><p>Someone requested a password reset. If this was you, please use this link: <a href="${data.resetLink}">Reset Password</a>. This link is valid for 1 hour.</p>`;
        case 'invoice_created':
            return `<p>Hi ${name},</p><p>A new invoice for $${(data.amount / 100).toFixed(2)} has been created. You can view it here: <a href="${data.invoiceUrl}">View Invoice</a></p>`;
        default:
            return `<p>Hello ${name},</p><p>You have a new notification.</p>`;
    }
}

export function generateEmailText(type: string, name: string, data: Record<string, any>): string {
    switch(type) {
        case 'welcome':
            return `Welcome, ${name}!\n\nThanks for joining Gutter Portal.`;
        case 'password_reset':
            return `Hi ${name},\n\nSomeone requested a password reset. If this was you, please use this link: ${data.resetLink}. This link is valid for 1 hour.`;
        case 'invoice_created':
            return `Hi ${name},\n\nA new invoice for $${(data.amount / 100).toFixed(2)} has been created. You can view it here: ${data.invoiceUrl}`;
        default:
            return `Hello ${name},\n\nYou have a new notification.`;
    }
}
