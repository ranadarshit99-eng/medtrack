import { useApp } from '../context/AppContext';

function navItemsFor(role, unreadCount, userHCRegistered) {
  if (role === 'admin') {
    return [
      { id: 'dashboard', icon: 'fa-table-cells', label: 'Dashboard' },
      { id: 'health-centers', icon: 'fa-hospital', label: 'All Health Centers' },
      { id: 'medicine', icon: 'fa-pills', label: 'Medicine Management' },
      { id: 'beds', icon: 'fa-bed', label: 'Bed Management' },
      { id: 'analytics', icon: 'fa-chart-line', label: 'Patient Analytics' },
      { id: 'patient-history', icon: 'fa-notes-medical', label: 'Patient History' },
      { id: 'alerts', icon: 'fa-bell', label: 'Alerts & Notifications', badge: unreadCount || null },
      { id: 'tests', icon: 'fa-flask', label: 'Test Availability' },
    ];
  }
  return [
    { id: 'dashboard', icon: 'fa-table-cells', label: 'Dashboard' },
    { id: 'medicine', icon: 'fa-pills', label: 'Medicine Management' },
    { id: 'beds', icon: 'fa-bed', label: 'Bed Status' },
    { id: 'analytics', icon: 'fa-chart-line', label: 'Patient Analytics' },
    { id: 'patient-history', icon: 'fa-notes-medical', label: 'Patient History' },
    { id: 'tests', icon: 'fa-flask', label: 'Test Availability' },
    { id: 'doctors', icon: 'fa-calendar-check', label: 'Doctor Schedule' },
    { id: 'register', icon: 'fa-file-circle-plus', label: userHCRegistered ? 'Registration Status' : 'Request to Register' },
  ];
}

export default function Sidebar({ userHC }) {
  const { role, currentPage, navigateTo, unreadCount, sidebarCollapsed, mobileNavOpen, setMobileNavOpen } = useApp();
  const items = navItemsFor(role, unreadCount, userHC?.registered);
  const collapsed = sidebarCollapsed;

  return (
    <>
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside
        className={`h-screen bg-bg-primary border-r border-border flex flex-col transition-all duration-300 z-40
          fixed md:static top-0 ${mobileNavOpen ? 'left-0' : '-left-[260px] md:left-0'}
          ${collapsed ? 'w-[72px] min-w-[72px]' : 'w-[260px] min-w-[260px]'}`}
      >
        <div className="p-5 flex items-center gap-2.5 border-b border-border">
          <div className="w-9 h-9 min-w-9 bg-gradient-to-br from-accent to-info rounded-[10px] flex items-center justify-center">
            <i className="fas fa-heartbeat text-white text-base" />
          </div>
          {!collapsed && <span className="font-display font-bold text-lg">MedTrack</span>}
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {items.map((it) => (
            <div
              key={it.id}
              onClick={() => navigateTo(it.id)}
              className={`nav-item ${currentPage === it.id ? 'active' : ''} ${collapsed ? 'justify-center px-3' : ''}`}
            >
              <i className={`fas ${it.icon} w-5 text-center text-[15px] ${collapsed ? '' : 'mr-3'} ${currentPage === it.id ? 'text-accent' : ''}`} />
              {!collapsed && <span className="flex-1">{it.label}</span>}
              {!collapsed && it.badge ? (
                <span className="bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">{it.badge}</span>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-border flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] min-w-[34px] rounded-[10px] bg-bg-card flex items-center justify-center">
            <i className="fas fa-user text-[13px] text-text-secondary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate">
                {role === 'admin' ? 'District Admin' : userHC?.name}
              </div>
              <div className="text-[11px] text-text-muted truncate">
                {role === 'admin' ? 'Full Access' : userHC?.location}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
