/* ========================================================================
                            IMPORTS & TYPES
   ======================================================================== */
import { useState, useEffect } from 'react';
import { getProfile, updateProfile, createPortalSession, apiPost, requestPasswordReset } from '../lib/api';
import { subscribeUser, unsubscribeUser } from '../lib/push';
import type { User } from '@portal/shared';
import { ApiError } from '../lib/fetchJson';


/* ========================================================================
                               COMPONENT
   ======================================================================== */

function AccountPage() {

/* ========================================================================
                                 STATE
   ======================================================================== */

  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
      name: '',
      company_name: '',
      email_notifications_enabled: true,
      sms_notifications_enabled: true,
      preferred_contact_method: 'email'
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

  useEffect(() => {
    // Fetch user profile on initial load
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
            preferred_contact_method: profileData.preferred_contact_method || 'email'
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();

    // Check for push notification support and subscription status
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushState(prev => ({ ...prev, isSupported: true }));
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setPushState(prev => ({ ...prev, isSubscribed: !!sub }));
        });
      });
    }
  }, []);

  // When preferred contact method changes, ensure the corresponding toggle is enabled.
  useEffect(() => {
    if (formData.preferred_contact_method === 'email') {
        if (!formData.email_notifications_enabled) {
            setFormData(prev => ({ ...prev, email_notifications_enabled: true }));
        }
    } else if (formData.preferred_contact_method === 'sms') {
        if (!formData.sms_notifications_enabled) {
            setFormData(prev => ({ ...prev, sms_notifications_enabled: true }));
        }
    }
  }, [formData.preferred_contact_method, formData.email_notifications_enabled, formData.sms_notifications_enabled]);


/* ========================================================================
                                HANDLERS
   ======================================================================== */

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    // Assert the target is a checkbox to access 'checked' property
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
      const updatedUser = await updateProfile(formData);
      setUser(updatedUser);
      setSuccess('Profile and notification settings saved!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setError(null);
    setSuccess(null);
    try {
        await apiPost('/api/profile/change-password', passwordData);
        setSuccess('Password changed successfully!');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'An unknown error occurred.');
        setTimeout(() => setError(null), 5000);
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

  const handleBillingPortal = async () => {
    setError(null);
    setSuccess(null);
    try {
      const session = await createPortalSession();
      window.location.href = session.url;
    } catch (err: any) {
      setError(err.message);
    }
  };

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

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    try {
      const updatedUser = await updateProfile({
        name: formData.name,
        company_name: formData.company_name
      });
      setUser(updatedUser); // Update local user state
      setProfileMessage({type: 'success', text: 'Profile updated successfully!'});
    } catch (err: any) {
      setProfileMessage({type: 'danger', text: err.message});
    }
  }


/* ========================================================================
                             RENDER LOGIC
   ======================================================================== */

  if (isLoading) return <div className="text-center p-8">Loading account details...</div>;
  if (error && !user) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
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
                      {profileMessage && <div className={`alert alert-${profileMessage.type}`}>{profileMessage.text}</div>}
                      <div>
                        <label htmlFor="name" className="form-label">Full Name</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleProfileChange} className="form-control" />
                      </div>
                      <div>
                        <label htmlFor="company_name" className="form-label">Company/Community Name</label>
                        <input type="text" id="company_name" name="company_name" value={formData.company_name || ''} onChange={handleProfileChange} className="form-control" />
                      </div>
                      {/* ADDED: New Save button for this card */}
                      <div className="pt-2 flex justify-end">
                        <button type="button" onClick={handleProfileSave} className="btn btn-secondary">Save Profile</button>
                      </div>
                  </div>
              </div>

              {/* Billing Card */}
              {user?.role === 'customer' && (
              <div className="card">
                <div className="card-header"><h2 className="card-title text-xl">Billing</h2></div>
                <div className="card-body">
                  <p className="mb-4">Manage your billing information, payment methods, and view your invoice history through our secure payment portal.</p>
                  <button type="button" onClick={handleBillingPortal} className="btn btn-primary">Manage Billing</button>
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
                                   <input className="form-check-input" type="radio" name="preferred_contact_method" id="contact_email" value="email" checked={formData.preferred_contact_method === 'email'} onChange={handleProfileChange} />
                                   <label className="form-check-label" htmlFor="contact_email">Email</label>
                               </div>
                                <div className="form-check">
                                   <input className="form-check-input" type="radio" name="preferred_contact_method" id="contact_sms" value="sms" checked={formData.preferred_contact_method === 'sms'} onChange={handleProfileChange} disabled={!user?.phone}/>
                                   <label className="form-check-label" htmlFor="contact_sms">SMS {user?.phone ? '' : '(No number on file)'}</label>
                               </div>
                           </div>
                       </div>
                        <div className="space-y-4">
                           <label className="form-label font-medium">Notification Channels</label>
                           <div className="form-switch">
                               <input className="form-check-input" type="checkbox" role="switch" id="email_notifications_enabled" name="email_notifications_enabled" checked={formData.email_notifications_enabled} onChange={handleProfileChange} disabled={formData.preferred_contact_method === 'email'} />
                               <label className="form-check-label ml-3" htmlFor="email_notifications_enabled">Email Notifications</label>
                               {formData.preferred_contact_method === 'email' && <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark ml-3">Cannot be disabled for preferred contact method.</p>}
                           </div>
                            <div className="form-switch">
                               <input className="form-check-input" type="checkbox" role="switch" id="sms_notifications_enabled" name="sms_notifications_enabled" checked={formData.sms_notifications_enabled} onChange={handleProfileChange} disabled={!user?.phone || formData.preferred_contact_method === 'sms'}/>
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
                      {passwordMessage && <div className={`p-4 mb-4 rounded-md border ${passwordMessage.type === 'success' ? 'bg-green-50 border-green-300 text-green-800 dark:bg-green-900/20 dark:border-green-500/30 dark:text-green-300' : 'bg-red-50 border-red-300 text-red-800 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-300'}`}>{passwordMessage.text}</div>}
                      <div className="flex flex-col space-y-2">
                          <button onClick={() => handleRequestResetCode('email')} className="btn btn-secondary" disabled={isSendingCode || !user?.email}>
                              {isSendingCode ? 'Sending...' : 'Send Code to Email'}
                          </button>
                          <button onClick={() => handleRequestResetCode('sms')} className="btn btn-secondary" disabled={isSendingCode || !user?.phone}>
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
