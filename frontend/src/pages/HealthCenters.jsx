import { useMemo, useEffect } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { useApp } from '../context/AppContext';
import { stockStatus, STOCK_HEX } from '../utils';

export default function HealthCenters() {
  const { searchQuery, showToast, openModal, closeModal, refreshNotifications, notifications, selectedHCId, setSelectedHCId } = useApp();
  const { data: allHCs, loading, refetch } = useFetch(() => api.listHealthCenters(false), []);

  useEffect(() => {
    if (selectedHCId && allHCs) {
      const hc = allHCs.find((h) => h.id === selectedHCId);
      if (hc) {
        showDetail(hc);
      }
      setSelectedHCId(null);
    }
  }, [selectedHCId, allHCs]);

  const q = searchQuery.toLowerCase();
  const reg = useMemo(() => (allHCs || [])
    .filter((h) => h.registered)
    .filter((h) => !q || h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q)), [allHCs, q]);
  const pending = useMemo(() => {
    const requestHcIds = new Set(
      (notifications || [])
        .filter((n) => n.type === 'request')
        .map((n) => n.hc_id)
    );
    return (allHCs || []).filter((h) => !h.registered && requestHcIds.has(h.id));
  }, [allHCs, notifications]);

  const lowStockHCs = useMemo(() => reg
    .map((h) => ({ ...h, lowCount: h.medicines.filter((m) => stockStatus(m.stock, m.max_stock) === 'low').length }))
    .sort((a, b) => b.lowCount - a.lowCount), [reg]);

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

  function showDetail(h) {
    const free = h.beds.total - h.beds.occupied;
    openModal(
      <div>
        <div className="flex justify-between items-start mb-5">
          <div><h3 className="text-xl font-bold mb-1 font-display">{h.name}</h3><p className="text-[13px] text-text-secondary">{h.location}</p></div>
          <button onClick={closeModal} aria-label="Close" className="bg-transparent border-none text-text-muted cursor-pointer text-lg"><i className="fas fa-times" /></button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-5">
          <MiniStat value={h.beds.total} label="Total Beds" color="text-info" />
          <MiniStat value={h.beds.occupied} label="Occupied" color="text-warning" />
          <MiniStat value={free} label="Available" color="text-accent" />
        </div>
        <h4 className="text-sm font-bold mb-2.5 font-display">Available Tests</h4>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {h.tests.map((t) => <span key={t} className="text-xs px-2.5 py-1 rounded-md bg-bg-secondary text-text-secondary">{t}</span>)}
        </div>
        <h4 className="text-sm font-bold mb-2.5 font-display">Medicine Stock</h4>
        <div className="max-h-[200px] overflow-y-auto">
          {h.medicines.map((m) => {
            const st = stockStatus(m.stock, m.max_stock);
            const pct = Math.round((m.stock / m.max_stock) * 100);
            return (
              <div key={m.id} className="flex items-center gap-2.5 py-1.5 text-[13px]">
                <span className="w-[180px] text-text-secondary shrink-0 truncate">{m.name}</span>
                <div className="stock-bar flex-1"><div className="stock-bar-fill" style={{ width: `${pct}%`, background: STOCK_HEX[st] }} /></div>
                <span className="w-[50px] text-right font-semibold" style={{ color: STOCK_HEX[st] }}>{m.stock}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) return <p className="text-text-muted">Loading health centers…</p>;

  return (
    <div className="animate-fadeUp">
      {pending.length > 0 && (
        <div className="data-card mb-5" style={{ borderColor: 'rgba(14,165,233,0.3)' }}>
          <div className="data-card-header" style={{ background: 'rgba(14,165,233,0.05)' }}>
            <span className="font-bold text-[15px] text-warning font-display"><i className="fas fa-file-circle-plus mr-1.5" />Registration Requests ({pending.length})</span>
          </div>
          <div className="p-3">
            {pending.map((h) => (
              <div key={h.id} className="px-4 py-3.5 border-b border-border last:border-b-0 flex justify-between items-center flex-wrap gap-2.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center"><i className="fas fa-hospital text-warning" /></div>
                  <div>
                    <p className="font-semibold text-sm">{h.name}</p>
                    <p className="text-xs text-text-muted">{h.location} &middot; {h.beds.total} beds &middot; {h.medicines.length} medicines</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-sm btn-primary" onClick={() => accept(h)}><i className="fas fa-check" /> Accept</button>
                  <button className="btn btn-sm btn-danger" onClick={() => reject(h)}><i className="fas fa-times" /> Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="data-card mb-5">
        <div className="data-card-header"><span className="font-bold text-[15px] font-display"><i className="fas fa-triangle-exclamation text-danger mr-1.5 text-[13px]" />Centers with Low Medicine Stock</span></div>
        <div className="p-3 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {lowStockHCs.filter((h) => h.lowCount > 0).map((h) => (
            <div key={h.id} className="hc-card" onClick={() => showDetail(h)}>
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-sm">{h.name}</p>
                <span className="badge badge-low">{h.lowCount} low</span>
              </div>
              <p className="text-xs text-text-muted mb-2.5">{h.location}</p>
              {h.medicines.filter((m) => stockStatus(m.stock, m.max_stock) === 'low').slice(0, 3).map((m) => (
                <div key={m.id} className="flex justify-between text-[11px] mb-1">
                  <span className="text-text-secondary">{m.name}</span>
                  <span className="text-danger font-semibold">{m.stock}/{m.max_stock}</span>
                </div>
              ))}
            </div>
          ))}
          {lowStockHCs.filter((h) => h.lowCount > 0).length === 0 && <p className="text-text-muted text-sm">No centers with low stock right now.</p>}
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header"><span className="font-bold text-[15px] font-display">All Registered Health Centers ({reg.length})</span></div>
        <div className="p-3">
          <table className="data-table">
            <thead><tr><th>Health Center</th><th>Location</th><th>Beds</th><th>Medicines</th><th>Tests</th><th>Low Stock</th></tr></thead>
            <tbody>
              {reg.map((h) => {
                const low = h.medicines.filter((m) => stockStatus(m.stock, m.max_stock) === 'low').length;
                const free = h.beds.total - h.beds.occupied;
                return (
                  <tr key={h.id} className="cursor-pointer" onClick={() => showDetail(h)}>
                    <td className="text-text-primary font-semibold">{h.name}</td>
                    <td>{h.location}</td>
                    <td>{h.beds.occupied}/{h.beds.total} <span className="text-accent text-[11px]">({free} free)</span></td>
                    <td>{h.medicines.length}</td>
                    <td>{h.tests.length}</td>
                    <td>{low > 0 ? <span className="badge badge-low">{low}</span> : <span className="badge badge-high">OK</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ value, label, color }) {
  return (
    <div className="bg-bg-secondary p-3.5 rounded-xl text-center">
      <p className={`text-[22px] font-bold font-display ${color}`}>{value}</p>
      <p className="text-[11px] text-text-muted">{label}</p>
    </div>
  );
}
