// worker/src/stripe/index.ts
import Stripe from 'stripe';
import { Env, User, LineItem } from '@portal/shared';
import { Readable } from 'stream';

// ====================================================================================
// Initialization
// ====================================================================================

/**
 * Initializes the Stripe client.
 * - The API version is set to '2025-05-28.basil' as requested. This is a best practice
 * to ensure that your integration doesn't break unexpectedly when Stripe updates their API.
 */
export function getStripe(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-05-28.basil',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// ====================================================================================
// Customer Management
// ====================================================================================

/**
 * Creates a new Stripe customer object or retrieves an existing one based on email.
 * This is a helpful utility function that combines retrieval and creation.
 * @param stripe The Stripe instance.
 * @param user The user object from your application.
 * @returns The created or retrieved Stripe Customer object.
 */
export async function createStripeCustomer(stripe: Stripe, user: User): Promise<Stripe.Customer> {
  const { email, name, phone, companyName } = user;

  const existingCustomers = await stripe.customers.list({ email: email, limit: 1 });
  if (existingCustomers.data.length > 0) {
    console.log(`Found existing Stripe customer for email: ${email}`);
    return existingCustomers.data[0];
  }

  console.log(`Creating new Stripe customer for email: ${email}`);
  return stripe.customers.create({
      email: email,
      name: name ?? undefined,
      phone: phone || undefined,
      metadata: {
        company_name: companyName || ''
      }
  });
}

/**
 * Retrieves a customer object.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer to retrieve.
 * @returns The Stripe Customer object.
 */
export async function retrieveCustomer(stripe: Stripe, customerId: string): Promise<Stripe.Customer> {
    return stripe.customers.retrieve(customerId);
}

/**
 * Updates a customer object.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer to update.
 * @param params The parameters to update.
 * @returns The updated Stripe Customer object.
 */
export async function updateCustomer(stripe: Stripe, customerId: string, params: Stripe.CustomerUpdateParams): Promise<Stripe.Customer> {
    return stripe.customers.update(customerId, params);
}

/**
 * Lists all customer objects.
 * @param stripe The Stripe instance.
 * @param params Optional filtering parameters.
 * @returns A list of Stripe Customer objects.
 */
export async function listCustomers(stripe: Stripe, params?: Stripe.CustomerListParams): Promise<Stripe.ApiList<Stripe.Customer>> {
    return stripe.customers.list(params);
}

/**
 * Deletes a customer object.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer to delete.
 * @returns The deleted Stripe Customer object.
 */
export async function deleteCustomer(stripe: Stripe, customerId: string): Promise<Stripe.DeletedCustomer> {
    return stripe.customers.del(customerId);
}

/**
 * Searches for customers with a query.
 * @param stripe The Stripe instance.
 * @param params The search parameters.
 * @returns A list of matching Stripe Customer objects.
 */
export async function searchCustomers(stripe: Stripe, params: Stripe.CustomerSearchParams): Promise<Stripe.ApiSearchResult<Stripe.Customer>> {
    return stripe.customers.search(params);
}


// ====================================================================================
// Payment Methods API
// ====================================================================================

/**
 * Creates a PaymentMethod.
 * @param stripe The Stripe instance.
 * @param params The parameters for creating the PaymentMethod.
 * @returns The created Stripe PaymentMethod object.
 */
export async function createPaymentMethod(stripe: Stripe, params: Stripe.PaymentMethodCreateParams): Promise<Stripe.PaymentMethod> {
    return stripe.paymentMethods.create(params);
}

/**
 * Retrieves a PaymentMethod object.
 * @param stripe The Stripe instance.
 * @param paymentMethodId The ID of the PaymentMethod to retrieve.
 * @returns The Stripe PaymentMethod object.
 */
export async function retrievePaymentMethod(stripe: Stripe, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return stripe.paymentMethods.retrieve(paymentMethodId);
}

/**
 * Updates a PaymentMethod object.
 * @param stripe The Stripe instance.
 * @param paymentMethodId The ID of the PaymentMethod to update.
 * @param params The parameters to update.
 * @returns The updated Stripe PaymentMethod object.
 */
export async function updatePaymentMethod(stripe: Stripe, paymentMethodId: string, params: Stripe.PaymentMethodUpdateParams): Promise<Stripe.PaymentMethod> {
    return stripe.paymentMethods.update(paymentMethodId, params);
}

/**
 * Lists all PaymentMethods for a given customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param params Optional filtering parameters.
 * @returns A list of Stripe PaymentMethod objects.
 */
export async function listCustomerPaymentMethods(stripe: Stripe, customerId: string, params?: Stripe.PaymentMethodListParams): Promise<Stripe.ApiList<Stripe.PaymentMethod>> {
    return stripe.customers.listPaymentMethods(customerId, params);
}

/**
 * Attaches a PaymentMethod to a Customer.
 * @param stripe The Stripe instance.
 * @param paymentMethodId The ID of the PaymentMethod.
 * @param customerId The ID of the Customer.
 * @returns The attached Stripe PaymentMethod object.
 */
export async function attachPaymentMethod(stripe: Stripe, paymentMethodId: string, customerId: string): Promise<Stripe.PaymentMethod> {
    return stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
}

/**
 * Detaches a PaymentMethod from a Customer.
 * @param stripe The Stripe instance.
 * @param paymentMethodId The ID of the PaymentMethod to detach.
 * @returns The detached Stripe PaymentMethod object.
 */
export async function detachPaymentMethod(stripe: Stripe, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return stripe.paymentMethods.detach(paymentMethodId);
}

/**
 * Sets a default payment method for a customer's invoices.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param paymentMethodId The ID of the payment method.
 * @returns The updated Stripe Customer object.
 */
export async function updateCustomerDefaultPaymentMethod(stripe: Stripe, customerId: string, paymentMethodId: string): Promise<Stripe.Customer> {
    return stripe.customers.update(customerId, {
        invoice_settings: {
            default_payment_method: paymentMethodId,
        },
    });
}

// ====================================================================================
// Customer Card Management
// ====================================================================================

/**
 * Creates a new card for a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param params The parameters for creating the card source.
 * @returns The created Stripe Card object.
 */
export async function createCustomerCard(stripe: Stripe, customerId: string, params: Stripe.CustomerSourceCreateParams): Promise<Stripe.Card> {
    const source = await stripe.customers.createSource(customerId, params);
    return source as Stripe.Card;
}

/**
 * Retrieves a specific card for a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param cardId The ID of the card to retrieve.
 * @returns The Stripe Card object.
 */
export async function retrieveCustomerCard(stripe: Stripe, customerId: string, cardId: string): Promise<Stripe.Card> {
    return stripe.customers.retrieveCard(customerId, cardId);
}

/**
 * Updates a card for a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param cardId The ID of the card to update.
 * @param params The parameters to update.
 * @returns The updated Stripe Card object.
 */
export async function updateCustomerCard(stripe: Stripe, customerId: string, cardId: string, params: Stripe.CardUpdateParams): Promise<Stripe.Card> {
    return stripe.customers.updateCard(customerId, cardId, params);
}

/**
 * Lists all cards for a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param params Optional filtering parameters.
 * @returns A list of Stripe Card objects.
 */
export async function listCustomerCards(stripe: Stripe, customerId: string, params?: Stripe.CustomerSourceListParams): Promise<Stripe.ApiList<Stripe.Card>> {
    const sources = await stripe.customers.listSources(customerId, { object: 'card', ...params });
    return sources as Stripe.ApiList<Stripe.Card>;
}

/**
 * Deletes a card from a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param cardId The ID of the card to delete.
 * @returns The deleted Stripe Card object.
 */
export async function deleteCustomerCard(stripe: Stripe, customerId: string, cardId: string): Promise<Stripe.DeletedCard | Stripe.DeletedAlipayAccount | Stripe.DeletedBankAccount> {
    return stripe.customers.deleteSource(customerId, cardId);
}

// ====================================================================================
// Customer Bank Account Management
// ====================================================================================

/**
 * Creates a new bank account for a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param params The parameters for creating the bank account source.
 * @returns The created Stripe BankAccount object.
 */
export async function createCustomerBankAccount(stripe: Stripe, customerId: string, params: Stripe.CustomerSourceCreateParams): Promise<Stripe.BankAccount> {
    const source = await stripe.customers.createSource(customerId, params);
    return source as Stripe.BankAccount;
}

/**
 * Retrieves a specific bank account for a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param bankAccountId The ID of the bank account to retrieve.
 * @returns The Stripe BankAccount object.
 */
export async function retrieveCustomerBankAccount(stripe: Stripe, customerId: string, bankAccountId: string): Promise<Stripe.BankAccount> {
    return stripe.customers.retrieveSource(customerId, bankAccountId) as Promise<Stripe.BankAccount>;
}

/**
 * Updates a bank account for a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param bankAccountId The ID of the bank account to update.
 * @param params The parameters to update.
 * @returns The updated Stripe BankAccount object.
 */
export async function updateCustomerBankAccount(stripe: Stripe, customerId: string, bankAccountId: string, params: Stripe.CustomerSourceUpdateParams): Promise<Stripe.BankAccount> {
    return stripe.customers.updateSource(customerId, bankAccountId, params) as Promise<Stripe.BankAccount>;
}

/**
 * Lists all bank accounts for a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param params Optional filtering parameters.
 * @returns A list of Stripe BankAccount objects.
 */
export async function listCustomerBankAccounts(stripe: Stripe, customerId: string, params?: Stripe.CustomerSourceListParams): Promise<Stripe.ApiList<Stripe.BankAccount>> {
    const sources = await stripe.customers.listSources(customerId, { object: 'bank_account', ...params });
    return sources as Stripe.ApiList<Stripe.BankAccount>;
}

/**
 * Deletes a bank account from a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param bankAccountId The ID of the bank account to delete.
 * @returns The deleted Stripe object.
 */
export async function deleteCustomerBankAccount(stripe: Stripe, customerId: string, bankAccountId: string): Promise<Stripe.DeletedCard | Stripe.DeletedAlipayAccount | Stripe.DeletedBankAccount> {
    return stripe.customers.deleteSource(customerId, bankAccountId);
}

/**
 * Verifies a customer's bank account.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param bankAccountId The ID of the bank account to verify.
 * @param params The verification parameters.
 * @returns The verified Stripe BankAccount object.
 */
export async function verifyCustomerBankAccount(stripe: Stripe, customerId: string, bankAccountId: string, params: Stripe.CustomerVerifySourceParams): Promise<Stripe.BankAccount> {
    return stripe.customers.verifySource(customerId, bankAccountId, params);
}

// ====================================================================================
// Customer Tax ID Management
// ====================================================================================

/**
 * Creates a new tax ID for a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param params The parameters for creating the tax ID.
 * @returns The created Stripe TaxId object.
 */
export async function createCustomerTaxId(stripe: Stripe, customerId: string, params: Stripe.CustomerCreateTaxIdParams): Promise<Stripe.TaxId> {
    return stripe.customers.createTaxId(customerId, params);
}

/**
 * Retrieves a specific tax ID for a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param taxId The ID of the tax ID to retrieve.
 * @returns The Stripe TaxId object.
 */
export async function retrieveCustomerTaxId(stripe: Stripe, customerId: string, taxId: string): Promise<Stripe.TaxId> {
    return stripe.customers.retrieveTaxId(customerId, taxId);
}

/**
 * Lists all tax IDs for a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param params Optional filtering parameters.
 * @returns A list of Stripe TaxId objects.
 */
export async function listCustomerTaxIds(stripe: Stripe, customerId: string, params?: Stripe.CustomerListTaxIdsParams): Promise<Stripe.ApiList<Stripe.TaxId>> {
    return stripe.customers.listTaxIds(customerId, params);
}

/**
 * Deletes a tax ID from a customer.
 * @param stripe The Stripe instance.
 * @param customerId The ID of the customer.
 * @param taxId The ID of the tax ID to delete.
 * @returns The deleted Stripe TaxId object.
 */
export async function deleteCustomerTaxId(stripe: Stripe, customerId: string, taxId: string): Promise<Stripe.DeletedTaxId> {
    return stripe.customers.deleteTaxId(customerId, taxId);
}

// ====================================================================================
// Mandates API
// ====================================================================================

/**
 * Retrieves a Mandate, which is a record of customer's permission to debit their payment method.
 * @param stripe The Stripe instance.
 * @param mandateId The ID of the Mandate to retrieve.
 * @returns The Stripe Mandate object.
 */
export async function retrieveMandate(stripe: Stripe, mandateId: string): Promise<Stripe.Mandate> {
    return stripe.mandates.retrieve(mandateId);
}


// ====================================================================================
// Payment & Setup Intents
// ====================================================================================

export async function createPaymentIntent(stripe: Stripe, amount: number, customerId: string, paymentMethodId: string): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never'
        }
    });
}

