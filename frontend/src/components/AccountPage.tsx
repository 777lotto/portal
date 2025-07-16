/* ========================================================================
                            IMPORTS & TYPES
   ======================================================================== */
import { useState, useEffect, useMemo } from 'react';
import { getProfile, updateProfile, apiPost, requestPasswordReset, listPaymentMethods, createSetupIntent } from '../lib/api';
import { subscribeUser, unsubscribeUser } from '../lib/push';
import type { User } from '@portal/shared';
import { ApiError } from '../lib/fetchJson';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

/* ========================================================================
                               COMPONENT
   ======================================================================== */

const CheckoutForm = ({ onSuccessfulAdd }: { onSuccessfulAdd: () => void }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const checkDarkMode = () => document.documentElement.classList.contains('dark');
        setIsDarkMode(checkDarkMode());

        const observer = new MutationObserver(() => {
            setIsDarkMode(checkDarkMode());
        });

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, []);

    const cardElementOptions = useMemo(() => ({
        style: {
            base: {
                color: isDarkMode ? '#dee2e6' : '#212529',
                fontFamily: 'system-ui, sans-serif',
                fontSize: '16px',
                '::placeholder': {
                    color: isDarkMode ? '#adb5bd' : '#6c757d',
                },
            },
            invalid: { color: '#fa755a', iconColor: '#fa755a' },
        },
    }), [isDarkMode]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);

        const { clientSecret } = await createSetupIntent();
        const cardElement = elements.getElement(CardElement);

        if (!cardElement) {
            setError("Card element not found");
            setIsProcessing(false);
            return;
        }

        const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
            payment_method: {
                card: cardElement,
            },
        });

        if (error) {
            setError(error.message || 'An unexpected error occurred.');
        } else {
            setError(null);
            onSuccessfulAdd();
        }

        setIsProcessing(false);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="p-3 border rounded-md border-border-light dark:border-border-dark bg-white dark:bg-secondary-dark">
                 <CardElement options={cardElementOptions} />
            </div>
            <button type="submit" className="btn btn-primary mt-4" disabled={!stripe || isProcessing}>
                {isProcessing ? 'Saving...' : 'Save Card'}
            </button>
            {error && <div className="alert alert-danger mt-2">{error}</div>}
        </form>
    );
};

function AccountPage() {

/* ========================================================================
                                 STATE
   ======================================================================== */

  const [user, setUser] = useState<User | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [formData, setFormData] = useState({
      name: '',
      company_name: '',
      email_notifications_enabled: true,
      sms_notifications_enabled: true,
      preferred_contact_method: 'email',
      calendar_reminders_enabled: true,
      calendar_reminder_minutes: 60,
  });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pushState, setPushState] = useState({ isSubscribed: false, isSupported: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{type: 'success'|'danger', text: string} | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);


/* ========================================================================
                                EFFECTS
   ======================================================================== */

  const fetchPaymentMethods = async () => {
    try {
        const methods = await listPaymentMethods();
        setPaymentMethods(methods);
    } catch (err: any) {
        setError(err.message);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const profileData = await getProfile();
        setUser(profileData);
        setFormData({
            name: profileData.name,
            company_name: profileData.company_name || '',
            email_notifications_enabled: profileData.email_notifications_enabled,
            sms_notifications_enabled: profileData.sms_notifications_enabled,
            preferred_contact_method: profileData.preferred_contact_method || 'email',
            calendar_reminders_enabled: profileData.calendar_reminders_enabled ?? true,
            calendar_reminder_minutes: profileData.calendar_reminder_minutes ?? 60,
        });
        fetchPaymentMethods();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushState(prev => ({ ...prev, isSupported: true }));
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setPushState(prev => ({ ...prev, isSubscribed: !!sub }));
        });
      });
    }
  }, []);

  useEffect(() => {
    if (formData.preferred_contact_method === 'email' && !formData.email_notifications_enabled) {
        setFormData(prev => ({ ...prev, email_notifications_enabled: true }));
    } else if (formData.preferred_contact_method === 'sms' && !formData.sms_notifications_enabled) {
        setFormData(prev => ({ ...prev, sms_notifications_enabled: true }));
    }
  }, [formData.preferred_contact_method, formData.email_notifications_enabled, formData.sms_notifications_enabled]);


