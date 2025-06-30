// frontend/src/components/Navbar.tsx - CORRECTED

import { Link, NavLink, useNavigate } from "react-router-dom";
import { logout } from "../lib/api.js";

// Define the shape of the decoded user object from the JWT
interface UserPayload {
  name: string;
  role: 'admin' | 'customer';
}

// Update the Props interface to accept the new `user` object
interface Props {
  token: string | null;
  setToken: (token: string | null) => void;
  user: UserPayload | null;
}

export default function Navbar({ token, setToken, user }: Props) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      // Call the new API endpoint to clear the server-side session
      await logout();
    } catch (error) {
      // Log the error but proceed with frontend cleanup regardless
      console.error("Server logout failed:", error);
    } finally {
      // Clear the token from the frontend state and local storage
      setToken(null);
      // Redirect to the login page
      navigate("/login", { replace: true });
    }
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">Customer Portal</Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            {token && (
              <>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/dashboard">Dashboard</NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/services">Services</NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/calendar">Calendar</NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/sms">Messages</NavLink>
                </li>
                {user?.role === 'admin' && (
                  <li className="nav-item">
                    <NavLink className="nav-link" to="/admin/dashboard" style={{ color: 'cyan' }}>
                      Admin
                    </NavLink>
                  </li>
                )}
              </>
            )}
          </ul>

          {token && user ? (
            <div className="d-flex align-items-center">
              <span className="navbar-text me-3">
                Welcome, {user.name}
              </span>
              <button onClick={handleLogout} className="btn btn-outline-light">
                Logout
              </button>
            </div>
          ) : (
            <ul className="navbar-nav">
              <li className="nav-item">
                <NavLink className="nav-link" to="/login">Login</NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/signup">Sign Up</NavLink>
              </li>
            </ul>
          )}
        </div>
      </div>
    </nav>
  );
}