export async function createSetupIntent(stripe: Stripe, customerId: string): Promise<Stripe.SetupIntent> {
    return stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
    });
}

// ====================================================================================
// Tokens & Confirmation Tokens (Auth APIs)
// ====================================================================================

export async function createToken(stripe: Stripe, params: Stripe.TokenCreateParams): Promise<Stripe.Token> {
    return stripe.tokens.create(params);
}

export async function retrieveToken(stripe: Stripe, tokenId: string): Promise<Stripe.Token> {
    return stripe.tokens.retrieve(tokenId);
}

export async function retrieveConfirmationToken(stripe: Stripe, confirmationTokenId: string): Promise<Stripe.ConfirmationToken> {
    return stripe.confirmationTokens.retrieve(confirmationTokenId);
}

// ====================================================================================
// Expanded Payment Intents API
// ====================================================================================

export async function retrievePaymentIntent(stripe: Stripe, paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.retrieve(paymentIntentId);
}

export async function updatePaymentIntent(stripe: Stripe, paymentIntentId: string, params: Stripe.PaymentIntentUpdateParams): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.update(paymentIntentId, params);
}

export async function confirmPaymentIntent(stripe: Stripe, paymentIntentId: string, params?: Stripe.PaymentIntentConfirmParams): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.confirm(paymentIntentId, params);
}

