// frontend/src/components/AccountPage.tsx
import { useState, useEffect } from 'react';
import { getProfile, updateProfile, createPortalSession, apiPost } from '../lib/api';
import type { User } from '@portal/shared';
import { ApiError } from '../lib/fetchJson';

function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
      name: '',
      company_name: '',
      email_notifications_enabled: true,
      sms_notifications_enabled: true,
  });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const updatedUser = await updateProfile(formData);
      setUser(updatedUser);
      setSuccess('Profile and notification settings saved!');
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'An unknown error occurred.');
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

    if (isLoading) return <div>Loading account details...</div>;
    if (error && !user) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      <h1 className="text-3xl font-bold mb-6">Your Account</h1>
      {error && <div className="alert alert-danger mb-4">{error}</div>}
      {success && <div className="alert alert-success mb-4">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile & Notifications Card */}
        <div className="card">
          <div className="card-header"><h2 className="card-title">Profile & Notifications</h2></div>
          <div className="card-body">
            <form onSubmit={handleProfileSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="form-label">Full Name</label>
                <input type="text" id="name" name="name" value={formData.name} onChange={handleProfileChange} className="form-control" />
              </div>
              <div className="mb-4">
                <label htmlFor="company_name" className="form-label">Company/Community Name</label>
                <input type="text" id="company_name" name="company_name" value={formData.company_name} onChange={handleProfileChange} className="form-control" />
              </div>

              <div className="border-t border-border-light dark:border-border-dark my-6 pt-6">
                 <h3 className="text-lg font-medium">Notification Preferences</h3>
                 <div className="mt-4 space-y-4">
                    <div className="form-check form-switch">
                        <input className="form-check-input" type="checkbox" role="switch" id="email_notifications_enabled" name="email_notifications_enabled" checked={formData.email_notifications_enabled} onChange={handleProfileChange} />
                        <label className="form-check-label" htmlFor="email_notifications_enabled">Email Notifications</label>
                    </div>
                     <div className="form-check form-switch">
                        <input className="form-check-input" type="checkbox" role="switch" id="sms_notifications_enabled" name="sms_notifications_enabled" checked={formData.sms_notifications_enabled} onChange={handleProfileChange} />
                        <label className="form-check-label" htmlFor="sms_notifications_enabled">SMS Text Notifications</label>
                    </div>
                 </div>
              </div>

              <button type="submit" className="btn btn-primary">Save Changes</button>
            </form>
          </div>
        </div>

        {/* Security Card */}
        <div className="card">
          <div className="card-header"><h2 className="card-title">Security</h2></div>
          <div className="card-body">
             <form onSubmit={handlePasswordSubmit}>
                <div className="mb-4">
                    <label htmlFor="currentPassword">Current Password</label>
                    <input type="password" id="currentPassword" name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} className="form-control" required />
                </div>
                <div className="mb-4">
                    <label htmlFor="newPassword">New Password</label>
                    <input type="password" id="newPassword" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} className="form-control" required minLength={8} />
                </div>
                <div className="mb-4">
                    <label htmlFor="confirmPassword">Confirm New Password</label>
                    <input type="password" id="confirmPassword" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} className="form-control" required />
                </div>
                <button type="submit" className="btn btn-secondary">Change Password</button>
            </form>
          </div>
        </div>
      </div> {/* FIX: This closing div for the grid was missing */}

      {/* Billing Card */}
      <div className="card mt-8">
        <div className="card-header"><h2 className="card-title">Billing</h2></div>
        <div className="card-body">
          <p className="mb-4">Manage your billing information, payment methods, and view your invoice history through our secure payment portal.</p>
          <button onClick={handleBillingPortal} className="btn btn-primary">Manage Billing</button>
        </div>
      </div>
    </div>
  );
}

export default AccountPage;
