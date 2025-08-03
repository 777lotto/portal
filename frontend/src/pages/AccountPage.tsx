// frontend/src/pages/AccountPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { subscribeUser, unsubscribeUser } from '../lib/push';
import type { User, PaymentMethod, UpdateProfilePayload } from '@portal/shared';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { handleApiError } from '../lib/utils'; // Assuming a utility for consistent error handling

// --- REFACTORED: Data Fetching Functions ---

const fetchProfile = async (): Promise<User> => {
  const res = await api.profile.$get();
  if (!res.ok) throw await handleApiError(res, 'Failed to fetch profile');
  const data = await res.json();
  return data.user;
};

const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const res = await api.profile['payment-methods'].$get();
  if (!res.ok) throw await handleApiError(res, 'Failed to fetch payment methods');
  const data = await res.json();
  return data.paymentMethods;
};

// --- REFACTORED: CheckoutForm Component ---

const CheckoutForm = ({ onSuccessfulAdd }: { onSuccessfulAdd: () => void }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isDarkMode, setIsDarkMode] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        const checkDarkMode = () => document.documentElement.classList.contains('dark');
        setIsDarkMode(checkDarkMode());
        const observer = new MutationObserver(() => setIsDarkMode(checkDarkMode()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const cardElementOptions = useMemo(() => ({
        style: {
            base: {
                color: isDarkMode ? '#dee2e6' : '#212529',
                fontFamily: 'system-ui, sans-serif',
                fontSize: '16px',
                '::placeholder': { color: isDarkMode ? '#adb5bd' : '#6c757d' },
            },
            invalid: { color: '#fa755a', iconColor: '#fa755a' },
        },
    }), [isDarkMode]);

    const addPaymentMethodMutation = useMutation({
        mutationFn: async () => {
            if (!stripe || !elements) throw new Error("Stripe is not initialized.");
            const res = await api.profile['setup-intent'].$post({});
            if (!res.ok) throw await handleApiError(res, 'Could not create setup intent.');
            const { clientSecret } = await res.json();

            const cardElement = elements.getElement(CardElement);
            if (!cardElement) throw new Error("Card element not found");

            const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
                payment_method: { card: cardElement },
            });

            if (stripeError) throw new Error(stripeError.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
            onSuccessfulAdd();
        },
        onError: (error: Error) => {
            // You can use a toast library here for better UX
            alert(`Error: ${error.message}`);
        }
    });

    const handleSubmit = (event: React.SyntheticEvent) => {
        event.preventDefault();
        addPaymentMethodMutation.mutate();
    };

    return (
        <div>
            <div className="p-3 border rounded-md border-border-light dark:border-border-dark bg-white dark:bg-secondary-dark">
                 <CardElement options={cardElementOptions} />
            </div>
            <button type="button" onClick={handleSubmit} className="btn btn-primary mt-4" disabled={!stripe || addPaymentMethodMutation.isPending}>
                {addPaymentMethodMutation.isPending ? 'Saving...' : 'Save Card'}
            </button>
            {addPaymentMethodMutation.error && <div className="alert alert-danger mt-2">{addPaymentMethodMutation.error.message}</div>}
        </div>
    );
};


// --- REFACTORED: Main AccountPage Component ---

