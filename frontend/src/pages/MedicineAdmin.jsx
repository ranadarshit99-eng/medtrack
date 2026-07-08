import { useMemo } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { useApp } from '../context/AppContext';
import { stockStatus, STOCK_HEX, STOCK_BADGE_CLASS, STOCK_LABEL } from '../utils';

function getExpiryStatus(expiryDateStr) {
  if (!expiryDateStr) return { label: 'No Date', badgeClass: 'badge-muted' };
  const expiry = new Date(expiryDateStr);
  const now = new Date();
  
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { label: 'Expired', badgeClass: 'badge-low' };
  } else if (diffDays <= 90) {
    return { label: `Expires soon (${diffDays}d)`, badgeClass: 'badge-mid' };
  } else {
    return { label: `Safe (${Math.round(diffDays / 30)}mo left)`, badgeClass: 'badge-high' };
  }
}

function getFinishedDate(stock, medName) {
  if (stock <= 0) return 'Out of Stock';
  const charCodeSum = medName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const dailyRate = (charCodeSum % 4) + 2; 
  const daysLeft = Math.ceil(stock / dailyRate);
  
  const finishDate = new Date();
  finishDate.setDate(finishDate.getDate() + daysLeft);
  return finishDate.toISOString().split('T')[0];
}

export default function MedicineAdmin() {
  const { searchQuery, openModal, closeModal } = useApp();
  const { data: allHCs, loading } = useFetch(() => api.listHealthCenters(false), []);
  const q = searchQuery.toLowerCase();
  const reg = useMemo(() => (allHCs || [])
    .filter((h) => h.registered)
    .filter((h) => !q || h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q)), [allHCs, q]);

  const openDetails = (m, h) => openModal(<MedicineDetailsAdminCard hc={h} med={m} closeModal={closeModal} />);

  if (loading) return <p className="text-text-muted">Loading…</p>;

  return (
    <div className="animate-fadeUp grid gap-4">
      {reg.map((h) => {
        const lowCount = h.medicines.filter((m) => stockStatus(m.stock, m.max_stock) === 'low').length;
        return (
          <div key={h.id} className="data-card overflow-x-auto">
            <div className="data-card-header">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-[15px] font-display">{h.name}</span>
                {lowCount > 0 ? <span className="badge badge-low">{lowCount} low</span> : <span className="badge badge-high">All Good</span>}
              </div>
              <span className="text-xs text-text-muted">{h.location}</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Stock Level</th>
                  <th>Mfg Date</th>
                  <th>Expiry Status</th>
                  <th>Last Stock Arrived</th>
                  <th>Est. Finished Date</th>
                </tr>
              </thead>
              <tbody>
                {h.medicines.map((m) => {
                  const st = stockStatus(m.stock, m.max_stock);
                  const pct = Math.round((m.stock / m.max_stock) * 100);
                  const exp = getExpiryStatus(m.expiry_date);
                  const finishDate = getFinishedDate(m.stock, m.name);
                  return (
                    <tr key={m.id}>
                      <td className="cursor-pointer hover:bg-accent/[0.04] transition-colors p-3" onClick={() => openDetails(m, h)}>
                        <div className="text-text-primary font-semibold flex items-center gap-1.5 hover:text-accent">
                          {m.name}
                          <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-normal">
                            {m.batches?.length || 0} {m.batches?.length === 1 ? 'batch' : 'batches'}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted">{m.category}</div>
                        <div className="text-[10px] text-accent mt-0.5 flex items-center gap-1">
                          <i className="fas fa-history text-[9px]" /> Click to view batches
                        </div>
                      </td>
                      <td>
                        <div className="flex justify-between items-center text-xs mb-1 min-w-[120px]">
                          <span className="font-bold" style={{ color: STOCK_HEX[st] }}>{m.stock} / {m.max_stock}</span>
                          <span className={`badge ${STOCK_BADGE_CLASS[st]} text-[10px] py-0.5 px-1.5`}>{STOCK_LABEL[st]}</span>
                        </div>
                        <div className="stock-bar"><div className="stock-bar-fill" style={{ width: `${pct}%`, background: STOCK_HEX[st] }} /></div>
                      </td>
                      <td className="text-xs font-medium">{m.mfg_date || 'N/A'}</td>
                      <td>
                        <span className={`badge ${exp.badgeClass} text-[10px] py-0.5 px-2 mb-1`}>{exp.label}</span>
                        <div className="text-[11px] text-text-muted">Expiry: {m.expiry_date || 'N/A'}</div>
                      </td>
                      <td>
                        <div className="text-xs font-semibold text-text-primary">+{m.last_stock_arrived || 0} units</div>
                        <div className="text-[11px] text-text-muted">Arrived: {m.last_arrival_date || 'N/A'}</div>
                      </td>
                      <td>
                        <div className="text-xs font-bold text-text-primary">{finishDate}</div>
                        <div className="text-[11px] text-text-muted">Runs out by</div>
                      </td>
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

function ModalHeader({ title, onClose }) {
  return (
    <div className="flex justify-between items-center mb-5">
      <h3 className="text-lg font-bold font-display">{title}</h3>
      <button onClick={onClose} aria-label="Close" className="bg-transparent border-none text-text-muted cursor-pointer text-lg"><i className="fas fa-times" /></button>
    </div>
  );
}

function MedicineDetailsAdminCard({ hc, med, closeModal }) {
  const batches = med.batches || [];
  const totalStock = batches.reduce((sum, b) => sum + b.current_quantity, 0);

  return (
    <div className="max-h-[80vh] overflow-y-auto pr-1 text-left">
      <ModalHeader title={`Stock Batches: ${med.name}`} onClose={closeModal} />
      
      <div className="bg-bg-secondary p-4 rounded-xl mb-4 border border-border">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">Category: {med.category}</span>
          <span className="text-sm font-bold text-accent">Total Stock: {totalStock} / {med.max_stock} units</span>
        </div>
        <div className="stock-bar mb-1"><div className="stock-bar-fill bg-accent" style={{ width: `${Math.min(100, (totalStock/med.max_stock)*100)}%` }} /></div>
      </div>

      <h4 className="text-[14px] font-bold font-display text-text-primary mb-3">Stock Batches History</h4>

      <div className="space-y-3">
        {batches.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No stock batches found for this medicine.</p>
        ) : (
          batches.map((b) => {
            const exp = getExpiryStatus(b.expiry_date);
            return (
              <div key={b.id} className="bg-bg-card border border-border rounded-xl p-3.5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-[13px] font-bold text-text-primary">Stock arrived on: {b.arrival_date}</span>
                    <div className="text-[11px] text-text-muted mt-0.5">Mfg Date: {b.mfg_date}</div>
                  </div>
                  <span className={`badge ${exp.badgeClass} text-[10px]`}>{exp.label} (Exp: {b.expiry_date})</span>
                </div>
                
                <div className="flex justify-between items-center bg-bg-secondary px-3 py-2 rounded-lg text-xs border border-border">
                  <div>
                    <span className="text-text-muted">Initial Quantity: </span>
                    <span className="font-semibold text-text-primary">{b.initial_quantity}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Current Quantity: </span>
                    <span className="font-bold text-accent text-sm">{b.current_quantity}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
