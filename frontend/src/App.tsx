// frontend/src/App.tsx

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useSWR, { SWRConfig } from 'swr';

// Hooks and Libs
import { useAuth } from './hooks/useAuth';
import { getProfile, apiGet } from './lib/api';

// Page Components
import Navbar from './pages/Navbar';
import AdminNavbar from './pages/admin/Navbar';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import AccountPage from './pages/AccountPage';
import BookingPage from './pages/BookingPage';
import ChatPage from './pages/ChatPage';
import JobInfo from './pages/JobInfo';
import Photos from './pages/Photos';
import InvoicePaymentPage from './pages/InvoicePaymentPage';
import QuoteProposalPage from './pages/QuoteProposalPage';

// Admin Page Components
import UserListPage from './pages/admin/UserListPage';
import UserDetailPage from './pages/admin/UserDetailPage';
import UserJobsPage from './pages/admin/UserJobsPage';
import UserNotesPage from './pages/admin/UserNotesPage';
import UserPhotosPage from './pages/admin/UserPhotosPage';
import JobsPage from './pages/admin/JobsPage';
import JobDetail from './pages/admin/JobDetail';
import UnifiedCalendar from './pages/UnifiedCalendar';
import AdminChatDashboard from './pages/admin/AdminChatDashboard';

// Form Components
import AuthForm from './components/forms/AuthForm';
import ForgotPasswordForm from './components/forms/ForgotPasswordForm';
import SetPasswordForm from './components/forms/SetPasswordForm';
import VerifyCodeForm from './components/forms/VerifyCodeForm';

// Other Components
import SupportChatWidget from './components/chat/SupportChatWidget';

// Types
import type { User } from '@portal/shared';

/**
 * The main application component. It handles routing and authentication state,
 * directing users to the appropriate interface (customer or admin) based on their role.
 */
function App() {
  const { token, setToken, loading: authLoading } = useAuth();

  // Fetch user profile if a token exists.
  const { data: user, error, isLoading: userLoading } = useSWR<User>(token ? 'profile' : null, getProfile, {
    shouldRetryOnError: false, // Don't retry on auth errors (e.g., 401)
  });

  // If profile fetch fails (e.g., invalid token), log the user out.
  useEffect(() => {
    if (error) {
      setToken(null);
    }
  }, [error, setToken]);

  // Show a loading indicator while checking auth state or fetching the user profile.
  if (authLoading || (token && userLoading)) {
    return <div className="flex justify-center items-center h-screen bg-background-light dark:bg-background-dark">Loading...</div>;
  }

  return (
      <SWRConfig value={{ fetcher: apiGet }}>
          <BrowserRouter>
              <Routes>
                  {/* Public routes accessible without authentication */}
                  <Route path="/login" element={!token ? <AuthForm setToken={setToken} /> : <Navigate to="/" />} />
                  <Route path="/forgot-password" element={<ForgotPasswordForm />} />
                  <Route path="/set-password" element={<SetPasswordForm />} />
                  <Route path="/verify-code" element={<VerifyCodeForm />} />
                  <Route path="/pay-invoice/:invoiceId" element={<InvoicePaymentPage />} />
                  <Route path="/quotes/:jobId" element={<QuoteProposalPage />} />

                  {/* Authenticated routes.
                    The '/*' wildcard directs all authenticated traffic here.
                    The component then renders either the Admin or Customer app based on the user's role.
                  */}
                  <Route path="/*" element={
                    !token ? (
                      <Navigate to="/login" />
                    ) : user ? (
                      user.role === 'admin'
                        ? <AdminApp token={token} setToken={setToken} user={user} />
                        : <CustomerApp token={token} setToken={setToken} user={user} />
                    ) : (
                      // This state occurs briefly while user is loading
                      <div className="flex justify-center items-center h-screen">Loading...</div>
                    )
                  } />
              </Routes>
          </BrowserRouter>
      </SWRConfig>
  );
}

/**
 * Wrapper component for the entire customer-facing application.
 * It includes the customer navbar and defines all customer routes.
 */
const CustomerApp = ({ token, setToken, user }: { token: string | null, setToken: (t: string | null) => void, user: User }) => (
  <div className="min-h-screen bg-background-light dark:bg-background-dark">
    <Navbar token={token} setToken={setToken} user={user} />
    <main>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/jobs" element={<Photos />} />
        <Route path="/jobs/:jobId" element={<JobInfo />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </main>
    <SupportChatWidget />
  </div>
);

/**
 * Wrapper component for the entire admin-facing application.
 * It includes the admin navbar and defines all admin routes.
 */
const AdminApp = ({ token, setToken, user }: { token: string | null, setToken: (t: string | null) => void, user: User }) => (
  <div className="min-h-screen bg-background-light dark:bg-background-dark">
    <AdminNavbar token={token} setToken={setToken} user={user} />
    <main>
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/users" element={<UserListPage />} />
        <Route path="/users/:userId" element={<UserDetailPage />} />
        <Route path="/users/:userId/jobs" element={<UserJobsPage />} />
        <Route path="/users/:userId/notes" element={<UserNotesPage />} />
        <Route path="/users/:userId/photos" element={<UserPhotosPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/calendar" element={<UnifiedCalendar />} />
        <Route path="/chat" element={<AdminChatDashboard />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </main>
  </div>
);

export default App;
