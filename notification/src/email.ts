// notification/src/email.ts - Amazon SES Only

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

    // Validate required AWS credentials
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials not configured');
    }

    return await sendViaSES(env, {
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      from,
      replyTo
    });
  } catch (error: unknown) {
    console.error('Email sending error:', error instanceof Error ? error.message : String(error));
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

// Direct SES sending via AWS API
async function sendViaSES(env: any, params: EmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const region = env.AWS_REGION || 'us-east-1';
    const host = `email.${region}.amazonaws.com`;
    
    // Prepare the SES SendEmail parameters with proper typing
    const sesPayload: Record<string, string> = {
      Action: 'SendEmail',
      Version: '2010-12-01',
      'Destination.ToAddresses.member.1': params.to,
      'Message.Subject.Data': params.subject,
      'Message.Subject.Charset': 'UTF-8',
      'Message.Body.Text.Data': params.text,
      'Message.Body.Text.Charset': 'UTF-8',
      'Message.Body.Html.Data': params.html,
      'Message.Body.Html.Charset': 'UTF-8',
      'Source': params.from || ''
    };
    
    // Add ReplyTo if specified
    if (params.replyTo && params.replyTo !== params.from) {
      sesPayload['ReplyToAddresses.member.1'] = params.replyTo;
    }
    
    // Convert to query string
    const queryString = Object.keys(sesPayload)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(sesPayload[key])}`)
      .join('&');
    
    // Create AWS signature
    const awsDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = awsDate.substr(0, 8);
    
    const canonicalRequest = [
      'POST',
      '/',
      '',
      `host:${host}`,
      `x-amz-date:${awsDate}`,
      '',
      'host;x-amz-date',
      await sha256(queryString)
    ].join('\n');
    
    const credentialScope = `${dateStamp}/${region}/ses/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      awsDate,
      credentialScope,
      await sha256(canonicalRequest)
    ].join('\n');
    
    const signingKey = await getSignatureKey(env.AWS_SECRET_ACCESS_KEY, dateStamp, region, 'ses');
    const signature = await hmacSha256Hex(signingKey, stringToSign);
    
    const authorization = `AWS4-HMAC-SHA256 Credential=${env.AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=host;x-amz-date, Signature=${signature}`;
    
    // Make the SES API request
    const response = await fetch(`https://${host}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Host': host,
        'X-Amz-Date': awsDate,
        'Authorization': authorization
      },
      body: queryString
    });
    
    const responseText = await response.text();
    
    if (response.status >= 200 && response.status < 300) {
      console.log('SES email sent successfully');
      return { success: true };
    } else {
      console.error('SES sending failed:', response.status, responseText);
      return { success: false, error: `SES Error ${response.status}: ${responseText}` };
    }
    
  } catch (error: any) {
    console.error('SES sending error:', error);
    return { success: false, error: error.message };
  }
}

// AWS signature helper functions
async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(key: Uint8Array, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Raw(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<Uint8Array> {
  const kDate = await hmacSha256Raw(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256Raw(kDate, regionName);
  const kService = await hmacSha256Raw(kRegion, serviceName);
  const kSigning = await hmacSha256Raw(kService, 'aws4_request');
  return kSigning;
}
