// notification/src/templates/appointment.ts

interface AppointmentTemplateData {
  name: string;
  date: string;
  time: string;
  serviceType: string;
  address?: string;
}

export function generateConfirmationHtml(data: AppointmentTemplateData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Confirmation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { font-size: 12px; color: #777; text-align: center; margin-top: 20px; }
        .button { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px;
                 text-decoration: none; border-radius: 4px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Appointment Confirmed</h1>
        </div>
        <div class="content">
          <p>Hello ${data.name},</p>
          <p>Your appointment for <strong>${data.serviceType}</strong> has been confirmed.</p>
          <p><strong>Date:</strong> ${data.date}</p>
          <p><strong>Time:</strong> ${data.time}</p>
          ${data.address ? `<p><strong>Address:</strong> ${data.address}</p>` : ''}
          <p>We look forward to serving you. If you need to reschedule or cancel your appointment,
             please log in to your account or contact us at least 24 hours in advance.</p>
          <a href="https://portal.777.foo/dashboard" class="button">View in Portal</a>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} 777 Solutions LLC. All rights reserved.</p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateConfirmationText(data: AppointmentTemplateData): string {
  return `
Hello ${data.name},

Your appointment for ${data.serviceType} has been confirmed.

Date: ${data.date}
Time: ${data.time}
${data.address ? `Address: ${data.address}` : ''}

We look forward to serving you. If you need to reschedule or cancel your appointment,
please log in to your account or contact us at least 24 hours in advance.

Visit https://portal.777.foo/dashboard to manage your appointments.

© ${new Date().getFullYear()} 777 Solutions LLC. All rights reserved.
  `;
}

export function generateReminderHtml(data: AppointmentTemplateData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Reminder</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { font-size: 12px; color: #777; text-align: center; margin-top: 20px; }
        .button { display: inline-block; background-color: #28a745; color: white; padding: 10px 20px;
                 text-decoration: none; border-radius: 4px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Appointment Reminder</h1>
        </div>
        <div class="content">
          <p>Hello ${data.name},</p>
          <p>This is a friendly reminder about your upcoming appointment for <strong>${data.serviceType}</strong>.</p>
          <p><strong>Date:</strong> ${data.date}</p>
          <p><strong>Time:</strong> ${data.time}</p>
          ${data.address ? `<p><strong>Address:</strong> ${data.address}</p>` : ''}
          <p>We're looking forward to seeing you. If you need to reschedule, please contact us as soon as possible.</p>
          <a href="https://portal.777.foo/dashboard" class="button">View in Portal</a>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} 777 Solutions LLC. All rights reserved.</p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateReminderText(data: AppointmentTemplateData): string {
  return `
Hello ${data.name},

This is a friendly reminder about your upcoming appointment for ${data.serviceType}.

Date: ${data.date}
Time: ${data.time}
${data.address ? `Address: ${data.address}` : ''}

We're looking forward to seeing you. If you need to reschedule, please contact us as soon as possible.

Visit https://portal.777.foo/dashboard to manage your appointments.

© ${new Date().getFullYear()} 777 Solutions LLC. All rights reserved.
  `;
}
