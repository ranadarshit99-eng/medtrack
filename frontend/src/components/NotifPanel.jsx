import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import AIAlertDetailModal from './AIAlertDetailModal';

const inferCode = (msg) => {
  const m = msg.toLowerCase();
  if (m.includes('stock') || m.includes('medicine') || m.includes('depletion')) return 'MED_DEPLETION';
  if (m.includes('bed') || m.includes('occupancy')) return 'BED_OVERFLOW';
  if (m.includes('dengue')) return 'OUTBREAK_DENGUE';
  if (m.includes('malaria')) return 'OUTBREAK_MALARIA';
  if (m.includes('respiratory')) return 'OUTBREAK_RESPIRATORY';
  if (m.includes('stomach')) return 'OUTBREAK_STOMACH_ISSUES';
  if (m.includes('fever')) return 'OUTBREAK_FEVER';
  return 'PATIENT_SURGE';
};

export default function NotifPanel() {
  const { notifications, refreshNotifications, navigateTo, role, showToast, openModal, closeModal } = useApp();

  const markAllRead = async () => {
    await api.markAllRead();
    await refreshNotifications();
    showToast('All notifications marked as read');
  };

  const handleClick = async (n) => {
    await api.markRead(n.id);
    await refreshNotifications();
    if (n.type === 'alert') {
      const cleanMsg = n.message.replace(/^\[.*?\]\s*/, '');
      const code = inferCode(cleanMsg);
      openModal(
        <AIAlertDetailModal
          alert={{ type: n.priority || 'Normal', title: cleanMsg, message: cleanMsg, code }}
          hcId={n.hc_id}
          onClose={closeModal}
        />
      );
    } else {
      if (role === 'admin') {
        navigateTo('health-centers');
      }
    }
  };

  return (
    <div className="absolute top-[52px] right-0 w-[380px] max-h-[70vh] bg-bg-card border border-border rounded-2xl z-[45] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)] animate-modalIn">
      {notifications.length === 0 ? (
        <div className="p-10 text-center text-text-muted">
          <i className="fas fa-bell-slash text-2xl mb-2.5 block" />
          No notifications
        </div>
      ) : (
        <>
          <div className="px-[18px] py-3.5 border-b border-border flex justify-between items-center">
            <span className="font-bold text-[15px]">Notifications</span>
            <button className="btn btn-sm btn-secondary text-[11px]" onClick={markAllRead}>Mark all read</button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className="px-[18px] py-3.5 border-b border-border last:border-b-0 cursor-pointer hover:bg-bg-card-hover transition-colors"
                style={{ opacity: n.read ? 0.5 : 1 }}
              >
                <div className="flex gap-2.5 items-start">
                  <div
                    className="w-8 h-8 min-w-8 rounded-lg flex items-center justify-center"
                    style={{ background: n.type === 'alert' ? 'rgba(220,38,38,0.2)' : 'rgba(14,165,233,0.2)' }}
                  >
                    <i
                      className={`fas ${n.type === 'alert' ? 'fa-triangle-exclamation' : 'fa-file-circle-plus'} text-[13px]`}
                      style={{ color: n.type === 'alert' ? '#dc2626' : '#0ea5e9' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] leading-snug mb-1">{n.message}</p>
                    <p className="text-[11px] text-text-muted">{n.from} &middot; {n.date}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 min-w-2 rounded-full bg-accent mt-1.5" />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
