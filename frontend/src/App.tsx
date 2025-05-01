// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import LoginForm from "./components/LoginForm";
import SignupForm from "./components/SignupForm";
import Dashboard from "./components/Dashboard";
import Services from "./components/Services";
import Navbar from "./components/Navbar";

function App() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    setToken(storedToken);
  }, []);

  return (
    <>
      <Navbar token={token} setToken={setToken} />
      <Routes>
        <Route
          path="/"
          element={<Navigate to={token ? "/dashboard" : "/login"} replace />}
        />
        <Route path="/login" element={<LoginForm setToken={setToken} />} />
        <Route path="/signup" element={<SignupForm setToken={setToken} />} />
        <Route
          path="/dashboard"
          element={token ? <Dashboard /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/services"
          element={token ? <Services /> : <Navigate to="/login" replace />}
        />
        <Route path="/services" element={<Services />}
        />
      </Routes>
    </>
  );
}

export default App;