export async function capturePaymentIntent(stripe: Stripe, paymentIntentId: string, params?: Stripe.PaymentIntentCaptureParams): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.capture(paymentIntentId, params);
}

export async function cancelPaymentIntent(stripe: Stripe, paymentIntentId: string, params?: Stripe.PaymentIntentCancelParams): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.cancel(paymentIntentId, params);
}

export async function listPaymentIntents(stripe: Stripe, params?: Stripe.PaymentIntentListParams): Promise<Stripe.ApiList<Stripe.PaymentIntent>> {
    return stripe.paymentIntents.list(params);
}

// ====================================================================================
// Expanded Setup Intents & Setup Attempts API
// ====================================================================================

export async function retrieveSetupIntent(stripe: Stripe, setupIntentId: string): Promise<Stripe.SetupIntent> {
    return stripe.setupIntents.retrieve(setupIntentId);
}

export async function updateSetupIntent(stripe: Stripe, setupIntentId: string, params: Stripe.SetupIntentUpdateParams): Promise<Stripe.SetupIntent> {
    return stripe.setupIntents.update(setupIntentId, params);
}

export async function confirmSetupIntent(stripe: Stripe, setupIntentId: string, params?: Stripe.SetupIntentConfirmParams): Promise<Stripe.SetupIntent> {
    return stripe.setupIntents.confirm(setupIntentId, params);
}

