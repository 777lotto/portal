// notification/src/templates/invoice.ts

interface InvoiceTemplateData {
  name: string;
  invoiceId: string;
  amount: string;
  dueDate: string;
  invoiceUrl: string;
}

export function generateInvoiceCreatedHtml(data: InvoiceTemplateData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Invoice</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #17a2b8; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .invoice-details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { font-size: 12px; color: #777; text-align: center; margin-top: 20px; }
        .button { display: inline-block; background-color: #17a2b8; color: white; padding: 10px 20px;
                 text-decoration: none; border-radius: 4px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Invoice</h1>
        </div>
        <div class="content">
          <p>Hello ${data.name},</p>
          <p>A new invoice has been created for your recent service.</p>

          <div class="invoice-details">
            <p><strong>Invoice #:</strong> ${data.invoiceId}</p>
            <p><strong>Amount:</strong> $${data.amount}</p>
            <p><strong>Due Date:</strong> ${data.dueDate}</p>
          </div>

          <p>Please click the button below to view and pay your invoice:</p>
          <a href="${data.invoiceUrl}" class="button">View Invoice</a>

          <p>If you have any questions about this invoice, please don't hesitate to contact our support team.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Gutter Portal. All rights reserved.</p>
          <p>This is an automated email, please do not reply directly to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateInvoiceCreatedText(data: InvoiceTemplateData): string {
  return `
Hello ${data.name},

A new invoice has been created for your recent service.

Invoice #: ${data.invoiceId}
Amount: $${data.amount}
Due Date: ${data.dueDate}

Please visit the following link to view and pay your invoice:
${data.invoiceUrl}

If you have any questions about this invoice, please don't hesitate to contact our support team.

© ${new Date().getFullYear()} Gutter Portal. All rights reserved.
This is an automated email, please do not reply directly to this message.
  `;
}

export function generateInvoicePaidHtml(data: InvoiceTemplateData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Confirmation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .invoice-details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { font-size: 12px; color: #777; text-align: center; margin-top: 20px; }
        .button { display: inline-block; background-color: #28a745; color: white; padding: 10px 20px;
                 text-decoration: none; border-radius: 4px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Confirmation</h1>
        </div>
        <div class="content">
          <p>Hello ${data.name},</p>
          <p>Thank you for your payment. We've received your payment for the following invoice:</p>

          <div class="invoice-details">
            <p><strong>Invoice #:</strong> ${data.invoiceId}</p>
            <p><strong>Amount Paid:</strong> $${data.amount}</p>
            <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <p>You can view your receipt and payment history by clicking the button below:</p>
          <a href="${data.invoiceUrl}" class="button">View Receipt</a>

          <p>Thank you for your business!</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Gutter Portal. All rights reserved.</p>
          <p>This is an automated email, please do not reply directly to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateInvoicePaidText(data: InvoiceTemplateData): string {
  return `
Hello ${data.name},

Thank you for your payment. We've received your payment for the following invoice:

Invoice #: ${data.invoiceId}
Amount Paid: $${data.amount}
Payment Date: ${new Date().toLocaleDateString()}

You can view your receipt and payment history here:
${data.invoiceUrl}

Thank you for your business!

© ${new Date().getFullYear()} Gutter Portal. All rights reserved.
This is an automated email, please do not reply directly to this message.
  `;
}
