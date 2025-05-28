// notification/src/email.ts - Fixed with better credential validation and error handling

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}

interface NotificationEnv {
  EMAIL_FROM: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
}

export async function sendEmail(env: NotificationEnv, params: EmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const from = params.from || env.EMAIL_FROM;
    const replyTo = params.replyTo || from;

    // Validate required AWS credentials with better error messages
    if (!env.AWS_ACCESS_KEY_ID) {
      throw new Error('AWS_ACCESS_KEY_ID not configured');
    }
    
    if (!env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS_SECRET_ACCESS_KEY not configured');
    }

    // Validate credential format (basic checks)
    if (env.AWS_ACCESS_KEY_ID.length < 16 || env.AWS_ACCESS_KEY_ID.length > 128) {
      throw new Error('AWS_ACCESS_KEY_ID appears to be invalid format');
    }
    
    if (env.AWS_SECRET_ACCESS_KEY.length < 20 || env.AWS_SECRET_ACCESS_KEY.length > 128) {
      throw new Error('AWS_SECRET_ACCESS_KEY appears to be invalid format');
    }

    // Check for placeholder values that might cause header errors
    const invalidValues = ['****', '***', 'YOUR_KEY_HERE', 'PLACEHOLDER', ''];
    if (invalidValues.includes(env.AWS_ACCESS_KEY_ID) || invalidValues.includes(env.AWS_SECRET_ACCESS_KEY)) {
      throw new Error('AWS credentials contain placeholder or invalid values');
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Email sending error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Direct SES sending via AWS API with improved error handling
async function sendViaSES(env: NotificationEnv, params: EmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const region = env.AWS_REGION || 'us-east-1';
    const host = `email.${region}.amazonaws.com`;
    
    // Validate all parameters before proceeding
    if (!params.to || !params.subject || !params.from) {
      throw new Error('Missing required email parameters');
    }

    // Additional validation for AWS credentials at runtime
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials not available');
    }

    // Prepare the SES SendEmail parameters with proper typing and validation
    const sesPayload: Record<string, string> = {
      Action: 'SendEmail',
      Version: '2010-12-01',
      'Destination.ToAddresses.member.1': params.to.trim(),
      'Message.Subject.Data': params.subject.trim(),
      'Message.Subject.Charset': 'UTF-8',
      'Message.Body.Text.Data': params.text.trim(),
      'Message.Body.Text.Charset': 'UTF-8',
      'Message.Body.Html.Data': params.html.trim(),
      'Message.Body.Html.Charset': 'UTF-8',
      'Source': params.from.trim()
    };
    
    // Add ReplyTo if specified and different from source
    if (params.replyTo && params.replyTo !== params.from) {
      sesPayload['ReplyToAddresses.member.1'] = params.replyTo.trim();
    }
    
    // Convert to query string with proper URL encoding
    const queryString = Object.keys(sesPayload)
      .sort()
      .map(key => {
        const value = sesPayload[key];
        if (!value) return null;
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .filter(Boolean)
      .join('&');
    
    // Create AWS signature
    const now = new Date();
    const awsDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
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
    
    // Make the SES API request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(`https://${host}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Host': host,
          'X-Amz-Date': awsDate,
          'Authorization': authorization
        },
        body: queryString,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseText = await response.text();
      
      if (response.status >= 200 && response.status < 300) {
        console.log('SES email sent successfully to:', params.to);
        return { success: true };
      } else {
        console.error('SES sending failed:', response.status, responseText);
        
        // Parse SES error response for better error messages
        let errorMessage = `SES Error ${response.status}`;
        if (responseText.includes('<Error>')) {
          const codeMatch = responseText.match(/<Code>([^<]+)<\/Code>/);
          const messageMatch = responseText.match(/<Message>([^<]+)<\/Message>/);
          if (codeMatch && messageMatch) {
            errorMessage = `${codeMatch[1]}: ${messageMatch[1]}`;
          }
        }
        
        return { success: false, error: errorMessage };
      }
    } finally {
      clearTimeout(timeoutId);
    }
    
  } catch (error: any) {
    console.error('SES sending error:', error);
    
    if (error.name === 'AbortError') {
      return { success: false, error: 'Email sending timeout' };
    }
    
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// AWS signature helper functions with better error handling
async function sha256(message: string): Promise<string> {
  try {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    throw new Error(`SHA256 hashing failed: ${error}`);
  }
}

async function hmacSha256Hex(key: Uint8Array, message: string): Promise<string> {
  try {
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
  } catch (error) {
    throw new Error(`HMAC signing failed: ${error}`);
  }
}

async function hmacSha256Raw(key: Uint8Array, message: string): Promise<Uint8Array> {
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
    return new Uint8Array(signature);
  } catch (error) {
    throw new Error(`HMAC raw signing failed: ${error}`);
  }
}

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<Uint8Array> {
  try {
    const kDate = await hmacSha256Raw(new TextEncoder().encode('AWS4' + key), dateStamp);
    const kRegion = await hmacSha256Raw(kDate, regionName);
    const kService = await hmacSha256Raw(kRegion, serviceName);
    const kSigning = await hmacSha256Raw(kService, 'aws4_request');
    return kSigning;
  } catch (error) {
    throw new Error(`AWS signature key generation failed: ${error}`);
  }
}
