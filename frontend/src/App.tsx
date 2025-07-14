// frontend/src/App.tsx - MODIFIED
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react"; // Import lazy and Suspense
import { jwtDecode } from 'jwt-decode';

// --- Page Components ---
import Navbar from "./components/Navbar.js";
import Dashboard from "./components/Dashboard.js";
// Lazily load components that aren't needed on the initial page load
const Services = lazy(() => import("./components/Services.js"));
const ServiceDetail = lazy(() => import("./components/ServiceDetail.js"));
const JobCalendar = lazy(() => import("./components/Calendar.js"));
const JobDetail = lazy(() => import("./components/JobDetail.js"));
const CalendarSync = lazy(() => import("./components/CalendarSync.js"));
const PublicBookingPage = lazy(() => import("./components/PublicBookingPage.js"));
const Photos = lazy(() => import("./components/Photos.js"));
const AccountPage = lazy(() => import("./components/AccountPage.js"));
const AuthForm = lazy(() => import("./components/AuthForm.js"));

// --- Admin Page Components ---
const AdminDashboard = lazy(() => import("./components/admin/AdminDashboard.js"));
const AdminUserDetail = lazy(() => import("./components/admin/AdminUserDetail.js"));


interface UserPayload {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'admin';
}

// A simple fallback component to show while a lazy component is loading
function LoadingFallback() {
  return <div className="p-8 text-center">Loading...</div>;
}

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
        {/* Wrap all routes in a Suspense boundary */}
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* --- Public Routes --- */}
            <Route path="/booking" element={<PublicBookingPage />} />
            <Route path="/auth" element={token ? <Navigate to="/dashboard" replace /> : <AuthForm setToken={handleSetToken} />} />
            <Route path="/" element={<Navigate to={token ? "/dashboard" : "/auth"} replace />} />

            {/* --- Customer-facing Routes --- */}
            <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/auth" replace />} />
            <Route path="/services" element={token ? <Services /> : <Navigate to="/auth" replace />} />
            <Route path="/services/:id" element={token ? <ServiceDetail /> : <Navigate to="/auth" replace />} />
            <Route path="/calendar" element={token ? <JobCalendar /> : <Navigate to="/auth" replace />} />
            <Route path="/photos" element={token ? <Photos /> : <Navigate to="/auth" replace />} />
            <Route path="/jobs/:id" element={token ? <JobDetail /> : <Navigate to="/auth" replace />} />
            <Route path="/calendar-sync" element={token ? <CalendarSync /> : <Navigate to="/auth" replace />} />
            <Route path="/account" element={token ? <AccountPage /> : <Navigate to="/auth" replace />} />

            {/* --- Admin Routes --- */}
            <Route
              path="/admin/users"
              element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/dashboard" replace />}
            />
            <Route
              path="/admin/users/:userId"
              element={user?.role === 'admin' ? <AdminUserDetail /> : <Navigate to="/dashboard" replace />}
            />

            {/* --- Catch-all redirect --- */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