/* ========================================================================
                                HANDLERS
   ======================================================================== */

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    setFormData(prev => ({
        ...prev,
        [name]: isCheckbox ? checked : value
    }));
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const payload = {
          ...formData,
          calendar_reminder_minutes: Number(formData.calendar_reminder_minutes)
      };
      const updatedUser = await updateProfile(payload);
      setUser(updatedUser);
      setSuccess('Profile and notification settings saved!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  // ... other handlers are unchanged ...
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({type: 'danger', text: "New passwords do not match."});
      return;
    }
    setPasswordMessage(null);
    try {
        await apiPost('/api/profile/change-password', passwordData);
        setPasswordMessage({type: 'success', text: 'Password changed successfully!'});
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setPasswordMessage(null), 5000);
    } catch (err: any) {
        setPasswordMessage({type: 'danger', text: err instanceof ApiError ? err.message : 'An unexpected error occurred.'});
        setTimeout(() => setPasswordMessage(null), 5000);
    }
  };

  const handleRequestResetCode = async (channel: 'email' | 'sms') => {
    if (!user) return;
    const identifier = channel === 'email' ? user.email : user.phone;
    if (!identifier) {
        setPasswordMessage({type: 'danger', text: `You do not have a registered ${channel}.`});
        return;
    }

    setIsSendingCode(true);
    setPasswordMessage(null);
    try {
        await requestPasswordReset(identifier, channel);
        setPasswordMessage({type: 'success', text: `A verification code has been sent. Please use the "Forgot Password" option on the login page to complete the password change.`})
    } catch (err: any) {
        setPasswordMessage({type: 'danger', text: (err as Error).message});
    } finally {
        setIsSendingCode(false);
    }
  }

  const handleTogglePush = async () => {
    setError(null);
    setSuccess(null);
    try {
      if (pushState.isSubscribed) {
        await unsubscribeUser();
        setPushState(prev => ({ ...prev, isSubscribed: false }));
        setSuccess("You have been unsubscribed from web notifications.");
      } else {
        await subscribeUser();
        setPushState(prev => ({ ...prev, isSubscribed: true }));
        setSuccess("Successfully subscribed to web notifications!");
      }
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || "An error occurred with push notifications.");
       setTimeout(() => setError(null), 5000);
    }
  };

