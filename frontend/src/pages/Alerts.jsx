import { useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/UI';

export default function Alerts() {
  const { notifications, showToast, refreshNotifications } = useApp();
  const [tab, setTab] = useState('stock');
  const { data: allHCs, refetch } = useFetch(() => api.listHealthCenters(false), []);

  const stockAlerts = notifications.filter((n) => n.type === 'alert');
  const pending = (allHCs || []).filter((h) => !h.registered);

  const accept = async (h) => {
    await api.acceptHealthCenter(h.id);
    showToast(`${h.name} has been registered successfully!`);
    await Promise.all([refetch(), refreshNotifications()]);
  };
  const reject = async (h) => {
    await api.rejectHealthCenter(h.id);
    showToast(`${h.name} request has been rejected.`, 'error');
    await Promise.all([refetch(), refreshNotifications()]);
  };

  return (
    <div className="animate-fadeUp">
      <div className="flex gap-2 mb-5">
        <button className={`tab-btn ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>Stock Alerts ({stockAlerts.length})</button>
        <button className={`tab-btn ${tab === 'request' ? 'active' : ''}`} onClick={() => setTab('request')}>Registration Requests ({pending.length})</button>
      </div>

      {tab === 'stock' ? (
        stockAlerts.length === 0 ? <EmptyState text="No stock alerts" /> : (
          <div className="data-card">
            <table className="data-table">
              <thead><tr><th>Alert</th><th>From</th><th>Time</th><th>Status</th></tr></thead>
              <tbody>
                {stockAlerts.map((n) => (
                  <tr key={n.id}>
                    <td className="text-text-primary font-medium">{n.message}</td>
                    <td>{n.from}</td>
                    <td className="text-xs text-text-muted">{n.date}</td>
                    <td><span className={`badge ${n.read ? 'badge-registered' : 'badge-pending'}`}>{n.read ? 'Read' : 'New'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        pending.length === 0 ? <EmptyState text="No pending requests" /> : (
          <div className="grid gap-3">
            {pending.map((h) => (
              <div key={h.id} className="data-card" style={{ borderColor: 'rgba(14,165,233,0.2)' }}>
                <div className="px-5 py-[18px] flex justify-between items-center flex-wrap gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-warning/20 flex items-center justify-center"><i className="fas fa-hospital text-warning text-lg" /></div>
                    <div>
                      <p className="font-bold text-[15px]">{h.name}</p>
                      <p className="text-[13px] text-text-muted">{h.location} &middot; {h.beds.total} beds &middot; {h.doctors.length} doctors</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-sm btn-primary" onClick={() => accept(h)}><i className="fas fa-check" /> Accept</button>
                    <button className="btn btn-sm btn-danger" onClick={() => reject(h)}><i className="fas fa-times" /> Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
