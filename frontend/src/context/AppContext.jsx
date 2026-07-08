import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AppContext = createContext(null);

const USER_HC_ID = 6; // demo: the "Health Center" role is always Shanti Nagar CHC

export function AppProvider({ children }) {
  const [role, setRole] = useState(null); // null | 'admin' | 'user'
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null); // ReactNode | null
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false); // fixes: original hamburger did nothing on mobile
  const [selectedHCId, setSelectedHCId] = useState(null);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await api.listNotifications(role === 'user' ? USER_HC_ID : null);
      setNotifications(data);
    } catch {
      // silent: notification polling shouldn't break the app
    }
  }, [role]);

  useEffect(() => {
    if (role) refreshNotifications();
  }, [role, refreshNotifications]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  const navigateTo = useCallback((page) => {
    setCurrentPage(page);
    setSearchQuery('');
    setNotifOpen(false);
    setMobileNavOpen(false);
  }, []);

  const login = useCallback(async (chosenRole) => {
    await api.login(chosenRole);
    setRole(chosenRole);
    setCurrentPage('dashboard');
  }, []);

  const logout = useCallback(() => {
    setRole(null);
    setNotifOpen(false);
    setMobileNavOpen(false);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = {
    role, login, logout,
    currentPage, navigateTo,
    searchQuery, setSearchQuery,
    toasts, showToast,
    modal, openModal: setModal, closeModal: () => setModal(null),
    notifications, refreshNotifications, notifOpen, setNotifOpen, unreadCount,
    sidebarCollapsed, setSidebarCollapsed,
    mobileNavOpen, setMobileNavOpen,
    selectedHCId, setSelectedHCId,
    userHCId: USER_HC_ID,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
