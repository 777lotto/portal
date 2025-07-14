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
      // Note: This field would need to be added to the User schema and database
      // to be persisted. For now, it's UI-only.
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
            // @ts-ignore - Assuming 'email' is the default if not set
            preferred_contact_method: profileData.preferred_contact_method || 'email'
        });
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
      const { name, company_name, email_notifications_enabled, sms_notifications_enabled } = formData;
      const updatedUser = await updateProfile({ name, company_name, email_notifications_enabled, sms_notifications_enabled });
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
      <h1 className="text-3xl font-bold mb-6">Your Account</h1>
      {error && <div className="alert alert-danger mb-4">{error}</div>}
      {success && <div className="alert alert-success mb-4">{success}</div>}

      <form onSubmit={handleSettingsSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
            {/* Profile Card */}
            <div className="card">
              <div className="card-header"><h2 className="card-title">Profile Settings</h2></div>
              <div className="card-body">
                <div className="mb-4">
                  <label htmlFor="name" className="form-label">Full Name</label>
                  <input type="text" id="name" name="name" value={formData.name} onChange={handleProfileChange} className="form-control" />
                </div>
                <div className="mb-4">
                  <label htmlFor="company_name" className="form-label">Company/Community Name</label>
                  <input type="text" id="company_name" name="company_name" value={formData.company_name} onChange={handleProfileChange} className="form-control" />
                </div>
              </div>
            </div>

            {/* Notification Preferences Card */}
            <div className="card">
               <div className="card-header"><h2 className="card-title">Notification Preferences</h2></div>
                <div className="card-body">
                    <div className="mb-6">
                        <label className="form-label font-medium">Preferred Contact Method</label>
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2">We'll use this method for important, non-marketing communications.</p>
                        <div className="flex gap-4">
                            <div className="form-check">
                                <input className="form-check-input" type="radio" name="preferred_contact_method" id="contact_email" value="email" checked={formData.preferred_contact_method === 'email'} onChange={handleProfileChange} />
                                <label className="form-check-label" htmlFor="contact_email">Email ({user?.email})</label>
                            </div>
                             <div className="form-check">
                                <input className="form-check-input" type="radio" name="preferred_contact_method" id="contact_sms" value="sms" checked={formData.preferred_contact_method === 'sms'} onChange={handleProfileChange} disabled={!user?.phone}/>
                                <label className="form-check-label" htmlFor="contact_sms">Text Message (SMS) {user?.phone ? `(${user.phone})` : '(No number on file)'}</label>
                            </div>
                        </div>
                    </div>
                     <div className="space-y-4">
                        <label className="form-label font-medium">Enable/Disable Notifications</label>
                        <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" role="switch" id="email_notifications_enabled" name="email_notifications_enabled" checked={formData.email_notifications_enabled} onChange={handleProfileChange} />
                            <label className="form-check-label" htmlFor="email_notifications_enabled">Email Notifications</label>
                        </div>
                         <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" role="switch" id="sms_notifications_enabled" name="sms_notifications_enabled" checked={formData.sms_notifications_enabled} onChange={handleProfileChange} disabled={!user?.phone}/>
                            <label className="form-check-label" htmlFor="sms_notifications_enabled">SMS Text Notifications</label>
                        </div>
                         {pushState.isSupported && (
                            <div className="form-check form-switch">
                                <input className="form-check-input" type="checkbox" role="switch" id="web_notifications_enabled" checked={pushState.isSubscribed} onChange={handleTogglePush} />
                                <label className="form-check-label" htmlFor="web_notifications_enabled">Web Push Notifications</label>
                            </div>
                         )}
                     </div>
                </div>
            </div>

             <button type="submit" className="btn btn-primary w-full lg:w-auto">Save All Settings</button>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
            {/* Security Card */}
            <div className="card">
              <div className="card-header"><h2 className="card-title">Security</h2></div>
              <div className="card-body">
                 <form onSubmit={handlePasswordSubmit}>
                    <div className="mb-4">
                        <label htmlFor="currentPassword">Current Password</label>
                        <input type="password" id="currentPassword" name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} className="form-control" required autoComplete="current-password"/>
                    </div>
                    <div className="mb-4">
                        <label htmlFor="newPassword">New Password</label>
                        <input type="password" id="newPassword" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} className="form-control" required minLength={8} autoComplete="new-password"/>
                    </div>
                    <div className="mb-4">
                        <label htmlFor="confirmPassword">Confirm New Password</label>
                        <input type="password" id="confirmPassword" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} className="form-control" required autoComplete="new-password"/>
                    </div>
                    <button type="submit" className="btn btn-secondary">Change Password</button>
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
      </form>
    </div>
  );
}


/* ========================================================================
                                EXPORT
   ======================================================================== */

export default AccountPage;
