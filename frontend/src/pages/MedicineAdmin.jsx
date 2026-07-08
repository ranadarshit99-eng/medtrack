import { useMemo } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { useApp } from '../context/AppContext';
import { stockStatus, STOCK_HEX, STOCK_BADGE_CLASS, STOCK_LABEL } from '../utils';

export default function MedicineAdmin() {
  const { searchQuery } = useApp();
  const { data: allHCs, loading } = useFetch(() => api.listHealthCenters(false), []);
  const q = searchQuery.toLowerCase();
  const reg = useMemo(() => (allHCs || [])
    .filter((h) => h.registered)
    .filter((h) => !q || h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q)), [allHCs, q]);

  if (loading) return <p className="text-text-muted">Loading…</p>;

  return (
    <div className="animate-fadeUp grid gap-4">
      {reg.map((h) => {
        const lowCount = h.medicines.filter((m) => stockStatus(m.stock, m.max_stock) === 'low').length;
        return (
          <div key={h.id} className="data-card">
            <div className="data-card-header">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-[15px] font-display">{h.name}</span>
                {lowCount > 0 ? <span className="badge badge-low">{lowCount} low</span> : <span className="badge badge-high">All Good</span>}
              </div>
              <span className="text-xs text-text-muted">{h.location}</span>
            </div>
            <table className="data-table">
              <thead><tr><th>Medicine</th><th>Category</th><th>Stock</th><th>Max</th><th>Level</th><th>Status</th></tr></thead>
              <tbody>
                {h.medicines.map((m) => {
                  const st = stockStatus(m.stock, m.max_stock);
                  const pct = Math.round((m.stock / m.max_stock) * 100);
                  return (
                    <tr key={m.id}>
                      <td className="text-text-primary font-medium">{m.name}</td>
                      <td>{m.category}</td>
                      <td className="font-semibold" style={{ color: STOCK_HEX[st] }}>{m.stock}</td>
                      <td>{m.max_stock}</td>
                      <td className="w-[140px]"><div className="stock-bar"><div className="stock-bar-fill" style={{ width: `${pct}%`, background: STOCK_HEX[st] }} /></div></td>
                      <td><span className={`badge ${STOCK_BADGE_CLASS[st]}`}>{STOCK_LABEL[st]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
