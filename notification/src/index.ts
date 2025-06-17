// notification/src/index.ts - Safe mode with graceful credential handling
import { sendEmail } from './email';
import { sendSMS, handleSMSWebhook, getSMSConversations, getSMSConversation } from './sms';
import { generatePasswordResetHtml, generatePasswordResetText } from './templates/passwordReset';

// Base environment interface
interface BaseEnv {
  DB: D1Database;
}

// Notification-specific environment interface
interface NotificationEnv extends BaseEnv {
  // Email settings
  EMAIL_FROM: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  
  // SMS settings
  SMS_FROM_NUMBER: string;
  VOIPMS_USERNAME?: string;
  VOIPMS_PASSWORD?: string;
}

// D1 database types (copied to avoid import issues)
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta: {
    changed_db: boolean;
    changes: number;
    duration: number;
    last_row_id: number;
    served_by: string;
    rows_read: number;
    rows_written: number;
  };
}

interface D1ExecResult {
  count: number;
  duration: number;
}

// Check if credentials are valid (not placeholder values)
function isValidCredential(value?: string): value is string {
  if (!value) return false;
  
  const invalidValues = ['****', '***', 'YOUR_KEY_HERE', 'PLACEHOLDER', '', 'undefined', 'null'];
  return !invalidValues.includes(value.toLowerCase()) && value.length > 8;
}

// Validate environment variables safely
function validateEnv(env: NotificationEnv): { 
  isValid: boolean; 
  errors: string[]; 
  emailEnabled: boolean;
  smsEnabled: boolean;
} {
  const errors: string[] = [];
  
  if (!env.EMAIL_FROM) {
    errors.push('EMAIL_FROM is required');
  }
  
  if (!env.SMS_FROM_NUMBER) {
    errors.push('SMS_FROM_NUMBER is required');
  }
  
  // Check if AWS credentials are valid
  const emailEnabled = isValidCredential(env.AWS_ACCESS_KEY_ID) && 
                       isValidCredential(env.AWS_SECRET_ACCESS_KEY);
  
  if (!emailEnabled) {
    console.warn('⚠️  AWS credentials not configured or invalid - email notifications disabled');
  }
  
  // Check if VoIP.ms credentials are valid
  const smsEnabled = isValidCredential(env.VOIPMS_USERNAME) && 
                     isValidCredential(env.VOIPMS_PASSWORD);
  
  if (!smsEnabled) {
    console.warn('⚠️  VoIP.ms credentials not configured or invalid - SMS notifications disabled');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    emailEnabled,
    smsEnabled
  };
}

// Enhanced email sending with better error handling
async function sendEmailNotification(
  env: NotificationEnv,
  params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  },
  emailEnabled: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!emailEnabled) {
    console.log('📧 Email disabled - skipping email notification');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    // Validate email parameters
    if (!params.to || !params.subject || (!params.html && !params.text)) {
      throw new Error('Missing required email parameters');
    }
    
    // Validate email address format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(params.to)) {
      throw new Error('Invalid email address format');
    }
    
    return await sendEmail(env, params);
  } catch (error: any) {
    console.error('📧 Email notification error:', error);
    return { 
      success: false, 
      error: error.message || 'Email sending failed' 
    };
  }
}

// Enhanced SMS sending with better error handling
async function sendSMSNotification(
  env: NotificationEnv,
  to: string,
  message: string,
  smsEnabled: boolean
): Promise<{ success: boolean; error?: string; messageSid?: string }> {
  if (!smsEnabled) {
    console.log('📱 SMS disabled - skipping SMS notification');
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    // Validate SMS parameters
    if (!to || !message) {
      throw new Error('Missing required SMS parameters');
    }
    
    // Basic phone number validation
    const cleanPhone = to.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error('Invalid phone number format');
    }
    
    return await sendSMS(env, to, message);
  } catch (error: any) {
    console.error('📱 SMS notification error:', error);
    return { 
      success: false, 
      error: error.message || 'SMS sending failed' 
    };
  }
}

