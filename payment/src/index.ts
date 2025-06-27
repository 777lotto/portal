import { Hono } from 'hono';
import { z } from 'zod';
import type { D1Database, MessageBatch } from '@cloudflare/workers-types';
import type { Env, Service, Job, User } from '@portal/shared';

// Define the expected message body for this specific queue
const PaymentQueueMessageSchema = z.object({
  jobId: z.string(),
  // You could add other properties like reminderType: '1-day' | '3-day'
});

type PaymentEnv = Env;

const app = new Hono<{ Bindings: PaymentEnv }>();

// A simple health check endpoint
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
        // Acknowledge the message to prevent retries for malformed bodies
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

        const client = await db.prepare('SELECT * FROM users WHERE id = ?').bind(job.customerId).first<User>();

        if (!client) {
          console.error(`Client not found for id: ${job.customerId}`);
          message.ack();
          continue;
        }

        // Example: Send reminder 1 day before the job start date
        const jobDate = new Date(job.start);
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;
        const diffDays = Math.round((jobDate.getTime() - now.getTime()) / oneDay);

        if (diffDays === 1) {
          // In a real app, you would add a notification request to the notification queue
          console.log(`Triggering 1-day reminder for job ${jobId} to ${client.email}`);

          // Example of what you would send to a notification queue:
          // const notificationRequest = {
          //   type: 'payment_reminder',
          //   userId: client.id,
          //   channels: ['email', 'sms'],
          //   data: {
          //     jobTitle: job.title,
          //     jobDate: job.start,
          //   },
          // };
          // await env.NOTIFICATION_QUEUE.send(notificationRequest);
        }

        // If processing is successful, acknowledge the message
        message.ack();
      } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
        // Retry the message with a delay
        message.retry({ delaySeconds: 60 });
      }
    }
  },
};
