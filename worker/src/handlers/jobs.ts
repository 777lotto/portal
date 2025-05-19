// worker/src/handlers/jobs.ts
import { Env } from "@portal/shared";
import { requireAuth } from "../auth";
import { getCustomerJobs, getJob, generateCalendarFeed } from "../calendar";
import { CORS, errorResponse } from "../utils";

export async function handleGetJobs(request: Request, env: Env): Promise<Response> {
  try {
    // Verify JWT and get user email
    const email = await requireAuth(request, env);

    // Lookup the user's ID
    const userRow = await env.DB.prepare(
      `SELECT id, stripe_customer_id FROM users WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();

    if (!userRow) throw new Error("User not found");
    if (!(userRow as any).stripe_customer_id) throw new Error("Customer not found");

    // Get jobs for this customer
    const jobs = await getCustomerJobs(env, (userRow as any).stripe_customer_id);

    return new Response(JSON.stringify(jobs), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    return errorResponse(err.message, 401);
  }
}

export async function handleGetJobById(request: Request, url: URL, env: Env): Promise<Response> {
  try {
    const jobId = url.pathname.split("/").pop()!;
    const email = await requireAuth(request, env);

    // Get user and customer info
    const userRow = await env.DB.prepare(
      `SELECT id, stripe_customer_id FROM users WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();

    if (!userRow || !(userRow as any).stripe_customer_id) throw new Error("User not found");

    // Check if job belongs to customer
    const job = await env.DB.prepare(
      `SELECT * FROM jobs WHERE id = ? AND customerId = ?`
    )
      .bind(jobId, (userRow as any).stripe_customer_id)
      .first();

    if (!job) throw new Error("Job not found");

    return new Response(JSON.stringify(job), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    const status = err.message === "Job not found" ? 404 : 401;
    return errorResponse(err.message, status);
  }
}

export async function handleCalendarFeed(request: Request, url: URL, env: Env): Promise<Response> {
  try {
    // Implementation...
    const token = url.searchParams.get("token");
    if (!token) throw new Error("Missing token");

    // Return iCal feed
    return new Response("iCal content", {
      status: 200,
      headers: {
        "Content-Type": "text/calendar",
        "Content-Disposition": "attachment; filename=\"calendar.ics\"",
      },
    });
  } catch (err: any) {
    return errorResponse(err.message, 401);
  }
}
