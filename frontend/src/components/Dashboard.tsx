// frontend/src/components/Dashboard.tsx - CORRECTED
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, getJobs, getServices } from '../lib/api.js';
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
        const [profileData, jobsData, servicesData] = await Promise.all([
          getProfile(),
          getJobs(),
          getServices(),
        ]);
        setUser(profileData);
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

  if (isLoading) return <div className="container mt-4">Loading dashboard...</div>;
  if (error) return <div className="container mt-4 alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      {user && <h1>Welcome, {user.name}!</h1>}
      <div className="row mt-4">
        <div className="col-md-6">
          <h3>Upcoming Jobs</h3>
          <div className="list-group">
            {upcomingJobs.length > 0 ? (
              upcomingJobs.map(job => (
                <Link key={job.id} to={`/jobs/${job.id}`} className="list-group-item list-group-item-action">
                  {job.title} - {new Date(job.start).toLocaleString()}
                </Link>
              ))
            ) : <p>No upcoming jobs.</p>}
          </div>
        </div>
        <div className="col-md-6">
          <h3>Recent Services</h3>
          <div className="list-group">
            {recentServices.length > 0 ? (
              recentServices.map(service => (
                <Link key={service.id} to={`/services/${service.id}`} className="list-group-item list-group-item-action">
                  Service on {new Date(service.service_date).toLocaleDateString()}
                </Link>
              ))
            ) : <p>No recent services.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
