import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useAuth } from "./hooks/useAuth";

// --- Page Components ---
import Navbar from "./pages/Navbar";
import Dashboard from "./pages/Dashboard";
import UnifiedCalendar from './pages/UnifiedCalendar';
const BookingPage = lazy(() => import("./pages/BookingPage"));
const JobInfo = lazy(() => import('./pages/JobInfo'));
const JobDetail = lazy(() => import("./pages/admin/JobDetail"));
const QuoteProposalPage = lazy(() => import("./pages/QuoteProposalPage"));
const CalendarSync = lazy(() => import("./components/forms/CalendarSync"));
const Photos = lazy(() => import("./pages/Photos"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const AuthForm = lazy(() => import("./components/forms/AuthForm"));
const InvoicePaymentPage = lazy(() => import("./pages/InvoicePaymentPage"));

// --- Admin Page Components ---
const UserListPage = lazy(() => import("./pages/admin/UserListPage"));
const UserDetailPage = lazy(() => import("./pages/admin/UserDetailPage"));
const JobsPage = lazy(() => import("./pages/admin/JobsPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));

function LoadingFallback() {
  return (
    <div className="flex justify-center items-center h-screen">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  );
}

// Initialize Stripe outside of the component to avoid re-creating it on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PK);

// A wrapper for routes that require authentication.
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingFallback />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
}

// A wrapper for admin-only routes.
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <LoadingFallback />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

function App() {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Effect for managing the dark mode theme.
  useEffect(() => {
    const useDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle('dark', useDark);
  }, []);

  // Show a loading spinner while the initial authentication check is in progress.
  if (isLoading) {
    return <LoadingFallback />;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Navbar />
      <main className="p-4 sm:p-6 lg:p-8">
        <Elements stripe={stripePromise}>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* --- Public Routes --- */}
              <Route path="/booking" element={<BookingPage />} />
              <Route path="/auth" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthForm />} />

              {/* --- Authenticated Routes --- */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><UnifiedCalendar /></ProtectedRoute>} />
              <Route path="/photos" element={<ProtectedRoute><Photos /></ProtectedRoute>} />
              <Route path="/jobs/:id" element={<ProtectedRoute><JobInfo /></ProtectedRoute>} />
              <Route path="/quotes/:quoteId" element={<ProtectedRoute><QuoteProposalPage /></ProtectedRoute>} />
              <Route path="/calendar-sync" element={<ProtectedRoute><CalendarSync /></ProtectedRoute>} />
              <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
              <Route path="/pay-invoice/:invoiceId" element={<ProtectedRoute><InvoicePaymentPage /></ProtectedRoute>} />
              <Route path="/chat"  element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

              {/* --- Admin Routes --- */}
              <Route path="/admin/users" element={<AdminRoute><UserListPage /></AdminRoute>} />
              <Route path="/admin/users/:user_id" element={<AdminRoute><UserDetailPage /></AdminRoute>} />
              <Route path="/admin/jobs" element={<AdminRoute><JobsPage /></AdminRoute>} />
              <Route path="/admin/jobs/:id" element={<AdminRoute><JobDetail /></AdminRoute>} />

              {/* --- Root and Catch-all --- */}
              <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/auth"} replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Elements>
      </main>
    </div>
  );
}

export default App;
