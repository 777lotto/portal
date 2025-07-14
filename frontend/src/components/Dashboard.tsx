// 777lotto/portal/portal-bet/frontend/src/components/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, getJobs, getServices, adminGetAllJobs, adminGetAllServices } from '../lib/api.js';
import type { User, Job, Service } from '@portal/shared';

function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([]);
  const [recentServices, setRecentServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // MODIFICATION: Logic now splits based on user role
        const profileData = await getProfile();
        setUser(profileData);

        if (profileData.role === 'admin') {
          const [jobsData, servicesData] = await Promise.all([
            adminGetAllJobs(),
            adminGetAllServices(),
          ]);
          setUpcomingJobs(jobsData.filter((j: Job) => new Date(j.start) > new Date()).slice(0, 10)); // Show more for admin
          setRecentServices(servicesData.slice(0, 10)); // Show more for admin
        } else {
          // Existing customer logic
          const [jobsData, servicesData] = await Promise.all([
            getJobs(),
            getServices(),
          ]);
          setUpcomingJobs(jobsData.filter((j: Job) => new Date(j.start) > new Date()).slice(0, 5));
          setRecentServices(servicesData.slice(0, 5));
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboard();
  }, []);

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
          {/* MODIFICATION: Dynamic title */}
          <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">
            {user?.role === 'admin' ? "All Upcoming Jobs" : "Your Upcoming Jobs"}
          </h3>
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
          {/* MODIFICATION: Dynamic title */}
          <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">
             {user?.role === 'admin' ? "All Recent Services" : "Your Recent Services"}
          </h3>
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
    </div>
  );
}

export default Dashboard;
