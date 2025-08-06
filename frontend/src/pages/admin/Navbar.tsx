// frontend/src/pages/admin/Navbar.tsx
import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { apiGet, apiPost, logout } from '../../lib/api';
import { Notification } from '@portal/shared';

import companyLogo from '../../assets/777-solutions.svg';

interface UserPayload {
  name: string;
  role: 'admin' | 'customer';
}

interface Props {
  token: string | null;
  setToken: (token: string | null) => void;
  user: UserPayload | null;
}

// Icon components
const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 01-6 0v-1m6 0H9" />
  </svg>
);
const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-14.66l-.707.707M4.04 19.96l-.707.707M21 12h-1M4 12H3m15.66 2.34l.707.707M4.04 4.04l.707.707" /></svg>;

/**
 * AdminNavbar provides navigation for the admin section of the application.
 * It includes links to the admin dashboard, user management, jobs, calendar, and chat.
 */
function AdminNavbar({ token, setToken, user }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  const { data: notifications, mutate } = useSWR<Notification[]>(token ? 'notifications' : null, apiGet, { refreshInterval: 60000 });

  // Effect to handle theme changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Effect to handle clicks outside of menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target as Node)) {
        setNotificationMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setToken(null);
    navigate('/login');
  };

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const markAsRead = async (id: string) => {
    await apiPost(`notifications/${id}/read`);
    mutate(notifications?.filter(n => n.id !== id), false);
  };

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  // Styling for navigation links
  const activeLinkStyle = "bg-primary-dark text-white rounded-md px-3 py-2 text-sm font-medium";
  const inactiveLinkStyle = "text-gray-300 hover:bg-gray-700 hover:text-white rounded-md px-3 py-2 text-sm font-medium";
  const mobileLinkStyle = "block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white";

  // Admin-specific navigation links
  const navLinks = (
    <>
      <NavLink to="/" end className={({ isActive }) => isActive && location.pathname === '/' ? activeLinkStyle : inactiveLinkStyle}>Dashboard</NavLink>
      <NavLink to="/users" className={({ isActive }) => isActive ? activeLinkStyle : inactiveLinkStyle}>Users</NavLink>
      <NavLink to="/jobs" className={({ isActive }) => isActive ? activeLinkStyle : inactiveLinkStyle}>Jobs</NavLink>
      <NavLink to="/calendar" className={({ isActive }) => isActive ? activeLinkStyle : inactiveLinkStyle}>Calendar</NavLink>
      <NavLink to="/chat" className={({ isActive }) => isActive ? activeLinkStyle : inactiveLinkStyle}>Chat</NavLink>
    </>
  );

  const mobileNavLinks = (
    <>
      <NavLink to="/" end onClick={closeMobileMenu} className={({ isActive }) => isActive && location.pathname === '/' ? `${mobileLinkStyle} bg-gray-900 text-white` : mobileLinkStyle}>Dashboard</NavLink>
      <NavLink to="/users" onClick={closeMobileMenu} className={({ isActive }) => isActive ? `${mobileLinkStyle} bg-gray-900 text-white` : mobileLinkStyle}>Users</NavLink>
      <NavLink to="/jobs" onClick={closeMobileMenu} className={({ isActive }) => isActive ? `${mobileLinkStyle} bg-gray-900 text-white` : mobileLinkStyle}>Jobs</NavLink>
      <NavLink to="/calendar" onClick={closeMobileMenu} className={({ isActive }) => isActive ? `${mobileLinkStyle} bg-gray-900 text-white` : mobileLinkStyle}>Calendar</NavLink>
      <NavLink to="/chat" onClick={closeMobileMenu} className={({ isActive }) => isActive ? `${mobileLinkStyle} bg-gray-900 text-white` : mobileLinkStyle}>Chat</NavLink>
    </>
  );

  return (
    <nav className="bg-primary-light dark:bg-primary-dark shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link to="/">
                <img className="h-10" src={companyLogo} alt="Company Logo" />
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {token && navLinks}
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              <button onClick={toggleTheme} className="p-1 rounded-full text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
              </button>
              {token && (
                <>
                  {/* Notification Bell and Dropdown */}
                  <div className="relative ml-3" ref={notificationMenuRef}>
                    <button onClick={() => setNotificationMenuOpen(!isNotificationMenuOpen)} className="relative p-1 rounded-full text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                      <BellIcon />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">{unreadCount}</span>
                      )}
                    </button>
                    {isNotificationMenuOpen && (
                      <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                        <div className="py-1">
                          <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 font-bold border-b dark:border-gray-700">Notifications</div>
                          <div className="max-h-80 overflow-y-auto">
                            {notifications && notifications.length > 0 ? (
                              notifications.map(n => (
                                <div key={n.id} className={`px-4 py-2 text-sm ${n.is_read ? 'text-gray-500' : 'text-gray-800 dark:text-gray-300'}`}>
                                  <p>{n.message}</p>
                                  <div className="flex justify-between items-center mt-1">
                                    <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(n.created_at))} ago</span>
                                    {!n.is_read && <button onClick={() => markAsRead(n.id)} className="text-xs text-blue-500 hover:underline">Mark as read</button>}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="px-4 py-2 text-sm text-gray-500">No new notifications.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Profile Dropdown */}
                  <div className="relative ml-3" ref={profileMenuRef}>
                    <div>
                      <button onClick={() => setProfileMenuOpen(!isProfileMenuOpen)} type="button" className="flex max-w-xs items-center rounded-full bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800" id="user-menu-button" aria-expanded="false" aria-haspopup="true">
                        <span className="sr-only">Open user menu</span>
                        <div className="h-8 w-8 rounded-full bg-primary-dark flex items-center justify-center text-white font-bold">
                          {user?.name?.charAt(0).toUpperCase()}
                        </div>
                      </button>
                    </div>
                    {isProfileMenuOpen && (
                      <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none" role="menu" aria-orientation="vertical" aria-labelledby="user-menu-button">
                        <NavLink to="/account" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem">My Account</NavLink>
                        <button onClick={handleLogout} className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem">Sign out</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Mobile Menu Button */}
          <div className="-mr-2 flex md:hidden">
            <button onClick={() => setMobileMenuOpen(!isMobileMenuOpen)} type="button" className="inline-flex items-center justify-center rounded-md bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800" aria-controls="mobile-menu" aria-expanded="false">
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="space-y-1 px-2 pt-2 pb-3 sm:px-3">
            {token && mobileNavLinks}
          </div>
          {user && (
            <div className="border-t border-gray-700 pt-4 pb-3">
              <div className="flex items-center px-5">
                 <div className="h-10 w-10 rounded-full bg-primary-dark flex items-center justify-center text-white font-bold">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                <div className="ml-3">
                  <div className="text-base font-medium leading-none text-white">{user.name}</div>
                </div>
                 <button onClick={toggleTheme} className="ml-auto flex-shrink-0 p-1 rounded-full text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                  {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                </button>
              </div>
              <div className="mt-3 space-y-1 px-2">
                 <NavLink to="/account" onClick={closeMobileMenu} className={mobileLinkStyle}>My Account</NavLink>
                 <button onClick={() => { handleLogout(); closeMobileMenu(); }} className={`${mobileLinkStyle} w-full text-left`}>Sign out</button>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

export default AdminNavbar;
