// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import LoginForm from "./components/LoginForm";
import SignupForm from "./components/SignupForm";
import Dashboard from "./components/Dashboard";
import Services from "./components/Services";
import ServiceDetail from "./components/ServiceDetail";
import Navbar from "./components/Navbar";

function App() {
  const [token, setToken] = useState<string | null>(null);

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

        {/* public auth pages */}
        <Route path="/login" element={<LoginForm setToken={setToken} />} />
        <Route path="/signup" element={<SignupForm setToken={setToken} />} />

        {/* protected pages */}
        <Route
          path="/dashboard"
          element={token ? <Dashboard /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/services"
          element={token ? <Services /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/services/:id"
          element={token ? <ServiceDetail /> : <Navigate to="/login" replace />}
        />

        <Route
        path="*" element={<Navigate to="/" replace />}
        />

      </Routes>
    </>
  );
}

export default App;
