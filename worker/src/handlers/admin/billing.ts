// worker/src/handlers/admin/billing.ts
import { Context } from 'hono';
import { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import type { Job, Service } from '@portal/shared';

// Define the shape of our combined data
interface JobWithDetails extends Job {
  customerName: string;
  customerAddress: string;
  services: Service[];
}

export const handleGetJobsAndQuotes = async (c: Context<AppEnv>) => {
  const db = c.env.DB;
  try {
    // 1. Fetch all jobs with customer info
    const { results: jobs } = await db.prepare(
      `SELECT
         j.*,
         u.name as customerName,
         u.address as customerAddress
       FROM jobs j
       JOIN users u ON j.customerId = u.id
       ORDER BY j.createdAt DESC`
    ).all<Job & { customerName: string; customerAddress: string }>();

    if (!jobs) {
      return successResponse([]);
    }

    // 2. Fetch all services and map them by job_id for efficient lookup
    const { results: services } = await db.prepare(`SELECT * FROM services`).all<Service>();
    const servicesByJobId = new Map<string, Service[]>();
    if (services) {
      for (const service of services) {
        if (service.job_id) {
          if (!servicesByJobId.has(service.job_id)) {
            servicesByJobId.set(service.job_id, []);
          }
          servicesByJobId.get(service.job_id)!.push(service);
        }
      }
    }

    // 3. Combine jobs with their services
    const jobsWithDetails: JobWithDetails[] = jobs.map(job => ({
      ...job,
      services: servicesByJobId.get(job.id) || []
    }));

    return successResponse(jobsWithDetails);
  } catch (e: any) {
    console.error("Failed to get jobs and quotes:", e);
    return errorResponse("Failed to retrieve billing data.", 500);
  }
};
