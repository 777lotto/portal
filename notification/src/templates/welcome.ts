// notification/src/templates/welcome.ts

interface WelcomeTemplateData {
  name: string;
}

export function generateHtml(data: WelcomeTemplateData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to 777 Solutions LLC</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #6c757d; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .steps { margin: 20px 0; }
        .step { margin-bottom: 10px; }
        .footer { font-size: 12px; color: #777; text-align: center; margin-top: 20px; }
        .button { display: inline-block; background-color: #6c757d; color: white; padding: 10px 20px;
                 text-decoration: none; border-radius: 4px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to 777 Solutions LLC!</h1>
        </div>
        <div class="content">
          <p>Hello ${data.name},</p>
          <p>Thank you for creating an account with 777 Solutions LLC. We're excited to have you on board!</p>

          <p>With your new account, you can:</p>
          <div class="steps">
            <div class="step">• Schedule gutter cleaning and maintenance services</div>
            <div class="step">• View upcoming appointments</div>
            <div class="step">• Pay invoices online</div>
            <div class="step">• Access your service history</div>
          </div>

          <p>To get started, simply click the button below to access your dashboard:</p>
          <a href="https://portal.777.foo/dashboard" class="button">Go to Dashboard</a>

          <p>If you have any questions or need assistance, our support team is here to help.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} 777 Solutions LLC. All rights reserved.</p>
          <p>You received this email because you created an account on 777 Solutions' online customer portal.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateText(data: WelcomeTemplateData): string {
  return `
Hi ${data.name},

Thank you for creating an account with 777 Solutions LLC. We're excited to have you on board!

To get started, visit your dashboard at:
https://portal.777.foo/dashboard
  `;
}
