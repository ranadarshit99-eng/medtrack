import { useMemo } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { useApp } from '../context/AppContext';
import { occupancyColorHex } from '../utils';
import { chartColors, baseOptions, donutOptions } from '../charts/setup';

export default function BedsAdmin() {
  const { searchQuery } = useApp();
  const { data: allHCs, loading } = useFetch(() => api.listHealthCenters(false), []);
  const q = searchQuery.toLowerCase();
  const reg = useMemo(() => (allHCs || [])
    .filter((h) => h.registered)
    .filter((h) => !q || h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q)), [allHCs, q]);

  if (loading) return <p className="text-text-muted">Loading…</p>;

  const totalBeds = reg.reduce((s, h) => s + h.beds.total, 0);
  const totalOcc = reg.reduce((s, h) => s + h.beds.occupied, 0);
  const totalFree = totalBeds - totalOcc;
  const occPct = totalBeds ? Math.round((totalOcc / totalBeds) * 100) : 0;

  return (
    <div className="animate-fadeUp">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MiniStat label="Total Beds" value={totalBeds} color="text-info" />
        <MiniStat label="Occupied" value={<>{totalOcc} <span className="text-base text-text-muted">({occPct}%)</span></>} color="text-warning" />
        <MiniStat label="Available" value={totalFree} color="text-accent" />
      </div>

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="data-card">
          <div className="data-card-header"><span className="font-bold text-[15px] font-display">Occupancy Overview</span></div>
          <div className="p-4 flex items-center justify-center h-[280px]">
            <div className="h-[240px] w-[240px]">
              <Doughnut data={{ labels: ['Occupied', 'Available'], datasets: [{ data: [totalOcc, totalFree], backgroundColor: [chartColors.warning, chartColors.accent], borderWidth: 0, hoverOffset: 6 }] }} options={donutOptions('68%')} />
            </div>
          </div>
        </div>
        <div className="data-card">
          <div className="data-card-header"><span className="font-bold text-[15px] font-display">Beds by Health Center</span></div>
          <div className="p-4 h-[280px]">
            <Bar
              data={{
                labels: reg.map((h) => h.name.split(' ')[0]),
                datasets: [
                  { label: 'Occupied', data: reg.map((h) => h.beds.occupied), backgroundColor: chartColors.warning, borderRadius: 6, barPercentage: 0.6 },
                  { label: 'Available', data: reg.map((h) => h.beds.total - h.beds.occupied), backgroundColor: chartColors.accent, borderRadius: 6, barPercentage: 0.6 },
                ],
              }}
              options={{ ...baseOptions, scales: { x: { ...baseOptions.scales.x, stacked: true }, y: { ...baseOptions.scales.y, stacked: true } } }}
            />
          </div>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header"><span className="font-bold text-[15px] font-display">Health Center Bed Details</span></div>
        <table className="data-table">
          <thead><tr><th>Health Center</th><th>Total</th><th>Occupied</th><th>Available</th><th>Occupancy Rate</th></tr></thead>
          <tbody>
            {reg.map((h) => {
              const f = h.beds.total - h.beds.occupied;
              const pct = h.beds.total ? Math.round((h.beds.occupied / h.beds.total) * 100) : 0;
              const color = occupancyColorHex(pct);
              return (
                <tr key={h.id}>
                  <td className="text-text-primary font-semibold">{h.name}</td>
                  <td>{h.beds.total}</td>
                  <td className="font-semibold" style={{ color }}>{h.beds.occupied}</td>
                  <td className="text-accent font-semibold">{f}</td>
                  <td className="w-[160px]">
                    <div className="flex items-center gap-2">
                      <div className="stock-bar flex-1"><div className="stock-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
                      <span className="text-xs font-semibold min-w-9" style={{ color }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="stat-card">
      <p className="text-xs text-text-muted mb-1.5 font-semibold uppercase tracking-wide">{label}</p>
      <p className={`text-[32px] font-bold font-display ${color}`}>{value}</p>
    </div>
  );
}
