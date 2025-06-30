// payment/src/index.ts
import { Hono } from 'hono';
import { z } from 'zod';
import type { D1Database, MessageBatch } from '@cloudflare/workers-types';
import type { Env, Job, User } from '@portal/shared';

const PaymentQueueMessageSchema = z.object({
  jobId: z.string(),
});

type PaymentEnv = Env;

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

        const client = await db.prepare('SELECT * FROM users WHERE id = ?').bind(job.customerId).first<User>();

        if (!client) {
          console.error(`Client not found for id: ${job.customerId}`);
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
};