// Handler function
export default {
  async fetch(request: Request, env: NotificationEnv): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace('/api/notifications/', '');

      console.log(`📧 Notification worker: ${request.method} ${path}`);

      // CORS handling
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      }

      // Health check endpoint
      if (path === 'ping') {
        const validation = validateEnv(env);
        return new Response(JSON.stringify({ 
          status: 'ok',
          timestamp: new Date().toISOString(),
          validation: validation.isValid ? 'passed' : 'warnings',
          services: {
            email: validation.emailEnabled ? 'enabled' : 'disabled',
            sms: validation.smsEnabled ? 'enabled' : 'disabled'
          },
          warnings: validation.errors.length > 0 ? validation.errors : undefined
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Validate environment
      const validation = validateEnv(env);
      if (!validation.isValid) {
        console.error('❌ Environment validation failed:', validation.errors);
        return new Response(JSON.stringify({ 
          error: 'Service configuration error',
          details: validation.errors
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Auth check (basic validation)
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Send notification endpoint
      if (path === 'send' && request.method === 'POST') {
        const body = await request.json() as {
          type: string;
          userId: number | string;
          data: Record<string, any>;
          channels?: string[];
        };
        
        const { type, userId, data, channels = ['email'] } = body;

        if (!type || !userId) {
          return new Response(JSON.stringify({ 
            error: 'Missing required fields: type and userId' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Get user info
        const user = await env.DB.prepare(
          'SELECT id, email, name, phone FROM users WHERE id = ?'
        ).bind(userId).first();

        if (!user) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const userRecord = user as { 
          id: number; 
          email?: string; 
          name: string; 
          phone?: string; 
        };
        
        const results: Record<string, { success: boolean; error?: string }> = {};

        // Send email notification if requested
        if (channels.includes('email') && userRecord.email) {
          const subject = `Gutter Portal: ${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
          const html = generateEmailHTML(type, userRecord.name, data);
          const text = generateEmailText(type, userRecord.name, data);

          results.email = await sendEmailNotification(env, {
            to: userRecord.email,
            subject,
            html,
            text,
          }, validation.emailEnabled);
        }

        // Send SMS notification if requested
        if (channels.includes('sms') && userRecord.phone) {
          const message = generateSMSMessage(type, userRecord.name, data);
          const smsResult = await sendSMSNotification(env, userRecord.phone, message, validation.smsEnabled);
          results.sms = {
            success: smsResult.success,
            error: smsResult.error
          };
        }

        // Log notification attempt (only if at least one channel was attempted)
        if (Object.keys(results).length > 0) {
          try {
            await env.DB.prepare(
              `INSERT INTO notifications (user_id, type, channels, status, metadata)
               VALUES (?, ?, ?, ?, ?)`
            ).bind(
              userId,
              type,
              JSON.stringify(channels),
              Object.values(results).some(r => r.success) ? 'sent' : 'failed',
              JSON.stringify({
                sentAt: new Date().toISOString(),
                results,
                data
              })
            ).run();
          } catch (dbError) {
            console.error('Failed to log notification:', dbError);
            // Don't fail the entire request if logging fails
          }
        }

        return new Response(JSON.stringify({
          success: Object.values(results).some(r => r.success),
          results,
          message: Object.keys(results).length === 0 ? 'No channels available for notification' : undefined
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // SMS webhook endpoint
      if (path === 'sms/webhook' && request.method === 'POST') {
        return await handleSMSWebhook(request, env);
      }

      // SMS conversations endpoint
      if (path.startsWith('sms/conversations') && request.method === 'GET') {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Missing userId parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const conversations = await getSMSConversations(env, userId);
        return new Response(JSON.stringify(conversations), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // SMS messages endpoint
      if (path.startsWith('sms/messages/') && request.method === 'GET') {
        const pathParts = path.split('/');
        const phoneNumber = pathParts[2];
        const userId = url.searchParams.get('userId');
        
        if (!phoneNumber || !userId) {
          return new Response(JSON.stringify({ 
            error: 'Missing phoneNumber or userId parameter' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const messages = await getSMSConversation(env, userId, phoneNumber);
        return new Response(JSON.stringify(messages), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Default response for unknown paths
      return new Response(JSON.stringify({ 
        error: 'Not found',
        path,
        availableEndpoints: [
          'GET /ping',
          'POST /send',
          'POST /sms/webhook',
          'GET /sms/conversations',
          'GET /sms/messages/{phoneNumber}'
        ]
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
      
    } catch (error: any) {
      console.error('Notification worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message || 'Unknown error occurred'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }, 
      });
    }
  },
};

// Helper functions for generating notification content
function generateEmailHTML(type: string, name: string, data: Record<string, any>): string {
  const baseStyle = `
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { font-size: 12px; color: #777; text-align: center; margin-top: 20px; }
  `;

  switch (type) {
    case 'welcome':
      return `
        <html>
        <head><style>${baseStyle}</style></head>
        <body>
          <div class="container">
            <div class="header"><h1>Welcome to Gutter Portal!</h1></div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>Welcome to Gutter Portal! We're excited to have you on board.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Gutter Portal. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    case 'invoice_created':
      return `
        <html>
        <head><style>${baseStyle}</style></head>
        <body>
          <div class="container">
            <div class="header"><h1>New Invoice</h1></div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>A new invoice has been created for $${data.amount || '0.00'}.</p>
              ${data.invoiceUrl ? `<p><a href="${data.invoiceUrl}">View Invoice</a></p>` : ''}
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Gutter Portal. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
  case 'password_reset':
    return generatePasswordResetHtml({
      name: name,
      resetLink: data.resetLink || '#'
    });
    default:
      return `
        <html>
        <head><style>${baseStyle}</style></head>
        <body>
          <div class="container">
            <div class="header"><h1>Notification</h1></div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>You have a new ${type.replace(/_/g, ' ')} notification.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Gutter Portal. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
  }
}

function generateEmailText(type: string, name: string, data: Record<string, any>): string {
  switch (type) {
    case 'welcome':
      return `Hello ${name},\n\nWelcome to Gutter Portal! We're excited to have you on board.\n\n© ${new Date().getFullYear()} Gutter Portal. All rights reserved.`;
    case 'invoice_created':
      return `Hello ${name},\n\nA new invoice has been created for $${data.amount || '0.00'}.\n\n${data.invoiceUrl ? `View Invoice: ${data.invoiceUrl}\n\n` : ''}© ${new Date().getFullYear()} Gutter Portal. All rights reserved.`;
    case 'password_reset':
    return generatePasswordResetText({
      name: name,
      resetLink: data.resetLink || '#'
    });
    default:
      return `Hello ${name},\n\nYou have a new ${type.replace(/_/g, ' ')} notification.\n\n© ${new Date().getFullYear()} Gutter Portal. All rights reserved.`;
  }
}

function generateSMSMessage(type: string, name: string, data: Record<string, any>): string {
  switch (type) {
    case 'welcome':
      return `Hello ${name}, welcome to Gutter Portal! We're excited to have you on board.`;
    case 'invoice_created':
      return `Hello ${name}, your invoice for $${data.amount || '0.00'} is ready. ${data.invoiceUrl ? `Pay here: ${data.invoiceUrl}` : 'Check your email for details.'}`;
    case 'payment_reminder':
      return `Hello ${name}, reminder: your invoice for $${data.amount || '0.00'} is due. ${data.paymentLink ? `Pay now: ${data.paymentLink}` : 'Please check your email.'}`;
    case 'password_reset_request':
    return `A password reset link has been sent to your email address. The link will expire in 1 hour.`;
    default:
      return `Hello ${name}, you have a new ${type.replace(/_/g, ' ')} notification from Gutter Portal.`;
  }
}
