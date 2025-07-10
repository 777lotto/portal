// frontend/src/App.tsx - CORRECTED
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { jwtDecode } from 'jwt-decode';

// --- Page Components ---
import LoginForm from "./components/LoginForm.js";
import SignupForm from "./components/SignupForm.js";
import ForgotPasswordForm from "./components/ForgotPasswordForm.js";
import VerifyCodeForm from "./components/VerifyCodeForm.js";
import SetPasswordForm from "./components/SetPasswordForm.js";
import Dashboard from "./components/Dashboard.js";
import Services from "./components/Services.js";
import ServiceDetail from "./components/ServiceDetail.js";
import JobCalendar from "./components/Calendar.js";
import JobDetail from "./components/JobDetail.js";
import CalendarSync from "./components/CalendarSync.js";
import Navbar from "./components/Navbar.js";
import PublicBookingPage from "./components/PublicBookingPage.js";
import Photos from "./components/Photos.js";

// --- NEW: Admin Page Components (you will create these) ---
import AdminDashboard from "./components/admin/AdminDashboard.js";
import AdminUserDetail from "./components/admin/AdminUserDetail.js";

// --- NEW: Define a type for the decoded user payload ---
interface UserPayload {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  // add other fields from your JWT payload as needed
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
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-primary-light dark:bg-secondary-dark">
      <Navbar token={token} user={user} setToken={handleSetToken} />
      <main className="p-4 sm:p-6 lg:p-8">
        <Routes>
          {/* --- Public Routes --- */}
          <Route path="/booking" element={<PublicBookingPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordForm />} />
          <Route path="/set-password" element={<SetPasswordForm setToken={handleSetToken} />} />
          <Route path="/verify-code" element={<VerifyCodeForm />} />
          <Route path="/" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
          <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <LoginForm setToken={handleSetToken} />} />
          <Route path="/signup" element={token ? <Navigate to="/dashboard" replace /> : <SignupForm setToken={handleSetToken} />} />

          {/* --- Customer-facing Routes --- */}
          <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/login" replace />} />
          <Route path="/services" element={token ? <Services /> : <Navigate to="/login" replace />} />
          <Route path="/services/:id" element={token ? <ServiceDetail /> : <Navigate to="/login" replace />} />
          <Route path="/calendar" element={token ? <JobCalendar /> : <Navigate to="/login" replace />} />
          <Route path="/photos" element={token ? <Photos /> : <Navigate to="/login" replace />} />
          <Route path="/jobs/:id" element={token ? <JobDetail /> : <Navigate to="/login" replace />} />
          <Route path="/calendar-sync" element={token ? <CalendarSync /> : <Navigate to="/login" replace />} />

          {/* SMS Routes have been removed */}

          {/* --- Admin Routes --- */}
          <Route
            path="/admin/dashboard"
            element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/dashboard" replace />}
          />
          <Route
            path="/admin/users/:userId"
            element={user?.role === 'admin' ? <AdminUserDetail /> : <Navigate to="/dashboard" replace />}
          />

          {/* --- Catch-all redirect --- */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
