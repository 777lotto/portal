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

  const linkStyle = "px-3 py-2 rounded-md text-sm font-medium text-text-primary-dark/70 dark:text-text-primary-dark/60 hover:bg-tertiary-dark hover:text-white";
  const activeLinkStyle = "px-3 py-2 rounded-md text-sm font-medium text-white bg-tertiary-dark";

  return (
    <nav className="bg-secondary-dark dark:bg-primary-dark shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link to="/" className="text-white font-bold text-lg">Customer Portal</Link>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {token && (
                  <>
                    <NavLink to="/dashboard" className={({isActive}) => isActive ? activeLinkStyle : linkStyle}>Dashboard</NavLink>
                    <NavLink to="/services" className={({isActive}) => isActive ? activeLinkStyle : linkStyle}>Services</NavLink>
                    <NavLink to="/calendar" className={({isActive}) => isActive ? activeLinkStyle : linkStyle}>Calendar</NavLink>
                    <NavLink to="/photos" className={({isActive}) => isActive ? activeLinkStyle : linkStyle}>Photos</NavLink>
                    {/* The "Messages" NavLink has been removed */}
                    {user?.role === 'admin' && (
                       <NavLink to="/admin/dashboard" className={({isActive}) => isActive ? activeLinkStyle + ' text-cyan-400' : linkStyle + ' text-cyan-400'}>Admin</NavLink>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              {token && user ? (
                <>
                  <span className="text-text-secondary-dark dark:text-text-primary-dark/80 mr-3">Welcome, {user.name}</span>
                  <button onClick={handleLogout} className="rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700">
                    Logout
                  </button>
                </>
              ) : (
                 <div className="flex items-baseline space-x-4">
                    <NavLink to="/login" className={({isActive}) => isActive ? activeLinkStyle : linkStyle}>Login</NavLink>
                    <NavLink to="/signup" className={({isActive}) => isActive ? activeLinkStyle : linkStyle}>Sign Up</NavLink>
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