function AccountPage() {
  const queryClient = useQueryClient();
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [formData, setFormData] = useState<Partial<UpdateProfilePayload>>({});
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pushState, setPushState] = useState({ isSubscribed: false, isSupported: false });
  const [message, setMessage] = useState<{type: 'success'|'danger', text: string} | null>(null);

  // --- REFACTORED: Data fetching with useQuery ---
  const { data: user, isLoading: isProfileLoading, error: profileError } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: fetchPaymentMethods,
    enabled: !!user && user.role !== 'admin',
  });

  // --- REFACTORED: Mutations for updates ---
  const updateProfileMutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => api.profile.$put({ json: payload }),
    onSuccess: (res) => {
        if (!res.ok) return handleApiError(res, 'Failed to update profile').then(err => { throw err });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        setMessage({ type: 'success', text: 'Profile and notification settings saved!' });
    },
    onError: (error: Error) => setMessage({ type: 'danger', text: error.message }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (payload: typeof passwordData) => api.profile['change-password'].$post({ json: payload }),
    onSuccess: (res) => {
        if (!res.ok) return handleApiError(res, 'Failed to change password').then(err => { throw err });
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (error: Error) => setMessage({ type: 'danger', text: error.message }),
  });

  const requestResetCodeMutation = useMutation({
    mutationFn: (channel: 'email' | 'sms') => {
        const identifier = channel === 'email' ? user?.email : user?.phone;
        if (!identifier) throw new Error(`You do not have a registered ${channel}.`);
        return api['request-password-reset'].$post({ json: { identifier, channel } });
    },
    onSuccess: (res) => {
        if (!res.ok) return handleApiError(res, 'Failed to send reset code').then(err => { throw err });
        setMessage({ type: 'success', text: `A verification code has been sent. Please use the "Forgot Password" option on the login page to complete the password change.` });
    },
    onError: (error: Error) => setMessage({ type: 'danger', text: error.message }),
  });

  const pushNotificationMutation = useMutation({
    mutationFn: async () => {
        if (pushState.isSubscribed) {
            await unsubscribeUser();
            return { subscribed: false };
        } else {
            await subscribeUser();
            return { subscribed: true };
        }
    },
    onSuccess: (data) => {
        setPushState(prev => ({ ...prev, isSubscribed: data.subscribed }));
        setMessage({ type: 'success', text: data.subscribed ? "Successfully subscribed to web notifications!" : "You have been unsubscribed from web notifications." });
    },
    onError: (error: Error) => setMessage({ type: 'danger', text: error.message || "An error occurred with push notifications." }),
  });

  // --- Effect to populate form when user data loads ---
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        company_name: user.company_name || '',
        email_notifications_enabled: user.email_notifications_enabled,
        sms_notifications_enabled: user.sms_notifications_enabled,
        preferred_contact_method: user.preferred_contact_method || 'email',
        calendar_reminders_enabled: user.calendar_reminders_enabled ?? true,
        calendar_reminder_minutes: user.calendar_reminder_minutes ?? 60,
      });
    }
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushState(prev => ({ ...prev, isSupported: true }));
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setPushState(prev => ({ ...prev, isSubscribed: !!sub }));
        });
      });
    }
  }, [user]);

  // --- Event Handlers ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;
    setFormData(prev => ({ ...prev, [name]: isCheckbox ? checked : value }));
  };

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const payload = { ...formData, calendar_reminder_minutes: Number(formData.calendar_reminder_minutes) } as UpdateProfilePayload;
    updateProfileMutation.mutate(payload);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({type: 'danger', text: "New passwords do not match."});
      return;
    }
    setMessage(null);
    changePasswordMutation.mutate(passwordData);
  };

  if (isProfileLoading) return <div className="text-center p-8">Loading account details...</div>;
  if (profileError) return <div className="alert alert-danger">{(profileError as Error).message}</div>;
  if (!user) return <div className="alert alert-danger">Could not load user profile.</div>

  return (
    <div className="container max-w-7xl mx-auto mt-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-text-secondary-light dark:text-text-secondary-dark">Manage your profile, security, and notification preferences.</p>
      </div>

      {message && <div className={`alert alert-${message.type} mb-4`}>{message.text}</div>}

      <form onSubmit={handleSettingsSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Column 1 */}
          <div className="space-y-8">
              <div className="card">
                  <div className="card-header"><h2 className="card-title text-xl">Profile</h2></div>
                  <div className="card-body space-y-4">
                      <div>
                        <label htmlFor="name" className="form-label">Full Name</label>
                        <input type="text" id="name" name="name" value={formData.name || ''} onChange={handleChange} className="form-control" />
                      </div>
                      <div>
                        <label htmlFor="company_name" className="form-label">Company/Community Name</label>
                        <input type="text" id="company_name" name="company_name" value={formData.company_name || ''} onChange={handleChange} className="form-control" />
                      </div>
                  </div>
              </div>

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

              {user?.role !== 'admin' && (
                  <div className="card">
                      <div className="card-header"><h2 className="card-title text-xl">Payment Methods</h2></div>
                      <div className="card-body">
                          {paymentMethods?.map(pm => (
                              <div key={pm.id} className="flex justify-between items-center p-2 border-b">
                                  <span>{pm.brand} **** {pm.last4}</span>
                                  <span>Exp: {pm.exp_month}/{pm.exp_year}</span>
                              </div>
                          ))}
                          {showAddPaymentMethod ? (
                              <div className="mt-4">
                                <CheckoutForm onSuccessfulAdd={() => setShowAddPaymentMethod(false)} />
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
                                   <input className="form-check-input" type="checkbox" role="switch" id="web_notifications_enabled" checked={pushState.isSubscribed} onChange={() => pushNotificationMutation.mutate()} disabled={pushNotificationMutation.isPending} />
                                   <label className="form-check-label ml-3" htmlFor="web_notifications_enabled">Web Push Notifications</label>
                               </div>
                            )}
                        </div>
                   </div>
              </div>

               <div className="card">
                <div className="card-header"><h2 className="card-title text-xl">Security</h2></div>
                <div className="card-body">
                   <div>
                      <div className="space-y-4">
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
                      <button type="button" onClick={handlePasswordSubmit} className="btn btn-secondary mt-6" disabled={changePasswordMutation.isPending}>
                        {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                      </button>
                  </div>
                  <hr className="my-6 border-border-light dark:border-border-dark" />
                  <div className="space-y-4">
                      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">If you've forgotten your current password, you can request a one-time code to reset it.</p>
                      <div className="flex flex-col space-y-2">
                          <button type="button" onClick={() => requestResetCodeMutation.mutate('email')} className="btn btn-secondary" disabled={requestResetCodeMutation.isPending || !user?.email}>
                              {requestResetCodeMutation.isPending ? 'Sending...' : 'Send Code to Email'}
                          </button>
                          <button type="button" onClick={() => requestResetCodeMutation.mutate('sms')} className="btn btn-secondary" disabled={requestResetCodeMutation.isPending || !user?.phone}>
                              {requestResetCodeMutation.isPending ? 'Sending...' : 'Send Code via Text'}
                          </button>
                      </div>
                  </div>
                </div>
              </div>
          </div>
        </div>
        <div className="mt-8 flex justify-end">
            <button type="submit" className="btn btn-primary btn-lg" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? 'Saving...' : 'Save All Settings'}
            </button>
        </div>
      </form>
    </div>
  );
}

export default AccountPage;
