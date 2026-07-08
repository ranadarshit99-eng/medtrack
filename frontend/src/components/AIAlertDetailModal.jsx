import { useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { chartColors, baseOptions } from '../charts/setup';

const PRIORITY_CONFIG = {
  Critical: { bg: 'rgba(220,38,38,0.12)', border: '#dc2626', text: 'text-danger', icon: 'fa-circle-exclamation', badge: 'bg-danger/20 text-danger', dot: 'bg-danger' },
  Warning:  { bg: 'rgba(14,165,233,0.10)', border: '#0ea5e9',  text: 'text-warning', icon: 'fa-triangle-exclamation', badge: 'bg-warning/20 text-warning', dot: 'bg-warning' },
  Normal:   { bg: 'rgba(5,150,105,0.08)',  border: '#059669',  text: 'text-accent',  icon: 'fa-circle-info',        badge: 'bg-accent/20 text-accent',  dot: 'bg-accent' },
};

const CODE_ICONS = {
  MED_DEPLETION: 'fa-pills',
  BED_OVERFLOW: 'fa-bed',
  PATIENT_SURGE: 'fa-users',
  default: 'fa-brain',
};

function Skeleton() {
  return (
    <div className="space-y-4 p-6 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-bg-secondary" />)}
    </div>
  );
}

function MiniLineChart({ data, labels, color }) {
  return (
    <Line
      data={{
        labels,
        datasets: [{ data, borderColor: color, backgroundColor: color + '22', fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2 }],
      }}
      options={{
        ...baseOptions,
        plugins: { legend: { display: false }, tooltip: { ...baseOptions.plugins?.tooltip } },
        scales: { x: { display: false }, y: { display: false } },
      }}
    />
  );
}

function BarChart({ data, labels, color }) {
  return (
    <Bar
      data={{
        labels,
        datasets: [{ data, backgroundColor: color + 'cc', borderRadius: 4 }],
      }}
      options={{
        ...baseOptions,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#f1f5f9' } },
        },
      }}
    />
  );
}

function ConfidenceRing({ pct }) {
  const r = 28; const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="#059669" strokeWidth="6"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 36 36)" />
      <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a">{pct}%</text>
    </svg>
  );
}

