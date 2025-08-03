// frontend/src/pages/InvoicePaymentPage.tsx
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { StripeInvoice, StripeInvoiceItem } from '@portal/shared';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { handleApiError } from '../lib/utils';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PK);

function PaymentStatus() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('redirect_status');
  const message = status === 'succeeded'
    ? 'Payment successful! Thank you for your business.'
    : 'Something went wrong with your payment. Please try again or contact support.';

  return (
    <div className={status === 'succeeded' ? 'alert alert-success' : 'alert alert-danger'}>
      {message}
    </div>
  );
}

const CheckoutForm = ({ invoice }: { invoice: StripeInvoice }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setIsProcessing(true);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pay-invoice/${invoice.id}`,
      },
    });

    if (submitError) {
      setError(submitError.message || 'An unexpected error occurred.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-danger">{error}</div>}
      <PaymentElement />
      <button type="submit" className="btn btn-primary mt-4 w-full" disabled={isProcessing || !stripe}>
        {isProcessing ? 'Processing...' : `Pay $${((invoice.total || 0) / 100).toFixed(2)}`}
      </button>
    </form>
  );
};

// --- REFACTORED: Data fetching with useQuery ---
const fetchInvoiceData = async (invoiceId: string) => {
  const [invoiceRes, intentRes] = await Promise.all([
    api.invoices[':invoiceId'].$get({ param: { invoiceId } }),
    api.invoices[':invoiceId']['create-payment-intent'].$post({ param: { invoiceId } })
  ]);

  if (!invoiceRes.ok) throw await handleApiError(invoiceRes, 'Failed to load invoice data.');

  const invoiceData = await invoiceRes.json();

  // Only fail on payment intent if the invoice is actually open for payment
  if (invoiceData.invoice.status === 'open' && !intentRes.ok) {
      throw await handleApiError(intentRes, 'Failed to create payment intent.');
  }

  const intentData = intentRes.ok ? await intentRes.json() : { clientSecret: null };

  return {
    invoice: invoiceData.invoice as StripeInvoice,
    clientSecret: intentData.clientSecret as string | null,
  };
};

function InvoicePaymentPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [searchParams] = useSearchParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoicePayment', invoiceId],
    queryFn: () => fetchInvoiceData(invoiceId!),
    enabled: !!invoiceId,
  });

  const { invoice, clientSecret } = data || {};

  const downloadPdfMutation = useMutation({
      mutationFn: async () => {
          if (!invoiceId) throw new Error("Invoice ID is missing");
          const res = await api.invoices[':invoiceId'].pdf.$get({ param: { invoiceId } });
          if (!res.ok) throw await handleApiError(res, 'Failed to download invoice.');
          return { blob: await res.blob(), name: `invoice-${invoice?.number || invoiceId}.pdf` };
      },
      onSuccess: ({ blob, name }) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
      },
      onError: (err: Error) => {
          alert(err.message);
      }
  });

  if (isLoading) return <div className="text-center p-8">Loading invoice...</div>;
  if (error) return <div className="alert alert-danger">{(error as Error).message}</div>;
  if (!invoice) return <div className="text-center p-8">Invoice not found.</div>;

  const showPaymentStatus = searchParams.has('payment_intent');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="card-title">Invoice #{invoice.number}</h2>
          <button onClick={() => downloadPdfMutation.mutate()} className="btn btn-secondary" disabled={downloadPdfMutation.isPending}>
            {downloadPdfMutation.isPending ? 'Downloading...' : 'Download PDF'}
          </button>
        </div>
        <div className="card-body">
          <div className="flex justify-between mb-2">
            <span>Status:</span>
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
              invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {invoice.status}
            </span>
          </div>
          <div className="flex justify-between mb-6">
            <span>Total Due:</span>
            <span className="font-semibold text-2xl">${((invoice.total || 0) / 100).toFixed(2)}</span>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Invoice Details</h3>
            <table className="min-w-full divide-y divide-border-light dark:divide-border-dark">
              <thead className="bg-secondary-light dark:bg-secondary-dark">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Description</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-tertiary-dark divide-y divide-border-light dark:divide-border-dark">
                {(invoice.lines?.data || []).map((item: StripeInvoiceItem) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 whitespace-nowrap">{item.description}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-right">${((item.amount || 0) / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showPaymentStatus ? (
            <PaymentStatus />
          ) : invoice.status === 'open' && clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm invoice={invoice} />
            </Elements>
          ) : (
            <p className="text-center p-4 bg-secondary-light dark:bg-secondary-dark rounded-md">
              This invoice is not open for payment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default InvoicePaymentPage;
