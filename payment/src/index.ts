import { Hono } from 'hono';
// FIX: Import the D1Database type from Cloudflare's types.
import type { D1Database, MessageBatch } from '@cloudflare/workers-types';
// FIX: BaseEnv and SendReminderSchema should now be correctly resolved from the shared package.
import { type BaseEnv, SendReminderSchema } from '@portal/shared';
import { zValidator } from '@hono/zod-validator';
import Stripe from 'stripe';
import type { Service, Job, User } from '@portal/shared';

type PaymentEnv = BaseEnv;

const app = new Hono<{ Bindings: PaymentEnv }>();

app.get('/', (c) => {
  return c.text('Hello from payment worker!');
});

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch, env: PaymentEnv): Promise<void> {
    // FIX: Cast the `DB` binding to the specific D1Database type once.
    const db = env.DB as D1Database;

    for (const message of batch.messages) {
      console.log(`Payment worker received message: ${message.id}`);
      const result = SendReminderSchema.safeParse(message.body);
      if (!result.success) {
        console.error('Failed to parse reminder message:', result.error);
        message.retry({ delaySeconds: 60 });
        continue;
      }

      const { jobId } = result.data;

      try {
        const job = await db
          .prepare('SELECT * FROM jobs WHERE id = ?')
          .bind(jobId)
          .first<Job>();

        if (!job) {
          console.error(`Job not found for id: ${jobId}`);
          message.ack();
          continue;
        }

        const client = await db
          .prepare('SELECT * FROM users WHERE id = ?')
          .bind(job.client_id)
          .first<User>();

        if (!client) {
          console.error(`Client not found for id: ${job.client_id}`);
          message.ack();
          continue;
        }

        const service = await db
          .prepare('SELECT * FROM services WHERE id = ?')
          .bind(job.service_id)
          .first<Service>();

        if (!service) {
          console.error(`Service not found for id: ${job.service_id}`);
          message.ack();
          continue;
        }

        const stripe = new Stripe(env.STRIPE_API_KEY, {
          apiVersion: '2025-05-28.basil',
          httpClient: Stripe.createFetchHttpClient(),
        });

        const jobDate = new Date(job.date);
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;
        const diffDays = Math.round(
          (jobDate.getTime() - now.getTime()) / oneDay,
        );

        // Check if a reminder has already been sent
        let reminder = await db
          .prepare(
            'SELECT * FROM reminders WHERE job_id = ? AND type = ?',
          )
          .bind(jobId, `reminder-${diffDays}`)
          .first();

        if (reminder) {
          console.log(
            `Reminder already sent for job ${jobId} for ${diffDays} day reminder.`,
          );
          message.ack();
          continue;
        }

        // Example: Send reminder 1 day before
        if (diffDays === 1) {
          // In a real app, you'd use a notification service (email/SMS)
          console.log(`Sending 1-day reminder for job ${jobId} to ${client.email}`);
          await db
            .prepare(
              'INSERT INTO reminders (id, job_id, sent_at, type) VALUES (?, ?, ?, ?)',
            )
            .bind(crypto.randomUUID(), jobId, new Date().toISOString(), 'reminder-1')
            .run();
        }

        message.ack();
      } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
        message.retry({ delaySeconds: 60 });
      }
    }
  },
};

