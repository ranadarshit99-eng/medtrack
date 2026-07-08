import { Doughnut } from 'react-chartjs-2';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/UI';
import { stockStatus, STOCK_HEX, STOCK_BADGE_CLASS, STOCK_LABEL } from '../utils';
import { chartColors, donutOptions } from '../charts/setup';
import AIHCPanel from '../components/AIHCPanel';

export default function UserDashboard({ hc, navigateTo }) {
  const { navigateTo: nav } = useApp();
  const go = navigateTo || nav;
  const free = hc.beds.total - hc.beds.occupied;
  const lowMeds = hc.medicines.filter((m) => stockStatus(m.stock, m.max_stock) === 'low').length;
  const lastMonth = hc.patient_monthly[hc.patient_monthly.length - 1];

  return (
    <div className="animate-fadeUp">
      {!hc.registered ? (
        <div className="reg-banner mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-warning/20 flex items-center justify-center">
              <i className="fas fa-file-circle-plus text-warning text-lg" />
            </div>
            <div>
              <p className="font-bold text-[15px]">Your center is not registered yet</p>
              <p className="text-[13px] text-text-secondary">Send a request to the district admin for listing.</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => go('register')}><i className="fas fa-paper-plane" /> Send Request</button>
        </div>
      ) : (
        <div className="mb-6 px-5 py-3.5 rounded-xl bg-accent/[0.08] border border-accent/20 flex items-center gap-2.5">
          <i className="fas fa-circle-check text-accent text-lg" />
          <span className="text-sm text-accent font-semibold">Your health center is registered with the district.</span>
        </div>
      )}

      {/* AI Prediction & Alerts Panel — HC-scoped */}
      {hc.registered && <AIHCPanel hcId={hc.id} hcName={hc.name} />}

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <StatCard label="Total Beds" value={hc.beds.total} icon="fa-bed" iconBg="rgba(37,99,235,0.15)" iconColor={chartColors.info} glowColor={chartColors.info} />
        <StatCard label="Available" value={free} icon="fa-bed-pulse" iconBg="rgba(16,185,129,0.15)" iconColor={chartColors.accent} glowColor={chartColors.accent} />
        <StatCard label="Occupied" value={hc.beds.occupied} icon="fa-user-injured" iconBg="rgba(14,165,233,0.15)" iconColor={chartColors.warning} glowColor={chartColors.warning} />
        <StatCard label="Low Stock Items" value={lowMeds} icon="fa-pills" iconBg="rgba(220,38,38,0.15)" iconColor={chartColors.danger} glowColor={chartColors.danger} pulse={lowMeds > 0} />
      </div>

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="data-card">
          <div className="data-card-header"><span className="font-bold text-[15px] font-display">Bed Occupancy</span></div>
          <div className="p-4 flex items-center gap-6">
            <div className="h-[180px] w-[180px] shrink-0">
              <Doughnut
                data={{ labels: ['Occupied', 'Available'], datasets: [{ data: [hc.beds.occupied, free], backgroundColor: [chartColors.warning, chartColors.accent], borderWidth: 0, hoverOffset: 6 }] }}
                options={donutOptions('72%')}
              />
            </div>
            <div className="flex-1">
              <BarRow label="Occupied" value={`${hc.beds.occupied}/${hc.beds.total}`} pct={hc.beds.total ? (hc.beds.occupied / hc.beds.total) * 100 : 0} color={chartColors.warning} valueClass="text-warning" />
              <BarRow label="Available" value={`${free}/${hc.beds.total}`} pct={hc.beds.total ? (free / hc.beds.total) * 100 : 0} color={chartColors.accent} valueClass="text-accent" />
            </div>
          </div>
        </div>
        <div className="data-card">
          <div className="data-card-header">
            <span className="font-bold text-[15px] font-display">Patients This Month</span>
            <span className="text-xs text-text-muted">{lastMonth.label}</span>
          </div>
          <div className="p-4">
            <p className="text-4xl font-bold mb-4 font-display">{lastMonth.total}</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(lastMonth.diseases).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([d, v]) => (
                <span key={d} className="text-[11px] px-2.5 py-1 rounded-md bg-bg-secondary text-text-secondary">{d}: {v}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header">
          <span className="font-bold text-[15px] font-display">Medicine Stock Overview</span>
          <button className="btn btn-sm btn-secondary" onClick={() => go('medicine')}>Manage</button>
        </div>
        <div className="p-3">
          <table className="data-table">
            <thead><tr><th>Medicine</th><th>Stock</th><th>Status</th><th>Level</th></tr></thead>
            <tbody>
              {hc.medicines.slice(0, 6).map((m) => {
                const st = stockStatus(m.stock, m.max_stock);
                const pct = Math.round((m.stock / m.max_stock) * 100);
                return (
                  <tr key={m.id}>
                    <td className="text-text-primary font-medium">{m.name}</td>
                    <td>{m.stock} / {m.max_stock}</td>
                    <td><span className={`badge ${STOCK_BADGE_CLASS[st]}`}>{STOCK_LABEL[st]}</span></td>
                    <td className="w-[120px]"><div className="stock-bar"><div className="stock-bar-fill" style={{ width: `${pct}%`, background: STOCK_HEX[st] }} /></div></td>
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

function BarRow({ label, value, pct, color, valueClass }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs mb-1"><span className="text-text-secondary">{label}</span><span className={`font-semibold ${valueClass}`}>{value}</span></div>
      <div className="stock-bar"><div className="stock-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}
