// payment/src/index.ts
import { Hono } from 'hono';
import { z } from 'zod';
import type { D1Database, MessageBatch, ScheduledController, ExecutionContext, Queue } from '@cloudflare/workers-types';
import type { Env, Job, User } from '@portal/shared';

const PaymentQueueMessageSchema = z.object({
  jobId: z.string(),
});

type PaymentEnv = Env & {
  NOTIFICATION_QUEUE: Queue;
};

const app = new Hono<{ Bindings: PaymentEnv }>();

app.get('/', (c) => {
  return c.text('Hello from payment worker!');
});

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<any>, env: PaymentEnv): Promise<void> {
    const db = env.DB as D1Database;

    for (const message of batch.messages) {
      console.log(`Payment worker received message: ${message.id}`);
      const result = PaymentQueueMessageSchema.safeParse(message.body);

      if (!result.success) {
        console.error('Failed to parse payment queue message:', result.error);
        message.ack();
        continue;
      }

      const { jobId } = result.data;

      try {
        const job = await db.prepare('SELECT * FROM jobs WHERE id = ?').bind(jobId).first<Job>();

        if (!job) {
          console.error(`Job not found for id: ${jobId}`);
          message.ack();
          continue;
        }

        const client = await db.prepare('SELECT * FROM users WHERE id = ?').bind(job.userId).first<User>();

        if (!client) {
          console.error(`Client not found for id: ${job.userId}`);
          message.ack();
          continue;
        }

        message.ack();
      } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
        message.retry({ delaySeconds: 60 });
      }
    }
  },

  async scheduled(controller: ScheduledController, env: PaymentEnv, _ctx: ExecutionContext): Promise<void> {
    console.log(`[Cron] Running job status check at: ${new Date(controller.scheduledTime)}`);
    const db = env.DB as D1Database;

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoISO = threeDaysAgo.toISOString();

    try {
      const { results } = await db.prepare(
        `SELECT id, userId, stripeInvoiceId FROM jobs WHERE status = 'payment_pending' AND createdAt < ?`
      ).bind(threeDaysAgoISO).all<Job>();

      if (!results || results.length === 0) {
        console.log('[Cron] No jobs to mark as past due.');
        return;
      }

      console.log(`[Cron] Found ${results.length} jobs to mark as past due.`);

      const updatePromises = results.map(job => {
        return db.prepare(
          `UPDATE jobs SET status = 'past_due' WHERE id = ?`
        ).bind(job.id).run();
      });

      const notificationPromises = results.map(job => {
        console.log(`[Cron] Enqueuing past_due notification for job ${job.id}`);
        return env.NOTIFICATION_QUEUE.send({
          type: 'invoice_past_due',
          user_id: job.userId,
          data: {
            jobId: job.id,
            invoiceId: job.stripeInvoiceId
          },
          channels: ['email']
        });
      });

      await Promise.all([...updatePromises, ...notificationPromises]);
      console.log(`[Cron] Successfully updated ${results.length} jobs to 'past_due' and enqueued notifications.`);

    } catch (error) {
      console.error('[Cron] Error processing past due jobs:', error);
    }
  }
};
