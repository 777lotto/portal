// frontend/src/components/Navbar.tsx

import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from "react-router-dom";
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { apiGet, apiPost, logout } from '../lib/api';
import { UINotification } from '@portal/shared';

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
const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

function NotificationBell() {
  const { data: notifications, error, mutate } = useSWR<UINotification[]>('/api/notifications', apiGet, { refreshInterval: 30000 });
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
              setIsOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllAsRead = async () => {
      const updatedNotifications = notifications?.map(n => ({...n, is_read: 1}));
      mutate(updatedNotifications, false);
      try {
          await apiPost('/api/notifications/read-all', {});
      } catch (error) {
          mutate(); // revert on error
          console.error("Failed to mark all as read", error);
      }
  }

  return (
      <div className="relative" ref={dropdownRef}>
          <button onClick={() => setIsOpen(!isOpen)} className="relative p-2 rounded-full text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
              <span className="sr-only">View notifications</span>
              <BellIcon />
              {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 block h-4 w-4 rounded-full bg-event-red text-white text-xs flex items-center justify-center">{unreadCount}</span>
              )}
          </button>
          {isOpen && (
              <div className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                       <h6 className="font-semibold text-gray-800 dark:text-gray-200">Notifications</h6>
                       {unreadCount > 0 && <button onClick={handleMarkAllAsRead} className="text-sm text-event-blue hover:underline">Mark all as read</button>}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                      {notifications && notifications.length > 0 ? (
                          notifications.map(notification => (
                              <Link to={notification.link || '#'} key={notification.id}
                                    onClick={() => setIsOpen(false)}
                                    className={`block px-4 py-3 text-sm ${!notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''} hover:bg-gray-100 dark:hover:bg-gray-700`}
                              >
                                  <p className="font-medium text-gray-900 dark:text-white">{notification.message}</p>
                                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                  </p>
                              </Link>
                          ))
                      ) : (
                          <div className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">
                              You have no new notifications.
                          </div>
                      )}
                  </div>
              </div>
          )}
      </div>
  );
}

