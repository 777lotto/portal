// worker/src/handlers/services.ts
import { Context as ServiceContext } from 'hono';
import { AppEnv as ServiceAppEnv } from '../index.js';
import { errorResponse as serviceErrorResponse, successResponse as serviceSuccessResponse } from '../utils.js';
import { Service } from '@portal/shared';

export const handleListServices = async (c: ServiceContext<ServiceAppEnv>) => {
    const user = c.get('user');
    try {
        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM services WHERE user_id = ? ORDER BY service_date DESC`
        ).bind(user.id).all();

        const services = dbResponse?.results || [];
        return serviceSuccessResponse(services);
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

// THIS FUNCTION IS NOW DEPRECATED as invoicing is handled at the job level.
// export const handleCreateInvoice = async (c: ServiceContext<ServiceAppEnv>) => { ... }

export const handleGetPhotosForService = async (c: ServiceContext<ServiceAppEnv>) => {
    const { id } = c.req.param();
    console.log(`Fetching photos for service ${id}`);
    return serviceSuccessResponse([]);
};

export const handleGetNotesForService = async (c: ServiceContext<ServiceAppEnv>) => {
    const { id } = c.req.param();
    console.log(`Fetching notes for service ${id}`);
    return serviceSuccessResponse([]);
};
