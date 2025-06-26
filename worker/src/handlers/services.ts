// worker/src/handlers/services.ts - CORRECTED

import { errorResponse } from '../utils';
import type { AppContext } from '../index';
// This function will need to be created in your stripe.ts file
import { createInvoiceForService } from '../stripe';

export async function handleListServices(c: AppContext): Promise<Response> {
  const user = c.get('user');
  const env = c.env;
  try {
    const { results } = await env.DB.prepare(
        "SELECT * FROM services WHERE user_id = ?"
    ).bind(user.id).all();
    return c.json(results || []);
  } catch (e: any) {
    console.error("Error fetching services:", e);
    return errorResponse(e.message, 500);
  }
}

export async function handleGetService(c: AppContext): Promise<Response> {
  const user = c.get('user');
  const env = c.env;
  const serviceId = c.req.param('id');
  try {
    const service = await env.DB.prepare(
      "SELECT * FROM services WHERE id = ? AND user_id = ?"
    ).bind(serviceId, user.id).first();

    if (!service) {
      return errorResponse("Service not found", 404);
    }
    return c.json(service);
  } catch (e: any) {
    console.error(`Error fetching service ${serviceId}:`, e);
    return errorResponse(e.message, 500);
  }
}

export async function handleCreateInvoice(c: AppContext): Promise<Response> {
  const user = c.get('user');
  const env = c.env;
  const serviceId = c.req.param('id');
  try {
    // This assumes user has a stripe_customer_id
    if (!user.stripe_customer_id) {
        return errorResponse("Stripe customer ID not found for user.", 400);
    }
    const invoiceUrl = await createInvoiceForService(Number(serviceId), user.stripe_customer_id, env);
    return c.json({ hosted_invoice_url: invoiceUrl });
  } catch (e: any) {
    console.error(`Error creating invoice for service ${serviceId}:`, e);
    return errorResponse(e.message, 500);
  }
}

export async function handleGetPhotosForService(c: AppContext): Promise<Response> {
  const user = c.get('user');
  const env = c.env;
  const serviceId = c.req.param('id');
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM photos WHERE service_id = ? AND user_id = ?"
    ).bind(serviceId, user.id).all();
    return c.json(results || []);
  } catch (e: any) {
    console.error(`Error fetching photos for service ${serviceId}:`, e);
    return errorResponse(e.message, 500);
  }
}

export async function handleGetNotesForService(c: AppContext): Promise<Response> {
  const user = c.get('user');
  const env = c.env;
  const serviceId = c.req.param('id');
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM notes WHERE service_id = ? AND user_id = ?"
    ).bind(serviceId, user.id).all();
    return c.json(results || []);
  } catch (e: any) {
    console.error(`Error fetching notes for service ${serviceId}:`, e);
    return errorResponse(e.message, 500);
  }
}