export async function cancelSetupIntent(stripe: Stripe, setupIntentId: string, params?: Stripe.SetupIntentCancelParams): Promise<Stripe.SetupIntent> {
    return stripe.setupIntents.cancel(setupIntentId, params);
}

export async function listSetupIntents(stripe: Stripe, params?: Stripe.SetupIntentListParams): Promise<Stripe.ApiList<Stripe.SetupIntent>> {
    return stripe.setupIntents.list(params);
}

export async function listSetupAttempts(stripe: Stripe, params: Stripe.SetupAttemptListParams): Promise<Stripe.ApiList<Stripe.SetupAttempt>> {
    return stripe.setupAttempts.list(params);
}

// ====================================================================================
// Quotes API
// ====================================================================================

export async function createStripeQuote(stripe: Stripe, customerId: string, lineItems: LineItem[]): Promise<Stripe.Quote> {
    console.log(`Creating new Stripe quote for customer: ${customerId}`);

    const line_items_payload = lineItems.map(item => ({
        price_data: {
            currency: 'usd',
            product_data: {
                name: item.description,
            },
            unit_amount: item.unitTotalAmountCents,
        },
        quantity: item.quantity,
    }));

    const quote = await stripe.quotes.create({
        customer: customerId,
        line_items: line_items_payload,
        collection_method: 'send_invoice',
        invoice_settings: {
          days_until_due: 30,
        },
    });

    console.log(`Created new Stripe quote: ${quote.id}`);
    return quote;
}

