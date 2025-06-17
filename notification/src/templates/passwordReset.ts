// notification/src/templates/passwordReset.ts

interface PasswordResetTemplateData {
  name: string;
  resetLink: string;
}

export function generatePasswordResetHtml(data: PasswordResetTemplateData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Password Reset Request</title>
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
        <div class="header"><h2>Password Reset Request</h2></div>
        <p>Hello ${data.name},</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <a href="${data.resetLink}" class="button">Reset Your Password</a>
        <p>This link will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Gutter Portal. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generatePasswordResetText(data: PasswordResetTemplateData): string {
  return `
Hello ${data.name},

We received a request to reset your password. Please visit the following link to set a new password:
${data.resetLink}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

© ${new Date().getFullYear()} Gutter Portal. All rights reserved.
  `;
}
