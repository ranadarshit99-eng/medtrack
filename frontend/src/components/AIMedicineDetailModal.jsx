import { useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { chartColors, baseOptions } from '../charts/setup';

function Skeleton() {
  return (
    <div className="space-y-4 p-6 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-bg-secondary" />)}
    </div>
  );
}

function LineChart({ data, labels, color, label }) {
  return (
    <Line
      data={{
        labels,
        datasets: [{
          label,
          data,
          borderColor: color,
          backgroundColor: color + '15',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          borderWidth: 2
        }],
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

function BarChart({ data, labels, color }) {
  return (
    <Bar
      data={{
        labels,
        datasets: [{ data, backgroundColor: color, borderRadius: 6, barThickness: 45 }],
      }}
      options={{
        ...baseOptions,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 11, weight: '600' } }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#f1f5f9' } },
        },
      }}
    />
  );
}

export default function AIMedicineDetailModal({ medicineName, hcId, hcName, onClose }) {
  const [activeTab, setActiveTab] = useState('history');

  const { data: history, loading: hLoading } = useFetch(() => api.medicineHistory(medicineName, hcId), [medicineName, hcId]);
  const { data: medDemand, loading: mdLoading } = useFetch(() => api.centerMedicineDemand(hcId), [hcId]);
  const { data: alertsRecs } = useFetch(() => api.centerAlertsAndRecs(hcId), [hcId]);

  const isLoading = hLoading || mdLoading;

  // Filter current medicine demand details from the forecasting engine
  const medForecast = medDemand?.find(m => m.medicine_name.toLowerCase() === medicineName.toLowerCase()) || 
                      medDemand?.find(m => m.medicine_name.toLowerCase().includes(medicineName.toLowerCase())) ||
                      medDemand?.[0];

  const recs = (alertsRecs?.recommendations || []).filter(r => r.type === 'order' || r.type === 'transfer');

  // Yearly data
  const yearlyLabels = ['2023', '2024', '2025'];
  const yearlyVals   = yearlyLabels.map(y => history?.yearly?.[y] || 0);

  // Monthly historical data
  const monthlyLabels = history?.monthly?.map(m => m.label) || [];
  const monthlyVals   = history?.monthly?.map(m => m.consumption) || [];

  // Daily historical data (last 30 days)
  const dailyLabels = history?.daily?.map(d => d.date.slice(5)) || [];
  const dailyVals   = history?.daily?.map(d => d.consumption) || [];

  // Predicted 30-day forecast data
  const forecastLabels = medForecast?.daily_forecast?.map(d => d.date.slice(5)) || [];
  const forecastVals   = medForecast?.daily_forecast?.map(d => d.consumption) || [];

  const depletionDays = medForecast?.estimated_depletion_days;
  const isCritical = depletionDays !== null && depletionDays <= 7;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-text-primary/45 backdrop-blur-sm" />
      <div
        className="relative w-full md:max-w-3xl max-h-[90vh] bg-bg-primary rounded-t-3xl md:rounded-2xl overflow-hidden shadow-2xl animate-modalIn flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border"
          style={{ background: isCritical ? 'rgba(220,38,38,0.06)' : 'linear-gradient(135deg, rgba(5,150,105,0.06) 0%, rgba(37,99,235,0.04) 100%)' }}>
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-bg-card border border-border flex items-center justify-center text-lg text-warning shrink-0">
              <i className="fas fa-pills" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isCritical ? 'bg-danger/25 text-danger animate-pulse' : 'bg-warning/20 text-warning'}`}>
                  {isCritical ? 'Critical Stock' : 'Stock Alert'}
                </span>
                {hcName && <span className="text-[11px] text-text-muted">{hcName}</span>}
              </div>
              <h3 className="text-[16px] font-bold text-text-primary font-display leading-tight">{medicineName}</h3>
              <p className="text-[13px] text-text-secondary mt-0.5">
                {depletionDays !== null && depletionDays !== undefined
                  ? `Stock will finish within ${depletionDays} days.`
                  : 'Stock is currently sufficient.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center bg-bg-card border border-border hover:border-danger hover:text-danger text-text-muted transition-all shrink-0">
            <i className="fas fa-times text-xs" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-1 px-5 pt-3 pb-0 border-b border-border bg-bg-primary">
          <button onClick={() => setActiveTab('history')}
            className={`tab-btn text-xs ${activeTab === 'history' ? 'active' : ''}`}>
            <i className="fas fa-clock-rotate-left mr-1.5" />Past Consumption
          </button>
          <button onClick={() => setActiveTab('forecast')}
            className={`tab-btn text-xs ${activeTab === 'forecast' ? 'active' : ''}`}>
            <i className="fas fa-chart-line mr-1.5" />Future Demand
          </button>
          <button onClick={() => setActiveTab('details')}
            className={`tab-btn text-xs ${activeTab === 'details' ? 'active' : ''}`}>
            <i className="fas fa-list-check mr-1.5" />Current Status &amp; Recommendations
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto bg-bg-deep">
          {isLoading ? <Skeleton /> : (
            <div className="p-6 space-y-5">
              
              {/* ── TAB 1: PAST CONSUMPTION ── */}
              {activeTab === 'history' && (
                <>
                  {/* Consumption in Past Years */}
                  <div className="data-card p-5">
                    <p className="text-[13px] font-bold text-text-primary mb-4">
                      <i className="fas fa-chart-column text-accent mr-2" />Annual Consumption (Past Years)
                    </p>
                    <div className="h-[180px]">
                      <BarChart data={yearlyVals} labels={yearlyLabels} color={chartColors.info} />
                    </div>
                    <div className="flex justify-around mt-4 pt-4 border-t border-border">
                      {yearlyLabels.map((y, idx) => (
                        <div key={y} className="text-center">
                          <p className="text-sm font-bold text-text-primary">{yearlyVals[idx]} units</p>
                          <p className="text-[10px] text-text-muted">{y} Total Use</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Monthly Consumption Trend */}
                  <div className="data-card p-5">
                    <p className="text-[13px] font-bold text-text-primary mb-4">
                      <i className="fas fa-chart-line text-warning mr-2" />Monthly Trend (Past 12 Months)
                    </p>
                    <div className="h-[200px]">
                      <LineChart data={monthlyVals} labels={monthlyLabels} color="#0ea5e9" label="Monthly Consumption" />
                    </div>
                  </div>

                  {/* Daily Consumption (Last 30 Days) */}
                  <div className="data-card p-5">
                    <p className="text-[13px] font-bold text-text-primary mb-4">
                      <i className="fas fa-calendar-days text-accent mr-2" />Daily Use (Last 30 Days)
                    </p>
                    <div className="h-[200px]">
                      <LineChart data={dailyVals} labels={dailyLabels} color="#059669" label="Daily Consumption" />
                    </div>
                  </div>
                </>
              )}

              {/* ── TAB 2: FUTURE FORECAST ── */}
              {activeTab === 'forecast' && (
                <>
                  <div className="data-card p-5">
                    <p className="text-[13px] font-bold text-text-primary mb-4">
                      <i className="fas fa-square-poll-vertical text-info mr-2" />Predicted Consumption Forecast (Next 30 Days)
                    </p>
                    <div className="h-[220px]">
                      {forecastVals.length > 0 ? (
                        <LineChart data={forecastVals} labels={forecastLabels} color="#2563eb" label="Predicted Daily Consumption" />
                      ) : (
                        <div className="text-center py-12 text-text-muted">No future demand predictions available.</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <SummaryBox label="Expected 30-Day Demand" value={Math.round(medForecast?.predicted_consumption_30d ?? 0)} unit="units" color="#2563eb" />
                    <SummaryBox label="Estimated Daily Avg" value={medForecast?.daily_average_consumption ?? '—'} unit="units/day" color="#0ea5e9" />
                    <SummaryBox label="Depletion Timeline" value={depletionDays !== null ? `${depletionDays} Days` : '30+ Days'} color={isCritical ? '#dc2626' : '#059669'} />
                  </div>
                </>
              )}

              {/* ── TAB 3: DETAILS & RECOMMENDATIONS ── */}
              {activeTab === 'details' && (
                <>
                  {/* Current Status grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="data-card p-4 text-center">
                      <p className="text-[11px] text-text-muted uppercase tracking-wide font-semibold mb-1">Current Stock</p>
                      <p className="text-2xl font-bold text-text-primary font-display">{history?.current_stock ?? medForecast?.current_stock ?? '—'}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">units remaining</p>
                    </div>
                    <div className="data-card p-4 text-center">
                      <p className="text-[11px] text-text-muted uppercase tracking-wide font-semibold mb-1">Max Stock Limit</p>
                      <p className="text-2xl font-bold text-text-primary font-display">{history?.max_stock ?? medForecast?.max_stock ?? '—'}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">target level</p>
                    </div>
                    <div className="data-card p-4 text-center">
                      <p className="text-[11px] text-text-muted uppercase tracking-wide font-semibold mb-1">Stock Level</p>
                      <p className={`text-2xl font-bold font-display ${isCritical ? 'text-danger' : 'text-accent'}`}>
                        {history ? `${Math.round((history.current_stock / history.max_stock) * 100)}%` : '—'}
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5">percent capacity</p>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="space-y-3">
                    <p className="text-[13px] font-bold text-text-primary">
                      <i className="fas fa-lightbulb text-accent mr-2" />AI Proactive Recommendations
                    </p>
                    {recs.length === 0 ? (
                      <div className="data-card p-4 flex items-center gap-3">
                        <i className="fas fa-shield-check text-accent text-lg" />
                        <span className="text-xs text-text-secondary">Stock levels are currently healthy. No replenishment needed.</span>
                      </div>
                    ) : (
                      recs.map((r, i) => (
                        <div key={i} className="data-card p-4 flex gap-3.5 items-start"
                          style={{ borderLeft: `3px solid ${r.priority === 'High' ? '#dc2626' : '#0ea5e9'}` }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: r.priority === 'High' ? 'rgba(220,38,38,0.1)' : 'rgba(14,165,233,0.1)' }}>
                            <i className={`fas ${r.type === 'order' ? 'fa-cart-shopping' : 'fa-arrows-left-right'} text-xs`}
                              style={{ color: r.priority === 'High' ? '#dc2626' : '#0ea5e9' }} />
                          </div>
                          <div>
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${r.priority === 'High' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'}`}>
                              {r.priority}
                            </span>
                            <p className="text-[12px] font-bold text-text-primary mt-1">{r.action}</p>
                            <p className="text-[11px] text-text-muted mt-0.5">{r.rationale}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryBox({ label, value, unit, color }) {
  return (
    <div className="data-card p-4 text-center">
      <p className="text-[20px] font-bold font-display text-text-primary" style={{ color }}>{value}</p>
      {unit && <p className="text-[10px] text-text-muted leading-none mt-0.5">{unit}</p>}
      <p className="text-[11px] text-text-secondary mt-1.5">{label}</p>
    </div>
  );
}
