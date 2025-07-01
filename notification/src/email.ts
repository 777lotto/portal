// notification/src/email.ts - UPDATED
import { Env, EmailParamsSchema } from '@portal/shared';
import { generateHtml as generateWelcomeHtml, generateText as generateWelcomeText } from './templates/welcome.js';
import { generatePasswordResetHtml, generatePasswordResetText } from './templates/passwordReset.js';
import { generateInvoiceCreatedHtml, generateInvoiceCreatedText } from './templates/invoice.js';
import { generateReminderHtml as generateServiceReminderHtml, generateReminderText as generateServiceReminderText } from './templates/appointment.js';


// AWS Signature v4 helpers (no changes here)
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

// Main function to send an email with Amazon SES (no changes here)
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
        'POST',
        '/v2/email/outbound-emails',
        '',
        canonicalHeaders,
        signedHeaders,
        payloadHash,
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


// --- Template Generation ---

// UPDATED: This function now selects the correct template based on the notification type.
export function generateEmailHTML(type: string, name: string, data: Record<string, any>): string {
    switch(type) {
        case 'welcome':
            return generateWelcomeHtml({ name });
        case 'password_reset':
            return generatePasswordResetHtml({ name, resetLink: data.resetLink });
        case 'invoice_created':
            return generateInvoiceCreatedHtml({
                name,
                invoiceId: data.invoiceId,
                amount: (data.amount / 100).toFixed(2),
                dueDate: new Date(data.dueDate).toLocaleDateString(),
                invoiceUrl: data.invoiceUrl,
            });
        case 'service_reminder':
            const serviceDate = new Date(data.serviceDate);
            return generateServiceReminderHtml({
                name,
                serviceType: data.serviceType,
                date: serviceDate.toLocaleDateString(),
                time: serviceDate.toLocaleTimeString(),
            });
        default:
            return `<p>Hello ${name},</p><p>You have a new notification.</p>`;
    }
}

// UPDATED: This function now selects the correct text template.
export function generateEmailText(type: string, name: string, data: Record<string, any>): string {
    switch(type) {
        case 'welcome':
            return generateWelcomeText({ name });
        case 'password_reset':
            return generatePasswordResetText({ name, resetLink: data.resetLink });
        case 'invoice_created':
            return generateInvoiceCreatedText({
                name,
                invoiceId: data.invoiceId,
                amount: (data.amount / 100).toFixed(2),
                dueDate: new Date(data.dueDate).toLocaleDateString(),
                invoiceUrl: data.invoiceUrl,
            });
        case 'service_reminder':
            const serviceDate = new Date(data.serviceDate);
            return generateServiceReminderText({
                name,
                serviceType: data.serviceType,
                date: serviceDate.toLocaleDateString(),
                time: serviceDate.toLocaleTimeString(),
            });
        default:
            return `Hello ${name},\n\nYou have a new notification.`;
    }
}