export async function finalizeStripeQuote(stripe: Stripe, quoteId: string): Promise<Stripe.Quote> {
    console.log(`Finalizing Stripe quote: ${quoteId}`);
    const finalizedQuote = await stripe.quotes.finalizeQuote(quoteId);
    console.log(`Finalized Stripe quote: ${finalizedQuote.id}`);
    return finalizedQuote;
}

export async function retrieveQuote(stripe: Stripe, quoteId: string): Promise<Stripe.Quote> {
    return stripe.quotes.retrieve(quoteId);
}

export async function updateQuote(stripe: Stripe, quoteId: string, params: Stripe.QuoteUpdateParams): Promise<Stripe.Quote> {
    return stripe.quotes.update(quoteId, params);
}

export async function listQuotes(stripe: Stripe, params?: Stripe.QuoteListParams): Promise<Stripe.ApiList<Stripe.Quote>> {
    return stripe.quotes.list(params);
}

export async function acceptQuote(stripe: Stripe, quoteId: string, params?: Stripe.QuoteAcceptParams): Promise<Stripe.Quote> {
    return stripe.quotes.accept(quoteId, params);
}

export async function cancelQuote(stripe: Stripe, quoteId: string): Promise<Stripe.Quote> {
    return stripe.quotes.cancel(quoteId);
}

export async function downloadQuotePdf(stripe: Stripe, quoteId: string): Promise<Readable> {
    return stripe.quotes.pdf(quoteId);
}

export async function listQuoteLineItems(stripe: Stripe, quoteId: string, params?: Stripe.QuoteListLineItemsParams): Promise<Stripe.ApiList<Stripe.LineItem>> {
    return stripe.quotes.listLineItems(quoteId, params);
}

export async function listQuoteComputedUpfrontLineItems(stripe: Stripe, quoteId: string, params?: Stripe.QuoteListComputedUpfrontLineItemsParams): Promise<Stripe.ApiList<Stripe.LineItem>> {
    return stripe.quotes.listComputedUpfrontLineItems(quoteId, params);
}

// ====================================================================================
// Invoices API
// ====================================================================================

export async function createInvoice(stripe: Stripe, params: Stripe.InvoiceCreateParams): Promise<Stripe.Invoice> {
    return stripe.invoices.create(params);
}

export async function retrieveInvoice(stripe: Stripe, invoiceId: string): Promise<Stripe.Invoice> {
    return stripe.invoices.retrieve(invoiceId);
}

export async function updateInvoice(stripe: Stripe, invoiceId: string, params: Stripe.InvoiceUpdateParams): Promise<Stripe.Invoice> {
    return stripe.invoices.update(invoiceId, params);
}

export async function listInvoices(stripe: Stripe, params?: Stripe.InvoiceListParams): Promise<Stripe.ApiList<Stripe.Invoice>> {
    return stripe.invoices.list(params);
}

export async function deleteDraftInvoice(stripe: Stripe, invoiceId: string): Promise<Stripe.DeletedInvoice> {
    return stripe.invoices.del(invoiceId);
}

export async function finalizeInvoice(stripe: Stripe, invoiceId: string): Promise<Stripe.Invoice> {
    return stripe.invoices.finalizeInvoice(invoiceId);
}

export async function payInvoice(stripe: Stripe, invoiceId: string, params?: Stripe.InvoicePayParams): Promise<Stripe.Invoice> {
    return stripe.invoices.pay(invoiceId, params);
}

export async function sendInvoice(stripe: Stripe, invoiceId: string): Promise<Stripe.Invoice> {
    return stripe.invoices.sendInvoice(invoiceId);
}

export async function voidInvoice(stripe: Stripe, invoiceId: string): Promise<Stripe.Invoice> {
    return stripe.invoices.voidInvoice(invoiceId);
}