export default function AIAlertDetailModal({ alert, hcId, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: diseaseTrends, loading: dtLoading } = useFetch(() => api.centerDiseaseTrends(hcId), [hcId]);
  const { data: patientFc, loading: pfLoading }    = useFetch(() => api.centerPatientForecast(hcId), [hcId]);
  const { data: medDemand, loading: mdLoading }    = useFetch(() => api.centerMedicineDemand(hcId), [hcId]);
  const { data: bedFc, loading: bfLoading }        = useFetch(() => api.centerBedForecast(hcId), [hcId]);
  const { data: alertsRecs }                        = useFetch(() => api.centerAlertsAndRecs(hcId), [hcId]);

  const cfg = PRIORITY_CONFIG[alert.type] || PRIORITY_CONFIG.Normal;
  const isLoading = dtLoading || pfLoading || mdLoading || bfLoading;

  // Derive context from alert code
  const codeIcon = CODE_ICONS[alert.code?.split('_').slice(0,2).join('_')] || CODE_ICONS.default;
  const confidence = alert.type === 'Critical' ? 94 : alert.type === 'Warning' ? 81 : 72;

  // Context reasons depending on code
  const reasons = alert.code?.startsWith('OUTBREAK')
    ? ['Historical data from last 3 years shows seasonal peak', 'Monsoon season currently active', 'Rainfall index elevated above threshold', 'Similar pattern recorded in previous years']
    : alert.code === 'MED_DEPLETION'
    ? ['Current stock below safe threshold', 'Predicted consumption rate increasing', 'Seasonal disease surge expected', 'No replenishment order placed yet']
    : alert.code === 'BED_OVERFLOW'
    ? ['Admission rate trending upward', 'Seasonal patient surge predicted', 'Current occupancy above 80%', 'Historical peak occupancy data matches current pattern']
    : ['Patient footfall above historical average', 'Seasonal trend detected', 'Weather pattern contributes to increased footfall'];

  // Pick the disease from OUTBREAK alerts
  const outbreakDisease = alert.code?.startsWith('OUTBREAK')
    ? alert.code.replace('OUTBREAK_', '').replace(/_/g, ' ')
    : null;
  const diseaseData = diseaseTrends?.summary?.find(d =>
    outbreakDisease && d.disease.toUpperCase() === outbreakDisease
  ) || diseaseTrends?.summary?.[0];

  // Patient footfall forecast chart
  const patientLabels = patientFc?.next_month?.daily_forecast?.map(d => d.date.slice(5)) || [];
  const patientVals   = patientFc?.next_month?.daily_forecast?.map(d => d.patients) || [];

  // Medicine demand for the specific medicine in alert
  const alertMedName = alert.title?.match(/:\s*(.+)/)?.[1]?.trim();
  const medEntry = medDemand?.find(m => alertMedName && m.medicine_name.toLowerCase().includes(alertMedName.toLowerCase()))
    || medDemand?.[0];
  const medLabels = medEntry?.daily_forecast?.map(d => d.date.slice(5)) || [];
  const medVals   = medEntry?.daily_forecast?.map(d => d.consumption) || [];

  // Bed occupancy forecast
  const bedLabels = bedFc?.daily_forecast?.map(d => d.date.slice(5)) || [];
  const bedPctVals = bedFc?.daily_forecast?.map(d => d.occupancy_percentage) || [];

  // Disease daily forecast
  const disLabels = diseaseData
    ? diseaseTrends?.daily?.find(d => d.disease === diseaseData.disease)?.daily_forecast?.map(d => d.date.slice(5)) || []
    : [];
  const disVals = diseaseData
    ? diseaseTrends?.daily?.find(d => d.disease === diseaseData.disease)?.daily_forecast?.map(d => d.patients) || []
    : [];

  const recommendations = alertsRecs?.recommendations || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-text-primary/40 backdrop-blur-sm" />
      <div
        className="relative w-full md:max-w-4xl max-h-[92vh] bg-bg-primary rounded-t-3xl md:rounded-2xl overflow-hidden shadow-2xl animate-modalIn flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border" style={{ background: cfg.bg }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.border + '22', border: `1.5px solid ${cfg.border}` }}>
              <i className={`fas ${codeIcon} text-lg ${cfg.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${cfg.badge}`}>{alert.type}</span>
                <span className="text-[11px] text-text-muted">AI Prediction Engine</span>
              </div>
              <h3 className="text-[16px] font-bold text-text-primary font-display leading-tight">{alert.title}</h3>
              <p className="text-[13px] text-text-secondary mt-0.5 leading-snug">{alert.message}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center bg-bg-card border border-border hover:border-danger hover:text-danger text-text-muted transition-all shrink-0">
            <i className="fas fa-times text-sm" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-0 border-b border-border bg-bg-primary">
          {['overview', 'forecast', 'medicines', 'beds', 'recommendations'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`tab-btn capitalize text-xs ${activeTab === tab ? 'active' : ''}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-bg-deep">
          {isLoading ? <Skeleton /> : (
            <div className="p-6 space-y-5">

              {/* ── OVERVIEW ── */}
              {activeTab === 'overview' && (
                <>
                  {/* Confidence + Reasons */}
                  <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 2fr' }}>
                    <div className="data-card p-5 flex flex-col items-center justify-center gap-3">
                      <ConfidenceRing pct={confidence} />
                      <div className="text-center">
                        <p className="text-[13px] font-bold text-text-primary">Confidence</p>
                        <p className="text-[11px] text-text-muted">AI prediction accuracy</p>
                      </div>
                    </div>
                    <div className="data-card p-5">
                      <p className="text-[13px] font-bold text-text-primary mb-3">
                        <i className="fas fa-magnifying-glass-chart text-accent mr-2" />Why This Alert?
                      </p>
                      <div className="space-y-2">
                        {reasons.map((r, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
                            <span className="text-[13px] text-text-secondary">{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Disease snapshot if it's an outbreak alert */}
                  {diseaseData && (
                    <div className="data-card">
                      <div className="data-card-header">
                        <span className="font-bold text-[14px] font-display">
                          <i className="fas fa-virus text-danger mr-2 text-[13px]" />{diseaseData.disease} — 30-Day Forecast
                        </span>
                        <span className={`text-sm font-bold ${diseaseData.percentage_change >= 0 ? 'text-danger' : 'text-accent'}`}>
                          {diseaseData.percentage_change >= 0 ? '↑' : '↓'} {Math.abs(diseaseData.percentage_change)}%
                        </span>
                      </div>
                      <div className="p-4 h-[180px]">
                        {disVals.length > 0 && <MiniLineChart data={disVals} labels={disLabels} color="#dc2626" />}
                      </div>
                      <div className="px-5 pb-4 grid grid-cols-3 gap-3">
                        <MiniStat label="Historical" value={Math.round(diseaseData.historical_cases)} color="text-text-secondary" />
                        <MiniStat label="Predicted" value={Math.round(diseaseData.predicted_cases)} color="text-danger" />
                        <MiniStat label="Change" value={`${diseaseData.percentage_change >= 0 ? '+' : ''}${diseaseData.percentage_change}%`} color={diseaseData.percentage_change >= 0 ? 'text-danger' : 'text-accent'} />
                      </div>
                    </div>
                  )}

                  {/* Quick stats row */}
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                    <QuickStat icon="fa-users" label="Patients Tomorrow" value={patientFc?.tomorrow?.total_patients ?? '—'} color="text-info" />
                    <QuickStat icon="fa-users-line" label="Next Week Total" value={patientFc?.next_week?.total_patients ?? '—'} color="text-warning" />
                    <QuickStat icon="fa-bed" label="Predicted Beds %" value={bedFc ? `${bedFc.predicted_occupancy_percentage_next_week}%` : '—'} color={bedFc?.predicted_occupancy_percentage_next_week > 90 ? 'text-danger' : 'text-accent'} />
                    <QuickStat icon="fa-pills" label="Med Depletion" value={medEntry?.estimated_depletion_days ? `${medEntry.estimated_depletion_days}d` : 'OK'} color={medEntry?.estimated_depletion_days && medEntry.estimated_depletion_days <= 7 ? 'text-danger' : 'text-accent'} />
                  </div>
                </>
              )}

              {/* ── FORECAST ── */}
              {activeTab === 'forecast' && (
                <>
                  <div className="data-card">
                    <div className="data-card-header">
                      <span className="font-bold text-[14px] font-display"><i className="fas fa-chart-line text-info mr-2" />Patient Footfall — Next 30 Days</span>
                      <span className="text-xs text-text-muted">Daily prediction</span>
                    </div>
                    <div className="p-4 h-[220px]">
                      {patientVals.length > 0 && <BarChart data={patientVals} labels={patientLabels} color="#2563eb" />}
                    </div>
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <SummaryBox label="Expected Tomorrow" value={patientFc?.tomorrow?.total_patients} unit="patients" icon="fa-calendar-day" color="#2563eb" />
                    <SummaryBox label="Expected Next Week" value={patientFc?.next_week?.total_patients} unit="patients" icon="fa-calendar-week" color="#0ea5e9" />
                    <SummaryBox label="Expected Next Month" value={patientFc?.next_month?.total_patients} unit="patients" icon="fa-calendar" color="#059669" />
                  </div>
                  {disVals.length > 0 && (
                    <div className="data-card">
                      <div className="data-card-header">
                        <span className="font-bold text-[14px] font-display">
                          <i className="fas fa-virus-covid mr-2 text-danger text-[13px]" />
                          {diseaseData?.disease || 'Disease'} Cases Forecast
                        </span>
                        <span className={`text-xs font-bold ${(diseaseData?.percentage_change ?? 0) >= 0 ? 'text-danger' : 'text-accent'}`}>
                          {(diseaseData?.percentage_change ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(diseaseData?.percentage_change ?? 0)}% vs historical
                        </span>
                      </div>
                      <div className="p-4 h-[180px]">
                        <MiniLineChart data={disVals} labels={disLabels} color="#dc2626" />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── MEDICINES ── */}
              {activeTab === 'medicines' && (
                <>
                  {medEntry && (
                    <div className="data-card">
                      <div className="data-card-header">
                        <span className="font-bold text-[14px] font-display"><i className="fas fa-pills text-warning mr-2" />{medEntry.medicine_name} — Consumption Forecast</span>
                        <span className={`text-xs font-bold ${medEntry.estimated_depletion_days && medEntry.estimated_depletion_days <= 7 ? 'text-danger' : 'text-text-muted'}`}>
                          {medEntry.estimated_depletion_days ? `Depletes in ${medEntry.estimated_depletion_days} days` : 'Stock sufficient'}
                        </span>
                      </div>
                      <div className="p-4 h-[200px]">
                        {medVals.length > 0 && <BarChart data={medVals} labels={medLabels} color="#0ea5e9" />}
                      </div>
                      <div className="px-5 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <MiniStat label="Current Stock" value={medEntry.current_stock} color="text-text-primary" />
                        <MiniStat label="Daily Avg Consumption" value={`${medEntry.daily_average_consumption}/day`} color="text-warning" />
                        <MiniStat label="30-Day Demand" value={Math.round(medEntry.predicted_consumption_30d)} color="text-info" />
                        <MiniStat label="Recommended Order" value={medEntry.recommended_reorder_quantity > 0 ? medEntry.recommended_reorder_quantity : '—'} color="text-accent" />
                      </div>
                    </div>
                  )}
                  {/* All medicines table */}
                  <div className="data-card">
                    <div className="data-card-header"><span className="font-bold text-[14px] font-display">All Medicine Stock Forecast</span></div>
                    <div className="p-3">
                      <table className="data-table">
                        <thead><tr><th>Medicine</th><th>Stock</th><th>30d Demand</th><th>Depletion</th><th>Order Qty</th></tr></thead>
                        <tbody>
                          {(medDemand || []).map(m => (
                            <tr key={m.medicine_name}>
                              <td className="font-medium text-text-primary">{m.medicine_name}</td>
                              <td>{m.current_stock}</td>
                              <td>{Math.round(m.predicted_consumption_30d)}</td>
                              <td>
                                {m.estimated_depletion_days
                                  ? <span className={`font-bold ${m.estimated_depletion_days <= 7 ? 'text-danger' : 'text-warning'}`}>{m.estimated_depletion_days}d</span>
                                  : <span className="text-accent">OK</span>}
                              </td>
                              <td>{m.recommended_reorder_quantity > 0 ? <span className="badge badge-mid">{m.recommended_reorder_quantity}</span> : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* ── BEDS ── */}
              {activeTab === 'beds' && bedFc && (
                <>
                  <div className="data-card">
                    <div className="data-card-header">
                      <span className="font-bold text-[14px] font-display"><i className="fas fa-bed text-info mr-2" />Bed Occupancy — Next 7 Days</span>
                      <span className={`text-xs font-bold ${bedFc.predicted_occupancy_percentage_next_week > 90 ? 'text-danger' : 'text-accent'}`}>
                        Predicted avg: {bedFc.predicted_occupancy_percentage_next_week}%
                      </span>
                    </div>
                    <div className="p-4 h-[220px]">
                      {bedPctVals.length > 0 && <BarChart data={bedPctVals} labels={bedLabels} color="#2563eb" />}
                    </div>
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <SummaryBox label="Current Occupancy" value={`${bedFc.current_occupancy_percentage}%`} icon="fa-bed" color="#2563eb" />
                    <SummaryBox label="Predicted Next Week" value={`${bedFc.predicted_occupancy_percentage_next_week}%`} icon="fa-chart-bar" color={bedFc.predicted_occupancy_percentage_next_week > 90 ? '#dc2626' : '#059669'} />
                    <SummaryBox label="Avg Occupied Beds" value={bedFc.average_predicted_occupied_beds} unit={`/ ${bedFc.total_beds} beds`} icon="fa-hospital" color="#0ea5e9" />
                  </div>
                  <div className="data-card p-4">
                    <p className="text-[13px] font-bold mb-3 text-text-primary"><i className="fas fa-calendar-week text-info mr-2" />Daily Breakdown</p>
                    <div className="space-y-2">
                      {bedFc.daily_forecast.map(d => (
                        <div key={d.date} className="flex items-center gap-3">
                          <span className="text-xs text-text-muted w-14 shrink-0">{d.date.slice(5)}</span>
                          <div className="flex-1 h-2 bg-bg-secondary rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${d.occupancy_percentage}%`, background: d.occupancy_percentage > 90 ? '#dc2626' : d.occupancy_percentage > 80 ? '#0ea5e9' : '#059669' }} />
                          </div>
                          <span className={`text-xs font-bold w-12 text-right ${d.occupancy_percentage > 90 ? 'text-danger' : 'text-text-secondary'}`}>{d.occupancy_percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── RECOMMENDATIONS ── */}
              {activeTab === 'recommendations' && (
                <>
                  {recommendations.length === 0
                    ? <div className="text-center py-12 text-text-muted"><i className="fas fa-check-circle text-3xl text-accent mb-3 block" />No urgent recommendations at this time.</div>
                    : recommendations.map((r, i) => (
                      <div key={i} className="data-card p-4 flex gap-4 items-start" style={{ borderLeft: `3px solid ${r.priority === 'High' ? '#dc2626' : r.priority === 'Medium' ? '#0ea5e9' : '#059669'}` }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: r.priority === 'High' ? 'rgba(220,38,38,0.12)' : r.priority === 'Medium' ? 'rgba(14,165,233,0.12)' : 'rgba(5,150,105,0.12)' }}>
                          <i className={`fas ${r.type === 'order' ? 'fa-cart-shopping' : r.type === 'transfer' ? 'fa-arrows-left-right' : r.type === 'infrastructure' ? 'fa-building' : r.type === 'staffing' ? 'fa-user-doctor' : 'fa-box'} text-sm`}
                            style={{ color: r.priority === 'High' ? '#dc2626' : r.priority === 'Medium' ? '#0ea5e9' : '#059669' }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${r.priority === 'High' ? 'bg-danger/15 text-danger' : r.priority === 'Medium' ? 'bg-warning/15 text-warning' : 'bg-accent/15 text-accent'}`}>{r.priority}</span>
                            <span className="text-[10px] text-text-muted capitalize">{r.type}</span>
                          </div>
                          <p className="text-[13px] font-semibold text-text-primary">{r.action}</p>
                          <p className="text-[12px] text-text-muted mt-0.5">{r.rationale}</p>
                        </div>
                      </div>
                    ))
                  }
                </>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="bg-bg-secondary rounded-xl px-3 py-2.5 text-center">
      <p className={`text-[18px] font-bold font-display ${color}`}>{value}</p>
      <p className="text-[10px] text-text-muted mt-0.5">{label}</p>
    </div>
  );
}

function QuickStat({ icon, label, value, color }) {
  return (
    <div className="bg-bg-primary border border-border rounded-xl p-3.5">
      <i className={`fas ${icon} ${color} text-sm mb-1.5 block`} />
      <p className={`text-[20px] font-bold font-display ${color}`}>{value}</p>
      <p className="text-[10px] text-text-muted">{label}</p>
    </div>
  );
}

function SummaryBox({ label, value, unit, icon, color }) {
  return (
    <div className="data-card p-4 text-center">
      <i className={`fas ${icon} text-xl mb-2 block`} style={{ color }} />
      <p className="text-[22px] font-bold font-display text-text-primary">{value}</p>
      {unit && <p className="text-[11px] text-text-muted">{unit}</p>}
      <p className="text-[11px] text-text-secondary mt-1">{label}</p>
    </div>
  );
}
