// worker/src/handlers/profile.ts
import { Env } from "@portal/shared";
import { CORS, errorResponse } from "../utils";

/**
 * Handle GET /api/profile endpoint
 * Returns the user's profile information
 */
export async function handleGetProfile(request: Request, env: Env, email: string): Promise<Response> {
  try {
    // Fetch the user record (case‑insensitive email)
    const userRecord = await env.DB.prepare(
      `SELECT id, email, name, phone, stripe_customer_id
       FROM users
       WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();

    if (!userRecord) {
      throw new Error("User not found");
    }

    // Return the user profile information
    return new Response(JSON.stringify(userRecord), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    console.error("Error getting profile:", err);
    return errorResponse(err.message, 400);
  }
}

/**
 * Handle PUT /api/profile endpoint
 * Updates the user's profile information
 */
export async function handleUpdateProfile(request: Request, env: Env, email: string): Promise<Response> {
  try {
    // Get the user's ID first
    const userRecord = await env.DB.prepare(
      `SELECT id, stripe_customer_id
       FROM users
       WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();

    if (!userRecord) {
      throw new Error("User not found");
    }

    // Parse update data from request
    const updateData = await request.json() as {
      name?: string;
      phone?: string;
    };

    const fields = [];
    const values = [];

    // Add fields to update
    if (updateData.name) {
      fields.push("name = ?");
      values.push(updateData.name);
    }

    if (updateData.phone) {
      fields.push("phone = ?");
      values.push(updateData.phone);
    }

    if (fields.length === 0) {
      return new Response(JSON.stringify({ message: "No fields to update" }), {
        status: 200,
        headers: CORS,
      });
    }

    // Add the user ID for the WHERE clause
    values.push((userRecord as any).id);

    // Update the user record
    const result = await env.DB.prepare(
      `UPDATE users
       SET ${fields.join(", ")}
       WHERE id = ?`
    ).bind(...values).run();

    // Also update Stripe customer if available
    if ((userRecord as any).stripe_customer_id && (updateData.name || updateData.phone)) {
      try {
        const stripe = (await import("../stripe")).getStripe(env);
        const stripeUpdateData: any = {};
        
        if (updateData.name) stripeUpdateData.name = updateData.name;
        if (updateData.phone) stripeUpdateData.phone = updateData.phone;
        
        await stripe.customers.update((userRecord as any).stripe_customer_id, stripeUpdateData);
      } catch (stripeError) {
        console.error("Failed to update Stripe customer:", stripeError);
        // We don't want to fail the entire request if just the Stripe update fails
      }
    }

    // Get the updated user record
    const updatedUser = await env.DB.prepare(
      `SELECT id, email, name, phone
       FROM users
       WHERE id = ?`
    ).bind((userRecord as any).id).first();

    return new Response(JSON.stringify(updatedUser), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    console.error("Error updating profile:", err);
    return errorResponse(err.message, 400);
  }
}
