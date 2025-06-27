// worker/src/handlers/services.ts
// --------------------------------------
import { Context as ServiceContext } from 'hono';
import { AppEnv as ServiceAppEnv } from '../index';
import { errorResponse as serviceErrorResponse, successResponse as serviceSuccessResponse } from '../utils';
import { createStripeInvoice } from '../stripe';
import { Service } from '@portal/shared';

export const handleListServices = async (c: ServiceContext<ServiceAppEnv>) => {
    const user = c.get('user');
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM services WHERE user_id = ? ORDER BY service_date DESC`
        ).bind(user.id).all();
        return serviceSuccessResponse(results);
    } catch (e: any) {
        console.error("Failed to get services:", e);
        return serviceErrorResponse("Failed to retrieve services", 500);
    }
};

export const handleGetService = async (c: ServiceContext<ServiceAppEnv>) => {
    const user = c.get('user');
    const { id } = c.req.param();
    try {
        const service = await c.env.DB.prepare(
            `SELECT * FROM services WHERE id = ? AND user_id = ?`
        ).bind(id, user.id).first<Service>();

        if (!service) {
            return serviceErrorResponse("Service not found", 404);
        }
        return serviceSuccessResponse(service);
    } catch (e: any) {
        console.error("Failed to get service:", e);
        return serviceErrorResponse("Failed to retrieve service", 500);
    }
};

export const handleCreateInvoice = async (c: ServiceContext<ServiceAppEnv>) => {
    const user = c.get('user');
    const { id } = c.req.param();
    try {
        const service = await c.env.DB.prepare(
            `SELECT * FROM services WHERE id = ? AND user_id = ?`
        ).bind(id, user.id).first<Service>();

        if (!service) return serviceErrorResponse("Service not found", 404);
        if (service.stripe_invoice_id) return serviceErrorResponse("Invoice already exists", 409);
        if (!service.price_cents) return serviceErrorResponse("Service has no price, cannot create invoice", 400);

        const invoice = await createStripeInvoice(c, service);

        await c.env.DB.prepare(
            `UPDATE services SET stripe_invoice_id = ? WHERE id = ?`
        ).bind(invoice.id, service.id).run();

        return serviceSuccessResponse({
            invoiceId: invoice.id,
            invoiceUrl: invoice.hosted_invoice_url
        });

    } catch (e: any) {
        console.error("Invoice creation failed:", e);
        return serviceErrorResponse("Failed to create invoice", 500);
    }
};

export const handleGetPhotosForService = async (c: ServiceContext<ServiceAppEnv>) => {
    const { id } = c.req.param();
    // This is a placeholder. You'd need to link photos to services in your schema.
    console.log(`Fetching photos for service ${id}`);
    return serviceSuccessResponse([]);
};

export const handleGetNotesForService = async (c: ServiceContext<ServiceAppEnv>) => {
    const { id } = c.req.param();
     // This is a placeholder. You'd need to link notes to services in your schema.
    console.log(`Fetching notes for service ${id}`);
    return serviceSuccessResponse([]);
};
