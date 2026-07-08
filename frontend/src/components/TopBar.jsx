import { useApp } from '../context/AppContext';
import NotifPanel from './NotifPanel';

const TITLES = {
  dashboard: 'Dashboard',
  'health-centers': 'All Health Centers',
  medicine: 'Medicine Management',
  analytics: 'Patient Analytics',
  alerts: 'Alerts & Notifications',
  tests: 'Test Availability',
  doctors: 'Doctor Schedule',
  register: 'Registration',
};

const SEARCHABLE_PAGES = ['health-centers', 'medicine', 'beds', 'tests'];

export default function TopBar() {
  const {
    role, currentPage, logout, searchQuery, setSearchQuery,
    notifOpen, setNotifOpen, unreadCount, setSidebarCollapsed, setMobileNavOpen,
  } = useApp();

  const title = currentPage === 'beds'
    ? (role === 'admin' ? 'Bed Management' : 'Bed Status')
    : (TITLES[currentPage] || 'Dashboard');

  const showSearch = role === 'admin' && SEARCHABLE_PAGES.includes(currentPage);

  const toggleNav = () => {
    // Fixes original bug: on mobile the hamburger only toggled a `.collapsed`
    // class that the off-canvas sidebar CSS never reacted to, so the sidebar
    // was unreachable on small screens. Now it drives a separate mobile flag.
    setMobileNavOpen((v) => !v);
    setSidebarCollapsed((v) => !v);
  };

  return (
    <header className="h-16 min-h-16 bg-bg-primary border-b border-border flex items-center px-6 gap-4">
      <button
        type="button"
        onClick={toggleNav}
        aria-label="Toggle navigation"
        className="bg-transparent border-none text-text-secondary cursor-pointer text-lg p-1 hover:text-text-primary"
      >
        <i className="fas fa-bars" />
      </button>
      <h2 className="text-[17px] font-semibold flex-1 font-display truncate">{title}</h2>

      {showSearch && (
        <div className="bg-bg-card border border-border rounded-lg px-3.5 py-2 hidden sm:flex items-center gap-2 w-48 md:w-80 focus-within:border-accent">
          <i className="fas fa-search text-text-muted text-[13px]" />
          <input
            type="text"
            placeholder={currentPage === 'tests' ? "Search health centers or tests..." : "Search health centers..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-text-primary text-sm w-full placeholder:text-text-muted"
          />
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => setNotifOpen((v) => !v)}
          className="w-10 h-10 rounded-lg flex items-center justify-center bg-bg-card border border-border cursor-pointer text-text-secondary transition-all hover:border-accent hover:text-accent relative"
        >
          <i className="fas fa-bell text-[15px]" />
          {unreadCount > 0 && (
            <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full border-2 border-bg-primary" />
          )}
        </button>
        {notifOpen && <NotifPanel />}
      </div>

      <button type="button" className="btn btn-secondary btn-sm" onClick={logout} aria-label="Log out">
        <i className="fas fa-sign-out-alt" />
      </button>
    </header>
  );
}