export default function Navbar({ token, setToken, user }: Props) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Check initial theme and set up listener
  useEffect(() => {
    const useDark = window.matchMedia("(prefers-color-scheme: dark)").matches || document.documentElement.classList.contains('dark');
    setIsDarkMode(useDark);
    if (useDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Server logout failed:", error);
    } finally {
      setToken(null);
      setIsUserMenuOpen(false);
      setIsMobileMenuOpen(false);
      navigate("/auth", { replace: true });
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newIsDark = !prev;
      if (newIsDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newIsDark;
    });
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const linkStyle = "px-3 py-2 rounded-md text-sm font-medium text-text-primary-dark/70 dark:text-text-primary-dark/60 hover:bg-tertiary-dark hover:text-white";
  const activeLinkStyle = "px-3 py-2 rounded-md text-sm font-medium text-white bg-tertiary-dark";
  const mobileLinkStyle = "block px-3 py-2 rounded-md text-base font-medium text-text-primary-dark/70 dark:text-text-primary-dark/60 hover:bg-tertiary-dark hover:text-white";
  const mobileActiveLinkStyle = "block px-3 py-2 rounded-md text-base font-medium text-white bg-tertiary-dark";

  const navLinks = (
    <>
      <NavLink to="/dashboard" className={({ isActive }) => isActive ? activeLinkStyle : linkStyle}>Dashboard</NavLink>
      <NavLink to="/calendar" className={({ isActive }) => isActive ? activeLinkStyle : linkStyle}>Calendar</NavLink>
      <NavLink to="/photos" className={({ isActive }) => isActive ? activeLinkStyle : linkStyle}>Photos</NavLink>
      {user?.role === 'admin' && (
        <>
            <NavLink to="/admin/users" className={({ isActive }) => (isActive ? activeLinkStyle : linkStyle) + ' text-cyan-400'}>Users</NavLink>
            <NavLink to="/admin/jobs" className={({ isActive }) => (isActive ? activeLinkStyle : linkStyle) + ' text-cyan-400'}>Jobs</NavLink>
        </>
      )}
    </>
  );

  const mobileNavLinks = (
      <>
        <NavLink to="/dashboard" onClick={closeMobileMenu} className={({isActive}) => isActive ? mobileActiveLinkStyle : mobileLinkStyle}>Dashboard</NavLink>
        <NavLink to="/calendar" onClick={closeMobileMenu} className={({isActive}) => isActive ? mobileActiveLinkStyle : mobileLinkStyle}>Calendar</NavLink>
        <NavLink to="/photos" onClick={closeMobileMenu} className={({isActive}) => isActive ? mobileActiveLinkStyle : mobileLinkStyle}>Photos</NavLink>
        {user?.role === 'admin' && (
           <>
            <NavLink to="/admin/users" onClick={closeMobileMenu} className={({isActive}) => (isActive ? mobileActiveLinkStyle : mobileLinkStyle) + ' text-cyan-400'}>Admin Users</NavLink>
            <NavLink to="/admin/jobs" onClick={closeMobileMenu} className={({isActive}) => (isActive ? mobileActiveLinkStyle : mobileLinkStyle) + ' text-cyan-400'}>Jobs</NavLink>
           </>
        )}
      </>
  );


  return (
    <nav className="bg-secondary-dark dark:bg-primary-dark shadow-md" ref={mobileMenuRef}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex-shrink-0 flex items-center space-x-3 text-white font-bold text-lg">
              <img src={companyLogo} className="h-8 w-8" alt="777 Solutions Logo" />
              <span>{user?.role === 'admin' ? 'Admin Center' : 'Customer Portal'}</span>
            </Link>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {token && navLinks}
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              {token && user ? (
                <>
                  <NotificationBell />
                  <div
                    className="relative ml-3"
                    ref={userMenuRef}
                    onMouseEnter={() => setIsUserMenuOpen(true)}
                    onMouseLeave={() => setIsUserMenuOpen(false)}
                  >
                    <div>
                      <button
                        type="button"
                        className="flex max-w-xs items-center rounded-full bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800 p-2"
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      >
                        <span className="sr-only">Open user menu</span>
                         <span className="text-white mx-2 text-sm font-medium">{user.name}</span>
                         <svg className={`h-5 w-5 text-gray-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    {isUserMenuOpen && (
                      <div className="absolute right-0 z-10 mt-0 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        <NavLink to="/account" onClick={() => setIsUserMenuOpen(false)} className={({isActive}) => "block px-4 py-2 text-sm " + (isActive ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-200")}>
                          My Account
                        </NavLink>
                         <button onClick={toggleTheme} className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                          {isDarkMode ? "Light Mode" : "Dark Mode"}
                        </button>
                        <button onClick={handleLogout} className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <NavLink to="/auth" className={({ isActive }) => isActive ? activeLinkStyle : linkStyle}>Sign In</NavLink>
              )}
            </div>
          </div>
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
            >
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

      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="space-y-1 px-2 pt-2 pb-3 sm:px-3">
            {token && mobileNavLinks}
          </div>
          {user && (
            <div className="border-t border-gray-700 pt-4 pb-3">
              <div className="flex items-center px-5">
                <div className="ml-3">
                  <div className="text-base font-medium leading-none text-white">{user.name}</div>
                </div>
              </div>
              <div className="mt-3 space-y-1 px-2">
                 <NavLink to="/account" onClick={closeMobileMenu} className={mobileLinkStyle}>My Account</NavLink>
                 <button onClick={() => { toggleTheme(); closeMobileMenu(); }} className={`${mobileLinkStyle} w-full text-left`}>
                    {isDarkMode ? "Light Mode" : "Dark Mode"}
                 </button>
                 <button onClick={handleLogout} className={`${mobileLinkStyle} w-full text-left`}>Logout</button>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
