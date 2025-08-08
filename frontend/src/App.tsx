// frontend/src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { jwtDecode } from 'jwt-decode';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Using the '@' alias for cleaner, more reliable imports
import SupportChatWidget from '@/components/chat/SupportChatWidget';
import Navbar from "@/pages/Navbar";
import CustomerDashboard from "@/pages/Dashboard";
import UnifiedCalendar from '@/pages/UnifiedCalendar';

// --- Lazy-loaded Page Components using the '@' alias ---
const BookingPage = lazy(() => import("@/pages/BookingPage"));
const JobInfo = lazy(() => import('@/pages/JobInfo'));
const QuoteProposalPage = lazy(() => import("@/pages/QuoteProposalPage"));
const CalendarSync = lazy(() => import("@/components/forms/CalendarSync"));
const Photos = lazy(() => import("@/pages/Photos"));
const AccountPage = lazy(() => import("@/pages/AccountPage"));
const AuthForm = lazy(() => import("@/components/forms/AuthForm"));
const InvoicePaymentPage = lazy(() => import("@/pages/InvoicePaymentPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));

// --- Lazy-loaded Admin Page Components using the '@' alias ---
const AdminDashboard = lazy(() => import("@/admin/pages/adminDashboard.tsx"));
const UserListPage = lazy(() => import("@/pages/admin/UserListPage"));
const UserDetailPage = lazy(() => import("@/pages/admin/UserDetailPage"));
const JobsPage = lazy(() => import("@/pages/admin/JobsPage"));
const JobDetail = lazy(() => import("@/pages/admin/JobDetail"));
const AdminPhotos = lazy(() => import('@/admin/pages/adminPhotos'));


interface UserPayload {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'admin';
}

function LoadingFallback() {
  return <div className="p-8 text-center">Loading...</div>;
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PK);

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserPayload | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const useDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (useDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const initializeApp = async () => {
      try {
        const storedToken = localStorage.getItem("token");
        setToken(storedToken);

        if (storedToken) {
          try {
            const decodedUser = jwtDecode<UserPayload>(storedToken);
            setUser(decodedUser);
          } catch (error) {
            console.error("Invalid token:", error);
            localStorage.removeItem("token");
            setToken(null);
            setUser(null);
          }
        }

      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  const handleSetToken = (newToken: string | null) => {
    setToken(newToken);
    if (newToken) {
      localStorage.setItem("token", newToken);
      try {
        setUser(jwtDecode<UserPayload>(newToken));
      } catch (error) {
        console.error("Failed to decode new token:", error);
        setUser(null);
      }
    } else {
      localStorage.removeItem("token");
      setUser(null);
    }
  };

  if (!isReady) {
    return <LoadingFallback />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar token={token} user={user} setToken={handleSetToken} />
      <main className="p-4 sm:p-6 lg:p-8">
        <Elements stripe={stripePromise}>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* --- Public Routes --- */}
              <Route path="/booking" element={<BookingPage />} />
              <Route path="/auth" element={token ? <Navigate to="/dashboard" replace /> : <AuthForm setToken={handleSetToken} />} />
              <Route path="/" element={<Navigate to={token ? "/dashboard" : "/auth"} replace />} />

              {/* --- Role-based Dashboard Routing --- */}
              <Route
                path="/dashboard"
                element={
                  token ?
                    (user?.role === 'admin' ? <Navigate to="/admin/dashboard" replace /> : <CustomerDashboard />)
                    : <Navigate to="/auth" replace />
                }
              />

              {/* --- Customer-facing Routes --- */}
              <Route path="/calendar" element={token ? <UnifiedCalendar /> : <Navigate to="/auth" replace />} />
              <Route path="/photos" element={token ? <Photos /> : <Navigate to="/auth" replace />} />
              <Route path="/jobs/:id" element={token ? <JobInfo /> : <Navigate to="/auth" replace />} />
              <Route path="/quotes/:quoteId" element={token ? <QuoteProposalPage /> : <Navigate to="/auth" replace />} />
              <Route path="/calendar-sync" element={token ? <CalendarSync /> : <Navigate to="/auth" replace />} />
              <Route path="/account" element={token ? <AccountPage /> : <Navigate to="/auth" replace />} />
              <Route path="/pay-invoice/:invoiceId" element={token ? <InvoicePaymentPage /> : <Navigate to="/auth" replace />} />
              <Route path="/chat" element={token ? <ChatPage /> : <Navigate to="/auth" replace />} />

              {/* --- Admin Routes --- */}
              <Route
                path="/admin/dashboard"
                element={user?.role === 'admin' ? <adminDashboard /> : <Navigate to="/dashboard" replace />}
              />
              <Route
                path="/admin/users"
                element={user?.role === 'admin' ? <UserListPage /> : <Navigate to="/dashboard" replace />}
              />
              <Route
                path="/admin/users/:user_id"
                element={user?.role === 'admin' ? <UserDetailPage /> : <Navigate to="/dashboard" replace />}
              />
              <Route
                path="/admin/jobs"
                element={user?.role === 'admin' ? <JobsPage /> : <Navigate to="/dashboard" replace />}
              />
              <Route
                path="/admin/jobs/:id"
                element={user?.role === 'admin' ? <JobDetail /> : <Navigate to="/dashboard" replace />}
              />
              <Route
                path="/admin/photos"
                element={user?.role === 'admin' ? <adminPhotos /> : <Navigate to="/dashboard" replace />}
              />

              {/* --- Catch-all redirect --- */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Elements>
      </main>
      {user && <SupportChatWidget user={user} />}
    </div>
  );
}

export default App;
