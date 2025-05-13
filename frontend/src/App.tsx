import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
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

function App() {
  const [token, setToken] = useState<string | null>(null);
  // Remove the unused state variable

  useEffect(() => {
    setToken(localStorage.getItem("token"));
  }, []);

  return (
    <>
      <Navbar token={token} setToken={setToken} />
      <Routes>
        {/* root redirect */}
        <Route
          path="/"
          element={<Navigate to={token ? "/dashboard" : "/login"} replace />}
        />

        {/* auth */}
        <Route
          path="/login"
          element={
            token ? <Navigate to="/dashboard" replace /> : <LoginForm setToken={setToken} />
          }
        />
        <Route
          path="/signup"
          element={
            token ? <Navigate to="/dashboard" replace /> : <SignupForm setToken={setToken} />
          }
        />

        {/* protected pages */}
        <Route
          path="/dashboard"
          element={token ? <Dashboard /> : <Navigate to="/login" replace />}
        />

        {/* services */}
        <Route
          path="/services"
          element={token ? <Services /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/services/:id"
          element={token ? <ServiceDetail /> : <Navigate to="/login" replace />}
        />

        {/* calendar */}
        <Route
          path="/calendar"
          element={token ? <JobCalendar /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/jobs/:id"
          element={token ? <JobDetail /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/calendar-sync"
          element={token ? <CalendarSync /> : <Navigate to="/login" replace />}
        />
        {/* SMS routes */}
        <Route
          path="/sms"
          element={token ? <SMSConversations /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/sms/:phoneNumber"
          element={token ? <SMSConversation /> : <Navigate to="/login" replace />}
        />
        {/* catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
