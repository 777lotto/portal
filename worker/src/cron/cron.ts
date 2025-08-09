// worker/src/cron/cron.ts
import { AppEnv } from '../index.js';

export const handleScheduled = async (env: AppEnv['Bindings']) => {
  const now = new Date().toISOString();

  try {
    // Find jobs with 'quote_sent' status that have expired
    const { results: expiredQuotes } = await env.DB.prepare(
      `SELECT id FROM jobs WHERE status = 'pending' AND due < ?`
    ).bind(now).all<{ id: string }>();

    if (expiredQuotes && expiredQuotes.length > 0) {
      const ids = expiredQuotes.map(job => `'${job.id}'`).join(',');
      await env.DB.prepare(
        `UPDATE jobs SET status = 'canceled' WHERE id IN (${ids})`
      ).run();
      console.log(`Expired ${expiredQuotes.length} quotes.`);
    }

    // Find jobs with 'payment_pending' status that are past due
    const { results: pastDueInvoices } = await env.DB.prepare(
      `SELECT id FROM jobs WHERE status = 'payment_needed' AND due < ?`
    ).bind(now).all<{ id: string }>();

    if (pastDueInvoices && pastDueInvoices.length > 0) {
      const ids = pastDueInvoices.map(job => `'${job.id}'`).join(',');
      await env.DB.prepare(
        `UPDATE jobs SET status = 'payment_overdue' WHERE id IN (${ids})`
      ).run();
      console.log(`Updated ${pastDueInvoices.length} invoices to payment_overdue.`);
    }

  } catch (e: any) {
    console.error("Cron job failed:", e);
  }
};
