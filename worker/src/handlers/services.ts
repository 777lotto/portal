// worker/src/handlers/services.ts
import type { Env } from "../env";
import { CORS, errorResponse } from "../utils";
import { getStripe } from "../stripe";

/**
 * Handle GET /api/services endpoint
 * Returns all services for a user
 */
export async function handleListServices(request: Request, env: Env, email: string): Promise<Response> {
  try {
    // lookup the user's ID
    const userRow = await env.DB.prepare(
      `SELECT id
       FROM users
       WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();
    
    if (!userRow) throw new Error("User not found");

    // fetch all services for that user
    const { results: servicesList } = await env.DB.prepare(
      `SELECT *
       FROM services
       WHERE user_id = ?
       ORDER BY service_date DESC`
    )
      .bind((userRow as any).id)
      .all();

    return new Response(JSON.stringify(servicesList || []), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    console.error("Error listing services:", err);
    return errorResponse(err.message, 400);
  }
}

/**
 * Handle GET /api/services/:id endpoint
 * Returns a specific service for a user
 */
export async function handleGetService(request: Request, env: Env, email: string, id: number): Promise<Response> {
  try {
    // Check if the service exists and belongs to the user
    const service = await env.DB.prepare(
      `SELECT s.* 
       FROM services s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND u.email = ?`
    )
      .bind(id, email)
      .first();

    if (!service) {
      // no record or not yours
      throw new Error("Service not found");
    }

    return new Response(JSON.stringify(service), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    console.error("Error getting service:", err);
    const status = err.message === "Service not found" ? 404 : 400;
    return errorResponse(err.message, status);
  }
}

/**
 * Handle POST /api/services/:id/invoice endpoint
 * Creates a new invoice for a service
 */
export async function handleCreateInvoice(request: Request, env: Env, email: string, serviceId: number): Promise<Response> {
  try {
    // Verify that the service exists and belongs to the user
    const service = await env.DB.prepare(
      `SELECT s.*, u.stripe_customer_id, u.name, u.email, u.id as user_id
       FROM services s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND lower(u.email) = ?`
    )
      .bind(serviceId, email.toLowerCase())
      .first();

    if (!service) {
      throw new Error("Service not found");
    }

    const serviceData = service as {
      id: number;
      user_id: number;
      stripe_invoice_id?: string;
      stripe_customer_id?: string;
    };

    // Check if there's already an invoice
    if (serviceData.stripe_invoice_id) {
      return new Response(JSON.stringify({ 
        error: "Invoice already exists for this service",
        invoice_id: serviceData.stripe_invoice_id
      }), {
        status: 400,
        headers: CORS,
      });
    }

    // Check if customer has a Stripe ID
    if (!serviceData.stripe_customer_id) {
      return new Response(JSON.stringify({ 
        error: "Customer does not have a Stripe account" 
      }), {
        status: 400,
        headers: CORS,
      });
    }

    // Get amount and description from request
    const invoiceData = await request.json() as {
      amount_cents: number;
      description: string;
      due_days?: number; // Optional: number of days until due
    };

    if (!invoiceData.amount_cents || !invoiceData.description) {
      throw new Error("Amount and description are required");
    }

    // Default due in 14 days or use custom value if provided
    const daysUntilDue = invoiceData.due_days || 14;

    // Create invoice in Stripe
    try {
      const stripe = getStripe(env);
      
      // First create an invoice item
      await stripe.invoiceItems.create({
        customer: serviceData.stripe_customer_id,
        amount: invoiceData.amount_cents,
        currency: "usd",
        description: invoiceData.description,
        metadata: {
          service_id: serviceId.toString()
        }
      });
      
      // Then create and finalize the invoice
      const invoice = await stripe.invoices.create({
        customer: serviceData.stripe_customer_id,
        collection_method: "send_invoice",
        days_until_due: daysUntilDue,
        metadata: {
          service_id: serviceId.toString()
        }
      });
      
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

      // Update the service with the invoice ID and amount
      await env.DB.prepare(
        `UPDATE services
         SET stripe_invoice_id = ?, price_cents = ?, status = 'invoiced'
         WHERE id = ?`
      ).bind(invoice.id, invoiceData.amount_cents, serviceId).run();

      // Calculate due date for notification
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + daysUntilDue);
      const formattedDueDate = dueDate.toLocaleDateString();

      // Send an invoice email notification via the notification worker
      try {
        if (env.NOTIFICATION_WORKER) {
          await env.NOTIFICATION_WORKER.fetch(
            new Request('https://portal.777.foo/api/notifications/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': request.headers.get('Authorization') || '',
              },
              body: JSON.stringify({
                type: 'invoice_created',
                userId: serviceData.user_id,
                data: {
                  invoiceId: invoice.id,
                  amount: (invoiceData.amount_cents / 100).toFixed(2),
                  dueDate: formattedDueDate,
                  invoiceUrl: finalizedInvoice.hosted_invoice_url || '#'
                },
                channels: ['email', 'sms']
              })
            })
          );
        }
      } catch (notificationError: any) {
        console.error("Failed to send invoice notification:", notificationError);
        // Don't fail the request if notification fails
      }

      return new Response(JSON.stringify({
        id: invoice.id,
        status: finalizedInvoice.status,
        amount_due: finalizedInvoice.amount_due,
        hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
        due_date: formattedDueDate,
        service_id: serviceId
      }), {
        status: 200,
        headers: CORS,
      });
    } catch (stripeError: any) {
      console.error("Stripe error creating invoice:", stripeError);
      return errorResponse(`Failed to create Stripe invoice: ${stripeError.message}`, 400);
    }
  } catch (err: any) {
    console.error("Error creating invoice:", err);
    return errorResponse(err.message, 400);
  }
}
