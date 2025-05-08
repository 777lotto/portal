// packages/shared/src/stripe.ts
export interface StripeCustomer {
  id: string;
  email: string;
  name?: string;
}

export interface StripeInvoice {
  id: string;
  customer: string;
  hosted_invoice_url?: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
}

// Webhook event types we handle
export type StripeEventType =
  | 'customer.created'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed';

export interface StripeWebhookPayload {
  type: StripeEventType;
  data: {
    object: any;
  };
}
