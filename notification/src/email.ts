// notification/src/email.ts - UPDATED for ZeptoMail

import { Env, EmailParamsSchema } from '@portal/shared';
import { generateHtml as generateWelcomeHtml, generateText as generateWelcomeText } from './templates/welcome.js';
import { generatePasswordResetHtml, generatePasswordResetText } from './templates/passwordReset.js';
import { generateInvoiceCreatedHtml, generateInvoiceCreatedText, generateInvoicePaidHtml, generateInvoicePaidText } from './templates/invoice.js';
import { generateReminderHtml as generateServiceReminderHtml, generateReminderText as generateServiceReminderText } from './templates/appointment.js';
import { generatePastDueHtml, generatePastDueText } from './templates/pastDue.js';


// Main function to send an email with ZeptoMail
export async function sendEmailNotification(
  env: Env,
  params: { to: string; toName: string; subject: string; html: string; text: string }
): Promise<{ success: boolean; error?: string }> {
    const validation = EmailParamsSchema.safeParse(params);
    if (!validation.success) {
        const error = "Invalid email parameters";
        console.error(error, validation.error);
        return { success: false, error };
    }

    const { ZEPTOMAIL_TOKEN, EMAIL_FROM } = env;

    if (!ZEPTOMAIL_TOKEN || !EMAIL_FROM) {
        console.warn("Email service not configured. Missing ZEPTOMAIL_TOKEN or EMAIL_FROM.");
        return { success: false, error: "Email service not configured." };
    }

    const endpoint = 'https://api.zeptomail.com/v1.1/email';

    const payload = {
        from: {
            address: EMAIL_FROM,
            name: '777 Solutions LLC' // You can customize this name
        },
        to: [
            {
                email_address: {
                    address: params.to,
                    name: params.toName
                }
            }
        ],
        subject: params.subject,
        htmlbody: params.html,
        textbody: params.text,
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': ZEPTOMAIL_TOKEN, // The token format from docs
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`ZeptoMail API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
        }

        const result = await response.json();
        console.log(`Email sent to ${params.to} via ZeptoMail. Result:`, result);
        return { success: true };

    } catch (error: any) {
        console.error('Email sending failed via ZeptoMail:', error);
        return { success: false, error: error.message };
    }
}


// --- Template Generation (No changes needed here) ---

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
        case 'invoice_paid':
            return generateInvoicePaidHtml({
                name,
                invoiceId: data.invoiceId,
                amount: (data.amount / 100).toFixed(2),
                dueDate: new Date(data.dueDate).toLocaleDateString(),
                invoiceUrl: data.invoiceUrl,
            });
        case 'invoice_past_due':
            return generatePastDueHtml({
                name,
                invoiceId: data.invoiceId,
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
        case 'invoice_paid':
            return generateInvoicePaidText({
                name,
                invoiceId: data.invoiceId,
                amount: (data.amount / 100).toFixed(2),
                dueDate: new Date(data.dueDate).toLocaleDateString(),
                invoiceUrl: data.invoiceUrl,
            });
        case 'invoice_past_due':
            return generatePastDueText({
                name,
                invoiceId: data.invoiceId,
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
