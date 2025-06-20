// worker/src/handlers/stripe.ts - Fixed with proper imports and types
import type { Env } from "@portal/shared";
import { getStripe, findCustomerByIdentifier, getOrCreateCustomer } from "../stripe";
import { CORS } from "../utils";

interface StripeCustomerCheckRequest {
  email?: string;
  phone?: string;
}

interface StripeCustomerCreateRequest {
  email: string;
  name: string;
  phone?: string;
}

interface ServiceRecord {
  id: number;
  user_id: number;
  stripe_invoice_id?: string;
}

interface UserRecord {
  id: number;
  user_id: number;
  email: string;
}

export async function handleStripeCustomerCheck(request: Request, env: Env): Promise<Response> {
  try {
    console.log('💳 Processing Stripe customer check...');
    
    const data = await request.json() as StripeCustomerCheckRequest;
    console.log('💳 Stripe check data:', data);
    
    const { email, phone } = data;
    
    if (!email && !phone) {
      throw new Error("At least one identifier (email or phone) is required");
    }

    // Use our helper function to find customer
    const existingCustomer = await findCustomerByIdentifier(env, email, phone);

    if (existingCustomer) {
      return new Response(JSON.stringify({
        exists: true,
        customerId: existingCustomer.id,
        email: existingCustomer.email,
        name: existingCustomer.name,
        phone: existingCustomer.phone
      }), {
        status: 200,
        headers: CORS,
      });
    } else {
      console.log('❌ No existing Stripe customer found');
      return new Response(JSON.stringify({
        exists: false
      }), {
        status: 200,
        headers: CORS,
      });
    }
  } catch (err: any) {
    console.error("❌ Stripe customer check error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

export async function handleStripeCustomerCreate(request: Request, env: Env): Promise<Response> {
  try {
    console.log('💳 Creating Stripe customer...');
    
    const data = await request.json() as StripeCustomerCreateRequest;
    console.log('💳 Customer create data:', data);
    
    const { email, name, phone } = data;
    
    if (!email || !name) {
      throw new Error("Email and name are required");
    }

    const customerId = await getOrCreateCustomer(env, email, name, phone);
    
    return new Response(JSON.stringify({
      success: true,
      customerId,
      message: 'Customer created successfully'
    }), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    console.error("❌ Stripe customer create error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  try {
    console.log('🪝 Processing Stripe webhook...');
    
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    
    if (!signature) {
      throw new Error('Missing Stripe signature');
    }

    const stripe = getStripe(env);
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    
    // Verify webhook signature
    let event: any;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log('✅ Webhook signature verified:', event.type);
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle the event based on type
    switch (event.type) {
      case 'customer.created':
        console.log('👤 Customer created:', event.data.object.id);
        break;
        
      case 'invoice.payment_succeeded':
        console.log('💰 Invoice payment succeeded:', event.data.object.id);
        await handleInvoicePaymentSucceeded(event.data.object, env, request);
        break;
        
      case 'invoice.payment_failed':
        console.log('❌ Invoice payment failed:', event.data.object.id);
        await handleInvoicePaymentFailed(event.data.object, env, request);
        break;
        
      default:
        console.log(`🤷 Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("❌ Stripe webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleInvoicePaymentSucceeded(invoice: any, env: Env, _request: Request): Promise<void> {
  // Find the service associated with this invoice
  const service = await env.DB.prepare(
    `SELECT s.*, u.email, u.id as user_id FROM services s 
     JOIN users u ON u.id = s.user_id 
     WHERE s.stripe_invoice_id = ?`
  ).bind(invoice.id).first() as (ServiceRecord & UserRecord) | null;
  
  if (service) {
    // Update service status to paid
    await env.DB.prepare(
      `UPDATE services SET status = 'paid' WHERE stripe_invoice_id = ?`
    ).bind(invoice.id).run();
    
    console.log('✅ Service marked as paid:', service.id);
    
    // Send payment confirmation notification
    try {
      if (env.NOTIFICATION_WORKER) {
        await env.NOTIFICATION_WORKER.fetch(
          new Request('https://portal.777.foo/api/notifications/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer webhook-internal',
            },
            body: JSON.stringify({
              type: 'invoice_paid',
              userId: service.user_id,
              data: {
                invoiceId: invoice.id,
                amount: (invoice.amount_paid / 100).toFixed(2),
                serviceId: service.id
              },
              channels: ['email']
            })
          })
        );
      }
    } catch (notificationError) {
      console.error('❌ Failed to send payment confirmation:', notificationError);
    }
  }
}

async function handleInvoicePaymentFailed(invoice: any, env: Env, _request: Request): Promise<void> {
  // Find the service and notify user
  const failedService = await env.DB.prepare(
    `SELECT s.*, u.email, u.id as user_id FROM services s 
     JOIN users u ON u.id = s.user_id 
     WHERE s.stripe_invoice_id = ?`
  ).bind(invoice.id).first() as (ServiceRecord & UserRecord) | null;
  
  if (failedService) {
    try {
      if (env.NOTIFICATION_WORKER) {
        await env.NOTIFICATION_WORKER.fetch(
          new Request('https://portal.777.foo/api/notifications/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer webhook-internal',
            },
            body: JSON.stringify({
              type: 'payment_failed',
              userId: failedService.user_id,
              data: {
                invoiceId: invoice.id,
                amount: (invoice.amount_due / 100).toFixed(2),
                serviceId: failedService.id
              },
              channels: ['email', 'sms']
            })
          })
        );
      }
    } catch (notificationError) {
      console.error('❌ Failed to send payment failure notification:', notificationError);
    }
  }
}
