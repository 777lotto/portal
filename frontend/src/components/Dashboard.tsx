// 777lotto/portal/portal-bet/frontend/src/components/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProfile, getJobs, getServices, updateProfile, requestPasswordReset } from '../lib/api.js';
import type { User, Job, Service } from '@portal/shared';

function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [profileData, setProfileData] = useState<Partial<User>>({});
  const [profileMessage, setProfileMessage] = useState<{type: 'success'|'danger', text: string} | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{type: 'success'|'danger', text: string} | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([]);
  const [recentServices, setRecentServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [profileDataResponse, jobsData, servicesData] = await Promise.all([
          getProfile(),
          getJobs(),
          getServices(),
        ]);
        setUser(profileDataResponse);
        setProfileData(profileDataResponse);
        setUpcomingJobs(jobsData.filter((j: Job) => new Date(j.start) > new Date()).slice(0, 5));
        setRecentServices(servicesData.slice(0, 5));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboard();
  }, []);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileMessage(null);
    try {
      const updatedUser = await updateProfile(profileData);
      setUser(updatedUser);
      setProfileData(updatedUser);
      setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setProfileMessage({ type: 'danger', text: err.message || 'An error occurred.' });
    } finally {
      setIsUpdatingProfile(false);
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
          setPasswordMessage({type: 'danger', text: err.message});
      } finally {
          setIsSendingCode(false);
      }
  }

  if (isLoading) return <div className="text-center p-8">Loading dashboard...</div>;
  if (error) return <div className="rounded-md bg-event-red/10 p-4 text-sm text-event-red">{error}</div>;

  return (
    <div className="mx-auto max-w-7xl">
      <header>
        {user && <h1 className="text-3xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark mb-6">Welcome, {user.name}!</h1>}
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming Jobs Card */}
        <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg p-6 border border-border-light dark:border-border-dark">
          <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">Upcoming Jobs</h3>
          <div className="space-y-3">
            {upcomingJobs.length > 0 ? (
              upcomingJobs.map(job => (
                <Link key={job.id} to={`/jobs/${job.id}`} className="block p-3 rounded-md transition text-text-secondary-light dark:text-text-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark">
                  {job.title} - {new Date(job.start).toLocaleString()}
                </Link>
              ))
            ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No upcoming jobs.</p>}
          </div>
        </div>
        {/* Recent Services Card */}
        <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg p-6 border border-border-light dark:border-border-dark">
          <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">Recent Services</h3>
          <div className="space-y-3">
            {recentServices.length > 0 ? (
              recentServices.map(service => (
                <Link key={service.id} to={`/services/${service.id}`} className="block p-3 rounded-md transition text-text-secondary-light dark:text-text-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark">
                  Service on {new Date(service.service_date).toLocaleDateString()}
                </Link>
              ))
            ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No recent services.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Profile Settings Card */}
        <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg p-6 border border-border-light dark:border-border-dark">
            <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">Profile Settings</h3>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
                 <div>
                    <label htmlFor="name" className="block text-sm font-medium">Name</label>
                    <input type="text" name="name" id="name" value={profileData.name || ''} onChange={handleProfileChange} className="form-control mt-1" />
                </div>
                 <div>
                    <label htmlFor="company_name" className="block text-sm font-medium">Company/Community Name</label>
                    <input type="text" name="company_name" id="company_name" value={profileData.company_name || ''} onChange={handleProfileChange} className="form-control mt-1" />
                </div>
                 <div>
                    <label htmlFor="email" className="block text-sm font-medium">Email</label>
                    <input type="email" name="email" id="email" value={profileData.email || ''} onChange={handleProfileChange} className="form-control mt-1" />
                </div>
                 <div>
                    <label htmlFor="phone" className="block text-sm font-medium">Phone</label>
                    <input type="tel" name="phone" id="phone" value={profileData.phone || ''} onChange={handleProfileChange} className="form-control mt-1" />
                </div>
                {profileMessage && <div className={`p-4 mb-4 rounded-md border ${profileMessage.type === 'success' ? 'bg-green-50 border-green-300 text-green-800 dark:bg-green-900/20 dark:border-green-500/30 dark:text-green-300' : 'bg-red-50 border-red-300 text-red-800 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-300'}`}>{profileMessage.text}</div>}
                <div>
                    <button type="submit" className="btn btn-primary" disabled={isUpdatingProfile}>
                        {isUpdatingProfile ? 'Updating...' : 'Update Profile'}
                    </button>
                </div>
            </form>
        </div>

        {/* Security Settings Card */}
        <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg p-6 border border-border-light dark:border-border-dark">
             <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">Security Settings</h3>
             <div className="space-y-4">
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">To change your password, we'll send a one-time verification code to your registered email or phone.</p>
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
  );
}

export default Dashboard;
