// notification/src/templates/quote.ts

interface QuoteCreatedData {
  name: string;
  quoteUrl: string;
}

interface QuoteAcceptedData {
    adminName: string;
    customerName: string;
    quoteId: string;
}

export function generateQuoteCreatedHtml(data: QuoteCreatedData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Your Quote is Ready</title></head>
    <body>
      <p>Hello ${data.name},</p>
      <p>Your quote from 777 Solutions LLC is ready for your review.</p>
      <p>Please click the button below to view the details and accept the quote:</p>
      <a href="${data.quoteUrl}" class="button">View Quote</a>
    </body>
    </html>
  `;
}

export function generateQuoteAcceptedHtml(data: QuoteAcceptedData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Quote Accepted</title></head>
    <body>
      <p>Hello ${data.adminName},</p>
      <p>The quote <strong>#${data.quoteId}</strong> for customer <strong>${data.customerName}</strong> has been accepted.</p>
      <p>You can now proceed with scheduling the job.</p>
    </body>
    </html>
  `;
}
