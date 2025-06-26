// frontend/src/App.tsx - Updated to include Admin routes
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { jwtDecode } from 'jwt-decode'; // You may need to install this: pnpm add jwt-decode

// --- Page Components ---
import LoginForm from "./components/LoginForm";
import SignupForm from "./components/SignupForm";
import Dashboard from "./components/Dashboard";
import Services from "./components/Services";
import ServiceDetail from "./components/ServiceDetail";
import JobCalendar from "./components/Calendar";
import JobDetail from "./components/JobDetail";
import CalendarSync from "./components/CalendarSync";
import Navbar from "./components/Navbar";
import SMSConversations from "./components/SMSConversations";
import SMSConversation from "./components/SMSConversation";

// --- NEW: Admin Page Components (you will create these) ---
import AdminDashboard from "./components/admin/AdminDashboard";
import AdminUserDetail from "./components/admin/AdminUserDetail";

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
  // --- NEW: Add state to hold the decoded user information ---
  const [user, setUser] = useState<UserPayload | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const storedToken = localStorage.getItem("token");
        setToken(storedToken);

        // --- NEW: If a token exists, decode it to get user role ---
        if (storedToken) {
          try {
            const decodedUser = jwtDecode<UserPayload>(storedToken);
            setUser(decodedUser);
          } catch (error) {
            console.error("Invalid token:", error);
            // Clear invalid token
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
  }, [token]); // Re-run this effect when the token changes

  // --- NEW: Function to handle setting token and decoding user ---
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
    return <div>Loading...</div>;
  }

  return (
    <>
      {/* --- MODIFIED: Pass user and the new handler to Navbar --- */}
      <Navbar user={user} setToken={handleSetToken} />
      <Routes>
        {/* --- Customer-facing Routes --- */}
        <Route path="/" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
        <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <LoginForm setToken={handleSetToken} />} />
        <Route path="/signup" element={token ? <Navigate to="/dashboard" replace /> : <SignupForm setToken={handleSetToken} />} />

        <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/services" element={token ? <Services /> : <Navigate to="/login" replace />} />
        <Route path="/services/:id" element={token ? <ServiceDetail /> : <Navigate to="/login" replace />} />
        <Route path="/calendar" element={token ? <JobCalendar /> : <Navigate to="/login" replace />} />
        <Route path="/jobs/:id" element={token ? <JobDetail /> : <Navigate to="/login" replace />} />
        <Route path="/calendar-sync" element={token ? <CalendarSync /> : <Navigate to="/login" replace />} />
        <Route path="/sms" element={token ? <SMSConversations /> : <Navigate to="/login" replace />} />
        <Route path="/sms/:phoneNumber" element={token ? <SMSConversation /> : <Navigate to="/login" replace />} />

        {/* --- NEW: Admin Routes --- */}
        {/* These routes will only render if the user is an admin */}
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
    </>
  );
}

export default App;
