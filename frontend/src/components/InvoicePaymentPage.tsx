import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api';
import type { StripeInvoice } from '@portal/shared';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PK);

const CheckoutForm = ({ invoice }: { invoice: StripeInvoice }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);

    useEffect(() => {
        // Create a PaymentIntent as soon as the page loads
        apiPost<{ clientSecret: string }>(`/api/invoices/${invoice.id}/create-payment-intent`, {})
            .then(data => setClientSecret(data.clientSecret))
            .catch(err => setError(err.message));
    }, [invoice.id]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!stripe || !elements || !clientSecret) {
            return;
        }
        setIsProcessing(true);
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
             setError("Card element not found");
             setIsProcessing(false);
             return;
        }

        const { error: paymentError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: { card: cardElement },
        });

        if (paymentError) {
            setError(paymentError.message || 'An unexpected error occurred.');
            setIsProcessing(false);
        } else {
            setError(null);
            setSuccess(`Payment for invoice #${invoice.number} successful!`);
            setIsProcessing(false);
        }
    };

    if (!clientSecret) {
        return <div>Loading payment form...</div>;
    }

    return (
        <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
            <CardElement />
            <button type="submit" className="btn btn-primary mt-4 w-full" disabled={isProcessing || !stripe || success}>
                {isProcessing ? 'Processing...' : `Pay $${(invoice.total / 100).toFixed(2)}`}
            </button>
        </form>
    );
};

function InvoicePaymentPage() {
    const { invoiceId } = useParams<{ invoiceId: string }>();
    const [invoice, setInvoice] = useState<StripeInvoice | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (invoiceId) {
            apiGet<StripeInvoice>(`/api/invoices/${invoiceId}`)
                .then(setInvoice)
                .catch(err => setError(err.message))
                .finally(() => setIsLoading(false));
        }
    }, [invoiceId]);

    if (isLoading) return <div>Loading invoice...</div>;
    if (error) return <div className="alert alert-danger">{error}</div>;
    if (!invoice) return <div>Invoice not found.</div>;

    return (
        <div className="max-w-2xl mx-auto">
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Invoice #{invoice.number}</h2>
                </div>
                <div className="card-body">
                    <div className="flex justify-between mb-4">
                        <span>Status:</span>
                        <span className="font-semibold">{invoice.status}</span>
                    </div>
                    <div className="flex justify-between mb-6">
                        <span>Total Due:</span>
                        <span className="font-semibold text-2xl">${(invoice.total / 100).toFixed(2)}</span>
                    </div>
                    {invoice.status === 'open' ? (
                        <Elements stripe={stripePromise}>
                            <CheckoutForm invoice={invoice} />
                        </Elements>
                    ) : (
                        <p>This invoice is not open for payment.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default InvoicePaymentPage;
