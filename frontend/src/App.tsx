// frontend/src/App.tsx - Updated for Cloudflare integration
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

// Removed bogus global types - not needed with Cloudflare Vite plugin

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize the app
    const initializeApp = async () => {
      try {
        // Get token from localStorage
        const storedToken = localStorage.getItem("token");
        setToken(storedToken);

        // In development, test if the API is accessible
        if (import.meta.env.DEV) {
          try {
            const response = await fetch('/api/ping', { 
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              console.log('✅ API is ready');
            } else {
              console.warn('⚠️  API not ready yet, but continuing...');
            }
          } catch (error) {
            console.warn('⚠️  Could not reach API during initialization:', error);
          }
        }

        setIsReady(true);
      } catch (error) {
        console.error('App initialization error:', error);
        setIsReady(true); // Continue anyway
      }
    };

    initializeApp();
  }, []);

  // Show loading state while initializing
  if (!isReady) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div>Loading...</div>
        {import.meta.env.DEV && (
          <div style={{ fontSize: '0.8rem', color: '#666' }}>
            Starting up...
          </div>
        )}
      </div>
    );
  }

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
      
      {/* Development debug info */}
      {import.meta.env.DEV && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '8px',
          fontSize: '10px',
          borderRadius: '4px',
          fontFamily: 'monospace'
        }}>
          ENV: {import.meta.env.MODE} | API: {import.meta.env.VITE_API_URL || '/api'}
        </div>
      )}
    </>
  );
}

export default App;
