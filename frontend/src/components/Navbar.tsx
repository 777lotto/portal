// frontend/src/components/Navbar.tsx - UPDATED

import { Link, NavLink, useNavigate } from "react-router-dom";
import { logout } from "../lib/api.js";
// 1. Import your SVG from the assets directory
import companyLogo from '../assets/777-solutions.svg';

interface UserPayload {
  name: string;
  role: 'admin' | 'customer';
}

interface Props {
  token: string | null;
  setToken: (token: string | null) => void;
  user: UserPayload | null;
}

export default function Navbar({ token, setToken, user }: Props) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Server logout failed:", error);
    } finally {
      setToken(null);
      navigate("/auth", { replace: true });
    }
  };

  const linkStyle = "px-3 py-2 rounded-md text-sm font-medium text-text-primary-dark/70 dark:text-text-primary-dark/60 hover:bg-tertiary-dark hover:text-white";
  const activeLinkStyle = "px-3 py-2 rounded-md text-sm font-medium text-white bg-tertiary-dark";

  return (
    <nav className="bg-secondary-dark dark:bg-primary-dark shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            {/*
              2. The <Link> component now wraps both the logo and the text.
                 - It points directly to "/dashboard".
                 - `flex items-center space-x-3` aligns the logo and text horizontally.
            */}
            <Link to="/dashboard" className="flex items-center space-x-3 text-white font-bold text-lg">
              {/* 3. The imported SVG is used in an <img> tag.
                  - `h-8 w-8` controls the display size (32x32 pixels).
              */}
              <img src={companyLogo} className="h-8 w-8" alt="777 Solutions Logo" />
              <span>Customer Portal</span>
            </Link>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {token && (
                  <>
                    <NavLink to="/dashboard" className={({isActive}) => isActive ? activeLinkStyle : linkStyle}>Dashboard</NavLink>
                    <NavLink to="/services" className={({isActive}) => isActive ? activeLinkStyle : linkStyle}>Services</NavLink>
                    <NavLink to="/calendar" className={({isActive}) => isActive ? activeLinkStyle : linkStyle}>Calendar</NavLink>
                    <NavLink to="/photos" className={({isActive}) => isActive ? activeLinkStyle : linkStyle}>Photos</NavLink>
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
                    <NavLink to="/auth" className={({isActive}) => isActive ? activeLinkStyle : linkStyle}>Sign In / Sign Up</NavLink>
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
