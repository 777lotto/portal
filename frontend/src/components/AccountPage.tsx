/* ========================================================================
                            IMPORTS & TYPES
   ======================================================================== */
import { useState, useEffect } from 'react';
import { getProfile, updateProfile, createPortalSession, apiPost } from '../lib/api';
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

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
             {/* Profile & Notifications Card */}
            <div className="card">
                <form onSubmit={handleSettingsSubmit} className="divide-y divide-border-light dark:divide-border-dark">
                    {/* Profile Section */}
                    <div className="p-6">
                        <h2 className="text-xl font-semibold">Profile</h2>
                        <div className="mt-4 space-y-4">
                            <div>
                              <label htmlFor="name" className="form-label">Full Name</label>
                              <input type="text" id="name" name="name" value={formData.name} onChange={handleProfileChange} className="form-control" />
                            </div>
                            <div>
                              <label htmlFor="company_name" className="form-label">Company/Community Name</label>
                              <input type="text" id="company_name" name="company_name" value={formData.company_name} onChange={handleProfileChange} className="form-control" />
                            </div>
                        </div>
                    </div>

                    {/* Notification Preferences Section */}
                    <div className="p-6">
                        <h2 className="text-xl font-semibold">Notification Preferences</h2>
                        <div className="mt-4 space-y-6">
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
                    <div className="p-6 bg-secondary-light/50 dark:bg-secondary-dark/20">
                         <button type="submit" className="btn btn-primary">Save Settings</button>
                    </div>
                </form>
            </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
            {/* Security Card */}
            <div className="card">
              <div className="card-header"><h2 className="card-title">Security</h2></div>
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
              </div>
            </div>

            {/* Billing Card */}
            <div className="card">
              <div className="card-header"><h2 className="card-title">Billing</h2></div>
              <div className="card-body">
                <p className="mb-4">Manage your billing information, payment methods, and view your invoice history through our secure payment portal.</p>
                <button type="button" onClick={handleBillingPortal} className="btn btn-primary">Manage Billing</button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}


/* ========================================================================
                                EXPORT
   ======================================================================== */

export default AccountPage;
