// frontend/src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { jwtDecode } from 'jwt-decode';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import SupportChatWidget from './components/chat/SupportChatWidget.js';

// --- Page Components ---
import Navbar from "./components/Navbar.js";
import Dashboard from "./components/Dashboard.js";
import UnifiedCalendar from './components/UnifiedCalendar.js';
const JobDetail = lazy(() => import("./components/JobDetail.js"));
const QuoteProposalPage = lazy(() => import("./components/QuoteProposalPage.js"));
const CalendarSync = lazy(() => import("./components/CalendarSync.js"));
const Photos = lazy(() => import("./components/Photos.js"));
const AccountPage = lazy(() => import("./components/AccountPage.js"));
const AuthForm = lazy(() => import("./components/forms/AuthForm.js"));
const InvoicePaymentPage = lazy(() => import("./components/InvoicePaymentPage.js"));

// --- Admin Page Components ---
const AdminDashboard = lazy(() => import("./components/admin/AdminDashboard.js"));
const AdminUserDetail = lazy(() => import("./components/admin/AdminUserDetail.js"));
const JobsPage = lazy(() => import("./components/admin/JobsPage.js"));
const ChatPage = lazy(() => import("./pages/ChatPage.js"));


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
    <div className="min-h-screen bg-primary-light dark:bg-secondary-dark">
      <Navbar token={token} user={user} setToken={handleSetToken} />
      <main className="p-4 sm:p-6 lg:p-8">
        <Elements stripe={stripePromise}>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* --- Public Routes --- */}
              <Route path="/booking" element={<BookingPage />} />
              <Route path="/auth" element={token ? <Navigate to="/dashboard" replace /> : <AuthForm setToken={handleSetToken} />} />
              <Route path="/" element={<Navigate to={token ? "/dashboard" : "/auth"} replace />} />

              {/* --- Customer-facing Routes --- */}
              <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/auth" replace />} />
              <Route path="/calendar" element={token ? <UnifiedCalendar /> : <Navigate to="/auth" replace />} />
              <Route path="/photos" element={token ? <Photos /> : <Navigate to="/auth" replace />} />
              <Route path="/jobs/:id" element={token ? <JobDetail /> : <Navigate to="/auth" replace />} />
              <Route path="/quotes/:quoteId" element={token ? <QuoteProposalPage /> : <Navigate to="/auth" replace />} />
              <Route path="/calendar-sync" element={token ? <CalendarSync /> : <Navigate to="/auth" replace />} />
              <Route path="/account" element={token ? <AccountPage /> : <Navigate to="/auth" replace />} />
              <Route path="/pay-invoice/:invoiceId" element={token ? <InvoicePaymentPage /> : <Navigate to="/auth" replace />} />
              <Route path="/chat" element={token ? <ChatPage /> : <Navigate to="/auth" replace />} />
              

              {/* --- Admin Routes --- */}
              <Route
                path="/admin/users"
                element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/dashboard" replace />}
              />
              <Route
                path="/admin/users/:user_id"
                element={user?.role === 'admin' ? <AdminUserDetail /> : <Navigate to="/dashboard" replace />}
              />
              <Route
                path="/admin/jobs"
                element={user?.role === 'admin' ? <JobsPage /> : <Navigate to="/dashboard" replace />}
              />
              <Route
                path="/admin/jobs/:id"
                element={user?.role === 'admin' ? <JobDetail /> : <Navigate to="/dashboard" replace />}
              />

              {/* --- Catch-all redirect --- */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Elements>
      </main>
    </div>
  );
}

export default App;
