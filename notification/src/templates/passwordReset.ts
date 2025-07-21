// notification/src/templates/passwordReset.ts

interface PasswordResetTemplateData {
  name: string;
  resetCode: string;
}

export function generatePasswordResetHtml(data: PasswordResetTemplateData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your Verification Code</title>
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: auto; padding: 20px; }
        .header { background-color: #ffc107; color: white; padding: 10px; text-align: center; }
        .button { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        .footer { font-size: 12px; color: #777; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h2>Your Verification Code</h2></div>
        <p>Hello ${data.name},</p>
        <p>We received a request to reset your password. Enter the code below to set a new password:</p>
        <div class="code">${data.resetCode}</div>
        <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} 777 Solutions LLC. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generatePasswordResetText(data: PasswordResetTemplateData): string {
  return `
Hi ${data.name},

${data.resetCode}

This code will expire in 10 minutes.

  `;
}
