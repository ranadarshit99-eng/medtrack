import { useMemo, useState } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/UI';
import { stockStatus } from '../utils';
import { chartColors, baseOptions, donutOptions } from '../charts/setup';
import AIMedicineDetailModal from '../components/AIMedicineDetailModal';
import AIAdminPanel from '../components/AIAdminPanel';

export default function AdminDashboard() {
  const { navigateTo, notifications } = useApp();
  const [selectedMed, setSelectedMed] = useState(null);
  const { data: allHCs, loading } = useFetch(() => api.listHealthCenters(false), []);
  const { data: monthly } = useFetch(() => api.aggregateAnalytics('monthly'), []);
  const { data: adminAlerts, loading: alertsLoading } = useFetch(() => api.adminAlerts(), []);

  const reg = useMemo(() => (allHCs || []).filter((h) => h.registered), [allHCs]);
  const pending = useMemo(() => (allHCs || []).filter((h) => !h.registered), [allHCs]);

  const totalBeds = reg.reduce((s, h) => s + h.beds.total, 0);
  const totalOccupied = reg.reduce((s, h) => s + h.beds.occupied, 0);
  const totalFree = totalBeds - totalOccupied;
  const totalPatients = monthly?.length ? monthly[monthly.length - 1].total : 0;
  const lowStockCount = reg.reduce((s, h) => s + h.medicines.filter((m) => stockStatus(m.stock, m.max_stock) === 'low').length, 0);

  const lowStockHCs = useMemo(() => reg
    .map((h) => ({ ...h, lowMeds: h.medicines.filter((m) => stockStatus(m.stock, m.max_stock) === 'low') }))
    .filter((h) => h.lowMeds.length > 0)
    .sort((a, b) => b.lowMeds.length - a.lowMeds.length)
    .slice(0, 4), [reg]);

  const depletingMeds = useMemo(() => {
    return (adminAlerts || [])
      .filter(a => a.code === 'MED_DEPLETION')
      .map(a => {
        const medName = a.title.replace("Medicine stock depletion: ", "");
        const match = a.message.match(/within (\d+) days/);
        const days = match ? parseInt(match[1]) : 7;
        return { ...a, medName, days };
      })
      .sort((a, b) => a.days - b.days);
  }, [adminAlerts]);

  if (loading) return <SkeletonDash />;

  return (
    <div className="animate-fadeUp">
      <AIAdminPanel />
      {selectedMed && (
        <AIMedicineDetailModal
          medicineName={selectedMed.name}
          hcId={selectedMed.hcId}
          hcName={selectedMed.hcName}
          onClose={() => setSelectedMed(null)}
        />
      )}

      {/* AI Medicine Stock Alerts Section */}
      <div className="data-card mb-6 overflow-hidden border border-warning/30 bg-gradient-to-r from-warning/[0.04] to-transparent">
        <div className="data-card-header bg-bg-secondary flex justify-between items-center py-3">
          <span className="font-bold text-xs uppercase tracking-wider text-text-secondary flex items-center gap-2">
            <i className="fas fa-brain text-accent" />System-Wide AI Medicine Stock Alerts
          </span>
          <span className="text-[11px] text-text-muted">{depletingMeds.length} Low Stock Warnings</span>
        </div>
        <div className="p-4">
          {alertsLoading ? (
            <div className="animate-pulse h-12 bg-bg-secondary rounded-lg" />
          ) : depletingMeds.length === 0 ? (
            <div className="flex items-center gap-2 text-[13px] text-text-secondary py-1">
              <i className="fas fa-circle-check text-accent text-base" />
              <span>All health center medicine stocks are stable.</span>
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {depletingMeds.map(alert => {
                const isCritical = alert.days <= 7;
                return (
                  <div
                    key={alert.hc_id + '_' + alert.medName}
                    onClick={() => {
                      setSelectedMed({ name: alert.medName, hcId: alert.hc_id, hcName: alert.hc_name });
                    }}
                    className="px-4 py-3 bg-bg-card border border-border rounded-xl cursor-pointer hover:border-accent hover:-translate-y-0.5 transition-all flex justify-between items-center group"
                    style={{ borderLeft: `3px solid ${isCritical ? '#dc2626' : '#0ea5e9'}` }}
                  >
                    <div>
                      <p className="font-bold text-xs text-text-primary">{alert.medName}</p>
                      <p className="text-[11px] text-text-muted mt-0.5">{alert.hc_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`badge ${isCritical ? 'badge-low font-bold animate-pulse' : 'badge-mid'}`}>
                        {alert.days} Days Left
                      </span>
                      <p className="text-[10px] text-text-muted mt-1 group-hover:text-accent transition-colors">View details →</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <StatCard label="Health Centers" value={reg.length} sub={`${pending.length} pending requests`}
          icon="fa-hospital" iconBg="rgba(16,185,129,0.15)" iconColor={chartColors.accent} glowColor={chartColors.accent} />
        <StatCard label="Total Beds" value={totalBeds} sub={`${totalFree} available`} subClass="text-info"
          icon="fa-bed" iconBg="rgba(37,99,235,0.15)" iconColor={chartColors.info} glowColor={chartColors.info} />
        <StatCard label="Patients This Month" value={totalPatients} sub="↑ 12% from last month" subClass="text-accent"
          icon="fa-users" iconBg="rgba(14,165,233,0.15)" iconColor={chartColors.warning} glowColor={chartColors.warning} />
        <StatCard label="Low Stock Alerts" value={lowStockCount} sub="Needs attention" subClass="text-danger" pulse={lowStockCount > 0}
          icon="fa-triangle-exclamation" iconBg="rgba(220,38,38,0.15)" iconColor={chartColors.danger} glowColor={chartColors.danger} />
      </div>

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="data-card">
          <div className="data-card-header">
            <span className="font-bold text-[15px] font-display">Patient Trend</span>
            <span className="text-xs text-text-muted">Last 12 months (all centers)</span>
          </div>
          <div className="p-4 h-[280px]">
            {monthly && (
              <Line
                data={{
                  labels: monthly.map((p) => p.label),
                  datasets: [{
                    label: 'Total Patients', data: monthly.map((p) => p.total),
                    borderColor: chartColors.accent, backgroundColor: chartColors.accentLight,
                    fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: chartColors.accent, borderWidth: 2.5,
                  }],
                }}
                options={{ ...baseOptions, plugins: { ...baseOptions.plugins, legend: { display: false } } }}
              />
            )}
          </div>
        </div>
        <div className="data-card">
          <div className="data-card-header"><span className="font-bold text-[15px] font-display">Bed Occupancy</span></div>
          <div className="p-4 flex flex-col items-center">
            <div className="h-[200px] w-[200px]">
              <Doughnut
                data={{ labels: ['Occupied', 'Available'], datasets: [{ data: [totalOccupied, totalFree], backgroundColor: [chartColors.info, chartColors.accent], borderWidth: 0, hoverOffset: 6 }] }}
                options={donutOptions('72%')}
              />
            </div>
            <div className="flex gap-5 mt-4">
              <div className="text-center"><p className="text-xl font-bold text-info">{totalOccupied}</p><p className="text-[11px] text-text-muted">Occupied</p></div>
              <div className="text-center"><p className="text-xl font-bold text-accent">{totalFree}</p><p className="text-[11px] text-text-muted">Available</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="data-card">
          <div className="data-card-header">
            <span className="font-bold text-[15px] font-display"><i className="fas fa-triangle-exclamation text-danger mr-1.5 text-[13px]" />Low Medicine Stock</span>
            <button className="btn btn-sm btn-secondary" onClick={() => navigateTo('medicine')}>View All</button>
          </div>
          <div className="p-3">
            {lowStockHCs.length === 0 && <p className="text-text-muted text-sm text-center py-4">No low-stock centers right now.</p>}
            {lowStockHCs.map((hc) => (
              <div key={hc.id} className="px-3 py-2.5 border-b border-border last:border-b-0 flex justify-between items-center">
                <div>
                  <p className="text-[13px] font-semibold">{hc.name}</p>
                  <p className="text-[11px] text-text-muted">{hc.lowMeds.map((m) => m.name).join(', ')}</p>
                </div>
                <span className="badge badge-low">{hc.lowMeds.length} items</span>
              </div>
            ))}
          </div>
        </div>
        <div className="data-card">
          <div className="data-card-header"><span className="font-bold text-[15px] font-display"><i className="fas fa-clock text-warning mr-1.5 text-[13px]" />Recent Activity</span></div>
          <div className="p-3">
            {notifications.slice(0, 5).map((n) => (
              <div key={n.id} className="px-3 py-2.5 border-b border-border last:border-b-0 flex gap-2.5 items-start">
                <div className="w-7 h-7 min-w-7 rounded-md flex items-center justify-center" style={{ background: n.type === 'alert' ? 'rgba(220,38,38,0.2)' : 'rgba(14,165,233,0.2)' }}>
                  <i className={`fas ${n.type === 'alert' ? 'fa-exclamation' : 'fa-file'} text-[11px]`} style={{ color: n.type === 'alert' ? '#dc2626' : '#0ea5e9' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs leading-snug truncate">{n.message}</p>
                  <p className="text-[11px] text-text-muted">{n.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonDash() {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {[0, 1, 2, 3].map((i) => <div key={i} className="stat-card h-[110px] animate-pulse bg-bg-card" />)}
    </div>
  );
}