export async function markInvoiceUncollectible(stripe: Stripe, invoiceId: string): Promise<Stripe.Invoice> {
    return stripe.invoices.markUncollectible(invoiceId);
}

export async function searchInvoices(stripe: Stripe, params: Stripe.InvoiceSearchParams): Promise<Stripe.ApiSearchResult<Stripe.Invoice>> {
    return stripe.invoices.search(params);
}

export async function getInvoicePdfUrl(stripe: Stripe, invoiceId: string): Promise<string | null> {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    return invoice.invoice_pdf;
}

// ====================================================================================
// Invoice Line Items API
// ====================================================================================

export async function updateInvoiceLineItem(stripe: Stripe, invoiceId: string, lineItemId: string, params: Stripe.InvoiceUpdateLineItemParams): Promise<Stripe.LineItem> {
    return stripe.invoices.updateLineItem(invoiceId, lineItemId, params);
}

export async function listInvoiceLineItems(stripe: Stripe, invoiceId: string, params?: Stripe.InvoiceListLineItemsParams): Promise<Stripe.ApiList<Stripe.LineItem>> {
    return stripe.invoices.listLineItems(invoiceId, params);
}

// ====================================================================================
// Invoice Items API
// @deprecated
// ====================================================================================

export async function createInvoiceItem(stripe: Stripe, params: Stripe.InvoiceItemCreateParams): Promise<Stripe.InvoiceItem> {
    return stripe.invoiceItems.create(params);
}

export async function retrieveInvoiceItem(stripe: Stripe, invoiceItemId: string): Promise<Stripe.InvoiceItem> {
    return stripe.invoiceItems.retrieve(invoiceItemId);
}

export async function updateInvoiceItem(stripe: Stripe, invoiceItemId: string, params: Stripe.InvoiceItemUpdateParams): Promise<Stripe.InvoiceItem> {
    return stripe.invoiceItems.update(invoiceItemId, params);
}

export async function listInvoiceItems(stripe: Stripe, params?: Stripe.InvoiceItemListParams): Promise<Stripe.ApiList<Stripe.InvoiceItem>> {
    return stripe.invoiceItems.list(params);
}

export async function deleteInvoiceItem(stripe: Stripe, invoiceItemId: string): Promise<Stripe.DeletedInvoiceItem> {
    return stripe.invoiceItems.del(invoiceItemId);
}

// ====================================================================================
// Invoice Rendering Templates API
// ====================================================================================

export async function retrieveInvoiceRenderingTemplate(stripe: Stripe, templateId: string): Promise<Stripe.InvoiceRenderingTemplate> {
    // @ts-ignore
    return stripe.invoiceRenderingTemplates.retrieve(templateId);
}

export async function listInvoiceRenderingTemplates(stripe: Stripe, params?: Stripe.InvoiceRenderingTemplateListParams): Promise<Stripe.ApiList<Stripe.InvoiceRenderingTemplate>> {
    // @ts-ignore
    return stripe.invoiceRenderingTemplates.list(params);
}

// ====================================================================================
// Balance & Balance Transactions API
// ====================================================================================

export async function retrieveBalance(stripe: Stripe): Promise<Stripe.Balance> {
    return stripe.balance.retrieve();
}

export async function retrieveBalanceTransaction(stripe: Stripe, transactionId: string): Promise<Stripe.BalanceTransaction> {
    return stripe.balanceTransactions.retrieve(transactionId);
}

export async function listBalanceTransactions(stripe: Stripe, params?: Stripe.BalanceTransactionListParams): Promise<Stripe.ApiList<Stripe.BalanceTransaction>> {
    return stripe.balanceTransactions.list(params);
}

// ====================================================================================
// Customer Balance Transactions API
// ====================================================================================

export async function createCustomerBalanceTransaction(stripe: Stripe, customerId: string, params: Stripe.CustomerBalanceTransactionCreateParams): Promise<Stripe.CustomerBalanceTransaction> {
    return stripe.customers.createBalanceTransaction(customerId, params);
}

export async function retrieveCustomerBalanceTransaction(stripe: Stripe, customerId: string, transactionId: string): Promise<Stripe.CustomerBalanceTransaction> {
    return stripe.customers.retrieveBalanceTransaction(customerId, transactionId);
}