/* ========================================================================
                             RENDER LOGIC
   ======================================================================== */

  if (isLoading) return <div className="text-center p-8">Loading account details...</div>;
  if (error && !user) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container max-w-7xl mx-auto mt-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-text-secondary-light dark:text-text-secondary-dark">Manage your profile, security, and notification preferences.</p>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}
      {success && <div className="alert alert-success mb-4">{success}</div>}

      <form onSubmit={handleSettingsSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Column 1 */}
          <div className="space-y-8">
              {/* Profile Card */}
              <div className="card">
                  <div className="card-header"><h2 className="card-title text-xl">Profile</h2></div>
                  <div className="card-body space-y-4">
                      <div>
                        <label htmlFor="name" className="form-label">Full Name</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="form-control" />
                      </div>
                      <div>
                        <label htmlFor="company_name" className="form-label">Company/Community Name</label>
                        <input type="text" id="company_name" name="company_name" value={formData.company_name || ''} onChange={handleChange} className="form-control" />
                      </div>
                  </div>
              </div>

            {/* Calendar Settings Card */}
            <div className="card">
                <div className="card-header"><h2 className="card-title text-xl">Calendar Settings</h2></div>
                <div className="card-body space-y-4">
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Customize your external calendar feed.</p>
                    <div className="form-switch">
                        <input className="form-check-input" type="checkbox" role="switch" id="calendar_reminders_enabled" name="calendar_reminders_enabled" checked={formData.calendar_reminders_enabled} onChange={handleChange} />
                        <label className="form-check-label ml-3" htmlFor="calendar_reminders_enabled">Enable Calendar Reminders</label>
                    </div>
                    <div>
                        <label htmlFor="calendar_reminder_minutes" className="form-label">Reminder Time</label>
                        <select id="calendar_reminder_minutes" name="calendar_reminder_minutes" className="form-control" value={formData.calendar_reminder_minutes} onChange={handleChange} disabled={!formData.calendar_reminders_enabled}>
                            <option value="15">15 minutes before</option>
                            <option value="30">30 minutes before</option>
                            <option value="60">1 hour before</option>
                            <option value="120">2 hours before</option>
                            <option value="1440">1 day before</option>
                        </select>
                    </div>
                </div>
            </div>

             {/* Billing Card */}
              {user?.role === 'customer' && (
                  <div className="card">
                      <div className="card-header"><h2 className="card-title text-xl">Payment Methods</h2></div>
                      <div className="card-body">
                          {paymentMethods.map(pm => (
                              <div key={pm.id} className="flex justify-between items-center p-2 border-b">
                                  <span>{pm.card.brand} **** {pm.card.last4}</span>
                                  <span>Exp: {pm.card.exp_month}/{pm.card.exp_year}</span>
                              </div>
                          ))}
                          {showAddPaymentMethod ? (
                              <div className="mt-4">
                                <CheckoutForm onSuccessfulAdd={() => {
                                    setShowAddPaymentMethod(false);
                                    fetchPaymentMethods();
                                }} />
                              </div>
                          ) : (
                              <button type="button" onClick={() => setShowAddPaymentMethod(true)} className="btn btn-secondary mt-4">
                                  Add Payment Method
                              </button>
                          )}
                      </div>
                  </div>
              )}
          </div>

          {/* Column 2 */}
          <div className="space-y-8">
              {/* Notification Preferences Card */}
              <div className="card">
                   <div className="card-header"><h2 className="card-title text-xl">Notification Preferences</h2></div>
                   <div className="card-body space-y-6">
                       <div>
                           <label className="form-label font-medium">Preferred Contact Method</label>
                           <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2">We'll use this for important alerts. This method cannot be disabled.</p>
                           <div className="flex gap-4">
                               <div className="form-check">
                                   <input className="form-check-input" type="radio" name="preferred_contact_method" id="contact_email" value="email" checked={formData.preferred_contact_method === 'email'} onChange={handleChange} />
                                   <label className="form-check-label" htmlFor="contact_email">Email</label>
                               </div>
                                <div className="form-check">
                                   <input className="form-check-input" type="radio" name="preferred_contact_method" id="contact_sms" value="sms" checked={formData.preferred_contact_method === 'sms'} onChange={handleChange} disabled={!user?.phone}/>
                                   <label className="form-check-label" htmlFor="contact_sms">SMS {user?.phone ? '' : '(No number on file)'}</label>
                               </div>
                           </div>
                       </div>
                        <div className="space-y-4">
                           <label className="form-label font-medium">Notification Channels</label>
                           <div className="form-switch">
                               <input className="form-check-input" type="checkbox" role="switch" id="email_notifications_enabled" name="email_notifications_enabled" checked={formData.email_notifications_enabled} onChange={handleChange} disabled={formData.preferred_contact_method === 'email'} />
                               <label className="form-check-label ml-3" htmlFor="email_notifications_enabled">Email Notifications</label>
                               {formData.preferred_contact_method === 'email' && <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark ml-3">Cannot be disabled for preferred contact method.</p>}
                           </div>
                            <div className="form-switch">
                               <input className="form-check-input" type="checkbox" role="switch" id="sms_notifications_enabled" name="sms_notifications_enabled" checked={formData.sms_notifications_enabled} onChange={handleChange} disabled={!user?.phone || formData.preferred_contact_method === 'sms'}/>
                               <label className="form-check-label ml-3" htmlFor="sms_notifications_enabled">SMS Text Notifications</label>
                                {formData.preferred_contact_method === 'sms' && <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark ml-3">Cannot be disabled for preferred contact method.</p>}
                           </div>
                            {pushState.isSupported && (
                               <div className="form-switch">
                                   <input className="form-check-input" type="checkbox" role="switch" id="web_notifications_enabled" checked={pushState.isSubscribed} onChange={handleTogglePush} />
                                   <label className="form-check-label ml-3" htmlFor="web_notifications_enabled">Web Push Notifications</label>
                               </div>
                            )}
                        </div>
                   </div>
              </div>

               {/* Security Card */}
               <div className="card">
                <div className="card-header"><h2 className="card-title text-xl">Security</h2></div>
                <div className="card-body">
                   <form onSubmit={handlePasswordSubmit}>
                      <div className="space-y-4">
                          {passwordMessage && <div className={`alert alert-${passwordMessage.type}`}>{passwordMessage.text}</div>}
                          <div>
                              <label htmlFor="currentPassword">Current Password</label>
                              <input type="password" id="currentPassword" name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} className="form-control" required autoComplete="current-password"/>
                          </div>
                          <div>
                              <label htmlFor="newPassword">New Password</label>
                              <input type="password" id="newPassword" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} className="form-control" required minLength={8} autoComplete="new-password"/>
                          </div>
                          <div>
                              <label htmlFor="confirmPassword">Confirm New Password</label>
                              <input type="password" id="confirmPassword" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} className="form-control" required autoComplete="new-password"/>
                          </div>
                      </div>
                      <button type="submit" className="btn btn-secondary mt-6">Change Password</button>
                  </form>
                  <hr className="my-6 border-border-light dark:border-border-dark" />
                  <div className="space-y-4">
                      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">If you've forgotten your current password, you can request a one-time code to reset it.</p>
                      <div className="flex flex-col space-y-2">
                          <button type="button" onClick={() => handleRequestResetCode('email')} className="btn btn-secondary" disabled={isSendingCode || !user?.email}>
                              {isSendingCode ? 'Sending...' : 'Send Code to Email'}
                          </button>
                          <button type="button" onClick={() => handleRequestResetCode('sms')} className="btn btn-secondary" disabled={isSendingCode || !user?.phone}>
                              {isSendingCode ? 'Sending...' : 'Send Code via Text'}
                          </button>
                      </div>
                  </div>
                </div>
              </div>
          </div>
        </div>
        <div className="mt-8 flex justify-end">
            <button type="submit" className="btn btn-primary btn-lg">Save All Settings</button>
        </div>
      </form>
    </div>
  );
}


/* ========================================================================
                                EXPORT
   ======================================================================== */

export default AccountPage;
