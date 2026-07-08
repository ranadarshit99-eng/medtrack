import { useMemo, useState } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { useApp } from '../context/AppContext';
import { occupancyColorHex } from '../utils';
import { chartColors, baseOptions, donutOptions } from '../charts/setup';

export default function BedsAdmin() {
  const { searchQuery, openModal, closeModal } = useApp();
  const [locationSearch, setLocationSearch] = useState('');
  const { data: allHCs, loading } = useFetch(() => api.listHealthCenters(false), []);
  const q = searchQuery.toLowerCase();
  
  const reg = useMemo(() => (allHCs || [])
    .filter((h) => h.registered)
    .filter((h) => !q || h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q)), [allHCs, q]);

  const filteredHCs = useMemo(() => {
    return reg.filter((h) => {
      if (!locationSearch) return true;
      return h.location.toLowerCase().includes(locationSearch.toLowerCase());
    });
  }, [reg, locationSearch]);

  if (loading) return <p className="text-text-muted">Loading…</p>;

  const totalBeds = filteredHCs.reduce((s, h) => s + h.beds.total, 0);
  const totalOcc = filteredHCs.reduce((s, h) => s + h.beds.occupied, 0);
  const totalFree = totalBeds - totalOcc;
  const occPct = totalBeds ? Math.round((totalOcc / totalBeds) * 100) : 0;

  const showBedDetailModal = (h) => {
    openModal(
      <ClinicBedDetailModal hc={h} onClose={closeModal} />
    );
  };

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
                labels: filteredHCs.map((h) => h.name.split(' ')[0]),
                datasets: [
                  { label: 'Occupied', data: filteredHCs.map((h) => h.beds.occupied), backgroundColor: chartColors.warning, borderRadius: 6, barPercentage: 0.6 },
                  { label: 'Available', data: filteredHCs.map((h) => h.beds.total - h.beds.occupied), backgroundColor: chartColors.accent, borderRadius: 6, barPercentage: 0.6 },
                ],
              }}
              options={{ ...baseOptions, scales: { x: { ...baseOptions.scales.x, stacked: true }, y: { ...baseOptions.scales.y, stacked: true } } }}
            />
          </div>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="font-bold text-[15px] font-display block">Health Center Bed Details</span>
            <span className="text-xs text-text-muted">Click any clinic to see the detailed bed type breakdown.</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Location Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by location..."
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="form-input py-1.5 px-3 text-xs w-[200px] pl-7"
              />
              <i className="fas fa-map-marker-alt absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
            </div>
          </div>
        </div>
        <table className="data-table">
          <thead><tr><th>Health Center</th><th>Location</th><th>Total</th><th>Occupied</th><th>Available</th><th>Occupancy Rate</th></tr></thead>
          <tbody>
            {filteredHCs.map((h) => {
              const f = h.beds.total - h.beds.occupied;
              const pct = h.beds.total ? Math.round((h.beds.occupied / h.beds.total) * 100) : 0;
              const color = occupancyColorHex(pct);
              return (
                <tr key={h.id} className="cursor-pointer hover:bg-bg-secondary transition-all" onClick={() => showBedDetailModal(h)}>
                  <td className="text-text-primary font-semibold">{h.name}</td>
                  <td className="text-text-secondary text-xs">{h.location}</td>
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

function ClinicBedDetailModal({ hc, onClose }) {
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' or 'layout'
  const [selectedSector, setSelectedSector] = useState('All');
  const [bedSearch, setBedSearch] = useState('');

  // Calculate sector-wise breakdown
  const sectors = ['General', 'ICU', 'Operation'];
  const breakdown = useMemo(() => {
    return sectors.map((sec) => {
      const bedsInSec = (hc.beds_list || []).filter((b) => b.sector === sec);
      const total = bedsInSec.length;
      const occupied = bedsInSec.filter((b) => b.status === 'occupied').length;
      const available = total - occupied;
      const pct = total ? Math.round((occupied / total) * 100) : 0;
      return { sector: sec, total, occupied, available, pct };
    });
  }, [hc]);

  const filteredBeds = useMemo(() => {
    return (hc.beds_list || []).filter((bed) => {
      const matchesSector = selectedSector === 'All' || bed.sector === selectedSector;
      const matchesSearch =
        !bedSearch ||
        bed.number.toLowerCase().includes(bedSearch.toLowerCase()) ||
        (bed.patient_name && bed.patient_name.toLowerCase().includes(bedSearch.toLowerCase())) ||
        (bed.patient_disease && bed.patient_disease.toLowerCase().includes(bedSearch.toLowerCase()));
      return matchesSector && matchesSearch;
    });
  }, [hc, selectedSector, bedSearch]);

  const free = hc.beds.total - hc.beds.occupied;

  return (
    <div className="animate-fadeUp text-left max-w-4xl w-full">
      {/* Modal Header */}
      <div className="flex justify-between items-start mb-5 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <i className="fas fa-hospital text-accent text-lg" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-display text-text-primary">{hc.name}</h3>
            <p className="text-[12px] text-text-muted flex items-center gap-1">
              <i className="fas fa-map-marker-alt" /> {hc.location}
            </p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="bg-transparent border-none text-text-muted hover:text-text-primary cursor-pointer text-lg">
          <i className="fas fa-times" />
        </button>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-border mb-4">
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2.5 font-semibold text-xs border-b-2 transition-all ${
            activeTab === 'stats'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <i className="fas fa-chart-pie mr-1.5" /> Availability Stats
        </button>
        <button
          onClick={() => setActiveTab('layout')}
          className={`px-4 py-2.5 font-semibold text-xs border-b-2 transition-all ${
            activeTab === 'layout'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <i className="fas fa-bed mr-1.5" /> Ward Layout Map
        </button>
      </div>

      {activeTab === 'stats' ? (
        <div className="space-y-5">
          {/* Quick Stats Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-bg-secondary p-3.5 rounded-xl border border-border text-center">
              <p className="text-[20px] font-bold font-display text-info">{hc.beds.total}</p>
              <p className="text-[10px] uppercase font-semibold text-text-muted tracking-wide">Total Beds</p>
            </div>
            <div className="bg-bg-secondary p-3.5 rounded-xl border border-border text-center">
              <p className="text-[20px] font-bold font-display text-warning">{hc.beds.occupied}</p>
              <p className="text-[10px] uppercase font-semibold text-text-muted tracking-wide">Occupied</p>
            </div>
            <div className="bg-bg-secondary p-3.5 rounded-xl border border-border text-center">
              <p className="text-[20px] font-bold font-display text-accent">{free}</p>
              <p className="text-[10px] uppercase font-semibold text-text-muted tracking-wide">Available</p>
            </div>
          </div>

          {/* Sector-wise Cards */}
          <div>
            <h4 className="text-xs font-bold mb-3 uppercase tracking-wider text-text-primary">Bed Type Availability</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {breakdown.map((b) => {
                const color = occupancyColorHex(b.pct);
                return (
                  <div key={b.sector} className="p-4 bg-bg-card rounded-xl border border-border shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-sm text-text-primary">{b.sector}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-bg-secondary border border-border text-text-secondary">
                        {b.pct}% Occ.
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-text-secondary mb-3">
                      <div className="flex justify-between"><span>Total Capacity:</span><span className="font-semibold text-text-primary">{b.total}</span></div>
                      <div className="flex justify-between"><span>Occupied:</span><span className="font-semibold text-warning">{b.occupied}</span></div>
                      <div className="flex justify-between"><span>Available:</span><span className="font-semibold text-accent">{b.available}</span></div>
                    </div>
                    <div className="stock-bar h-2">
                      <div className="stock-bar-fill rounded-full" style={{ width: `${b.pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex bg-bg-secondary p-0.5 rounded-lg border border-border">
              {['All', 'General', 'ICU', 'Operation'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSector(s)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    selectedSector === s ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search patient / bed..."
                value={bedSearch}
                onChange={(e) => setBedSearch(e.target.value)}
                className="form-input py-1.5 px-3 text-xs w-[180px] pl-7"
              />
              <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-text-secondary pb-2 border-b border-border">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#10b981] inline-block" />
              <span>Vacant</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#60a5fa] inline-block" />
              <span>Male Occupied</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#f472b6] inline-block" />
              <span>Female Occupied</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#c084fc] inline-block" />
              <span>Other Occupied</span>
            </div>
          </div>

          {/* Grid Container */}
          <div className="max-h-[300px] overflow-y-auto pr-1">
            {filteredBeds.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-xs">
                No beds match your filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {filteredBeds.map((bed) => {
                  const isOccupied = bed.status === 'occupied';
                  let bedBg = 'bg-[#10b981]/10 border-[#10b981]/30 hover:border-[#10b981]';
                  let bedText = 'text-[#10b981]';
                  
                  if (isOccupied) {
                    if (bed.patient_gender === 'Male') {
                      bedBg = 'bg-[#60a5fa]/10 border-[#60a5fa]/30 hover:border-[#60a5fa]';
                      bedText = 'text-[#2563eb]';
                    } else if (bed.patient_gender === 'Female') {
                      bedBg = 'bg-[#f472b6]/10 border-[#f472b6]/30 hover:border-[#f472b6]';
                      bedText = 'text-[#db2777]';
                    } else {
                      bedBg = 'bg-[#c084fc]/10 border-[#c084fc]/30 hover:border-[#c084fc]';
                      bedText = 'text-[#7c3aed]';
                    }
                  }

                  return (
                    <div
                      key={bed.id}
                      className={`flex flex-col items-center justify-between p-2 rounded-lg border text-center shadow-sm relative group transition-all ${bedBg}`}
                    >
                      <div className="text-[9px] font-bold text-text-muted uppercase mb-1">
                        {bed.number}
                      </div>
                      
                      <i className={`fas fa-bed text-base ${bedText}`} />

                      <div className="text-[10px] font-semibold mt-1.5 w-full truncate px-0.5">
                        {isOccupied ? (
                          <span className="text-text-primary font-bold block">{bed.patient_name}</span>
                        ) : (
                          <span className="text-[#10b981] font-medium block">Vacant</span>
                        )}
                      </div>

                      {/* Tooltip on hover */}
                      {isOccupied && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-bg-card border border-border p-2.5 rounded-lg shadow-xl text-left hidden group-hover:block z-20 pointer-events-none">
                          <p className="font-bold text-xs text-text-primary mb-1">{bed.patient_name}</p>
                          <p className="text-[10px] text-text-secondary mb-0.5">Age/Gender: {bed.patient_gender}, {bed.patient_age} yrs</p>
                          <p className="text-[10px] text-text-secondary mb-0.5">Diagnosis: {bed.patient_disease}</p>
                          <p className="text-[10px] text-text-muted">Admitted: {bed.allocated_at || 'N/A'}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

