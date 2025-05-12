// notification/src/email.ts

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(env: any, params: EmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const from = params.from || env.EMAIL_FROM;
    const replyTo = params.replyTo || from;

    // Use Cloudflare Email Workers
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: params.to }],
          },
        ],
        from: {
          email: from,
          name: 'Portal Notifications',
        },
        subject: params.subject,
        content: [
          {
            type: 'text/plain',
            value: params.text,
          },
          {
            type: 'text/html',
            value: params.html,
          },
        ],
        headers: {
          'Reply-To': replyTo,
        }
      }),
    });

    if (response.status >= 200 && response.status < 300) {
      return { success: true };
    } else {
      const error = await response.text();
      console.error('Email sending failed:', error);
      return { success: false, error };
    }
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
}
