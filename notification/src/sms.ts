// notification/src/sms.ts

interface SMSParams {
  to: string;
  message: string;
  from?: string;
}

export async function sendSMS(env: any, params: SMSParams): Promise<{ success: boolean; error?: string }> {
  try {
    const from = params.from || env.SMS_FROM_NUMBER;

    // Use voip.ms API
    const voipmsUrl = new URL('https://voip.ms/api/v1/rest.php');
    voipmsUrl.searchParams.append('api_username', env.VOIPMS_USERNAME);
    voipmsUrl.searchParams.append('api_password', env.VOIPMS_PASSWORD);
    voipmsUrl.searchParams.append('method', 'sendSMS');
    voipmsUrl.searchParams.append('did', from);
    voipmsUrl.searchParams.append('dst', params.to);
    voipmsUrl.searchParams.append('message', params.message);

    const response = await fetch(voipmsUrl.toString(), {
      method: 'GET',
    });

    const result = await response.json();

    if (result.status === 'success') {
      return { success: true };
    } else {
      console.error('SMS sending failed:', result.status);
      return { success: false, error: result.status };
    }
  } catch (error) {
    console.error('SMS sending error:', error);
    return { success: false, error: error.message };
  }
}