export async function updateCustomerBalanceTransaction(stripe: Stripe, customerId: string, transactionId: string, params: Stripe.CustomerBalanceTransactionUpdateParams): Promise<Stripe.CustomerBalanceTransaction> {
    return stripe.customers.updateBalanceTransaction(customerId, transactionId, params);
}

export async function listCustomerBalanceTransactions(stripe: Stripe, customerId: string, params?: Stripe.CustomerBalanceTransactionListParams): Promise<Stripe.ApiList<Stripe.CustomerBalanceTransaction>> {
    return stripe.customers.listBalanceTransactions(customerId, params);
}

// ====================================================================================
// Payouts API
// ====================================================================================

export async function createPayout(stripe: Stripe, params: Stripe.PayoutCreateParams): Promise<Stripe.Payout> {
    return stripe.payouts.create(params);
}

export async function retrievePayout(stripe: Stripe, payoutId: string): Promise<Stripe.Payout> {
    return stripe.payouts.retrieve(payoutId);
}

export async function updatePayout(stripe: Stripe, payoutId: string, params: Stripe.PayoutUpdateParams): Promise<Stripe.Payout> {
    return stripe.payouts.update(payoutId, params);
}

export async function listPayouts(stripe: Stripe, params?: Stripe.PayoutListParams): Promise<Stripe.ApiList<Stripe.Payout>> {
    return stripe.payouts.list(params);
}

export async function cancelPayout(stripe: Stripe, payoutId: string): Promise<Stripe.Payout> {
    return stripe.payouts.cancel(payoutId);
}

export async function reversePayout(stripe: Stripe, payoutId: string): Promise<Stripe.Payout> {
    return stripe.payouts.reverse(payoutId);
}

// ====================================================================================
// Webhook Endpoints API
// ====================================================================================

export async function createWebhookEndpoint(stripe: Stripe, params: Stripe.WebhookEndpointCreateParams): Promise<Stripe.WebhookEndpoint> {
    return stripe.webhookEndpoints.create(params);
}

export async function retrieveWebhookEndpoint(stripe: Stripe, webhookEndpointId: string): Promise<Stripe.WebhookEndpoint> {
    return stripe.webhookEndpoints.retrieve(webhookEndpointId);
}

export async function updateWebhookEndpoint(stripe: Stripe, webhookEndpointId: string, params: Stripe.WebhookEndpointUpdateParams): Promise<Stripe.WebhookEndpoint> {
    return stripe.webhookEndpoints.update(webhookEndpointId, params);
}

export async function listWebhookEndpoints(stripe: Stripe, params?: Stripe.WebhookEndpointListParams): Promise<Stripe.ApiList<Stripe.WebhookEndpoint>> {
    return stripe.webhookEndpoints.list(params);
}

export async function deleteWebhookEndpoint(stripe: Stripe, webhookEndpointId: string): Promise<Stripe.DeletedWebhookEndpoint> {
    return stripe.webhookEndpoints.del(webhookEndpointId);
}


// ====================================================================================
// Payment Method Domains API
// ====================================================================================

export async function createPaymentMethodDomain(stripe: Stripe, params: Stripe.PaymentMethodDomainCreateParams): Promise<Stripe.PaymentMethodDomain> {
    return stripe.paymentMethodDomains.create(params);
}

export async function retrievePaymentMethodDomain(stripe: Stripe, domainId: string): Promise<Stripe.PaymentMethodDomain> {
    return stripe.paymentMethodDomains.retrieve(domainId);
}

export async function updatePaymentMethodDomain(stripe: Stripe, domainId: string, params: Stripe.PaymentMethodDomainUpdateParams): Promise<Stripe.PaymentMethodDomain> {
    return stripe.paymentMethodDomains.update(domainId, params);
}

export async function listPaymentMethodDomains(stripe: Stripe, params?: Stripe.PaymentMethodDomainListParams): Promise<Stripe.ApiList<Stripe.PaymentMethodDomain>> {
    return stripe.paymentMethodDomains.list(params);
}

export async function validatePaymentMethodDomain(stripe: Stripe, domainId: string, params?: Stripe.PaymentMethodDomainValidateParams): Promise<Stripe.PaymentMethodDomain> {
    return stripe.paymentMethodDomains.validate(domainId, params);
}
