// notification/src/templates/pastDue.ts

interface PastDueTemplateData {
  name: string;
  invoiceId: string;
  invoiceUrl: string;
}

export function generatePastDueHtml(data: PastDueTemplateData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice Past Due</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dc3545; border-radius: 8px; }
        .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; }
        .content { padding: 20px; }
        .footer { font-size: 12px; color: #777; text-align: center; margin-top: 20px; }
        .button { display: inline-block; background-color: #dc3545; color: white; padding: 10px 20px;
                 text-decoration: none; border-radius: 4px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Action Required: Invoice Past Due</h1>
        </div>
        <div class="content">
          <p>Hello ${data.name},</p>
          <p>This is a reminder that your invoice <strong>#${data.invoiceId}</strong> is now past due. To avoid any interruption in service, please submit your payment as soon as possible.</p>
          <p>You can view and pay the invoice by clicking the button below:</p>
          <a href="${data.invoiceUrl}" class="button">Pay Invoice Now</a>
          <p>If you have already made this payment, please disregard this email. If you have any questions, please don't hesitate to contact us.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} 777 Solutions LLC. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generatePastDueText(data: PastDueTemplateData): string {
  return `
Hello ${data.name},

ACTION REQUIRED: INVOICE PAST DUE

#${data.invoiceId} is now past due.
You can view and pay the invoice here:
${data.invoiceUrl}

  `;
}
