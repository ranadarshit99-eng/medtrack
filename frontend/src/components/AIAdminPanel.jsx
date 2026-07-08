import { useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { useApp } from '../context/AppContext';
import AIAlertDetailModal from './AIAlertDetailModal';

const PRIORITY_CONFIG = {
  Critical: { bg: 'rgba(220,38,38,0.08)', border: '#dc2626', dot: 'bg-danger', text: 'text-danger', badge: 'bg-danger/15 text-danger', icon: 'fa-circle-exclamation', emoji: '🔴' },
  Warning:  { bg: 'rgba(14,165,233,0.08)', border: '#0ea5e9', dot: 'bg-warning', text: 'text-warning', badge: 'bg-warning/15 text-warning', icon: 'fa-triangle-exclamation', emoji: '🟠' },
  Normal:   { bg: 'rgba(5,150,105,0.06)', border: '#059669', dot: 'bg-accent', text: 'text-accent', badge: 'bg-accent/15 text-accent', icon: 'fa-circle-info', emoji: '🔵' },
};
const PRIO_ORDER = { Critical: 3, Warning: 2, Normal: 1 };

function AlertRow({ alert, onNavigate }) {
  const cfg = PRIORITY_CONFIG[alert.type] || PRIORITY_CONFIG.Normal;
  const codePrefix = alert.code?.split('_').slice(0, 2).join('_');
  const iconMap = { MED_DEPL: 'fa-pills', BED_OVER: 'fa-bed', PATIENT_: 'fa-users', OUTBREA: 'fa-virus' };
  const icon = Object.entries(iconMap).find(([k]) => codePrefix?.startsWith(k))?.[1] || 'fa-brain';

  return (
    <div
      onClick={() => onNavigate(alert.hc_id)}
      title="Click to view Health Center details"
      className="flex items-start gap-3 px-5 py-3.5 border-b border-border last:border-b-0 cursor-pointer transition-all hover:bg-bg-deep group"
      style={{ borderLeft: `3px solid ${cfg.border}` }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: cfg.bg, border: `1px solid ${cfg.border}30` }}>
        <i className={`fas ${icon} text-[11px] ${cfg.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${cfg.badge}`}>{alert.type}</span>
          <span className="text-[12px] font-semibold text-text-primary truncate">{alert.hc_name}</span>
        </div>
        <p className="text-[12px] text-text-secondary leading-snug truncate">{alert.message}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0 text-text-muted group-hover:text-accent transition-colors">
        <span className="text-[10px]">View HC</span>
        <i className="fas fa-arrow-right text-[9px]" />
      </div>
    </div>
  );
}

function RecRow({ rec }) {
  const cfg = {
    High:   { border: '#dc2626', badge: 'bg-danger/15 text-danger'  },
    Medium: { border: '#0ea5e9', badge: 'bg-warning/15 text-warning' },
    Low:    { border: '#059669', badge: 'bg-accent/15 text-accent'   },
  }[rec.priority] || { border: '#059669', badge: 'bg-accent/15 text-accent' };

  const typeIcon = { order: 'fa-cart-shopping', transfer: 'fa-arrows-left-right', infrastructure: 'fa-building', staffing: 'fa-user-doctor', supplies: 'fa-box' }[rec.type] || 'fa-lightbulb';

  return (
    <div className="flex items-start gap-3 px-5 py-3 border-b border-border last:border-b-0" style={{ borderLeft: `3px solid ${cfg.border}` }}>
      <i className={`fas ${typeIcon} text-[11px] mt-1`} style={{ color: cfg.border }} />
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.badge}`}>{rec.priority}</span>
          <span className="text-[11px] text-text-muted font-medium">{rec.hc_name}</span>
        </div>
        <p className="text-[12px] text-text-primary font-medium leading-snug">{rec.action}</p>
        <p className="text-[11px] text-text-muted">{rec.rationale}</p>
      </div>
    </div>
  );
}

export default function AIAdminPanel() {
  const { navigateTo, setSelectedHCId } = useApp();
  const [expanded, setExpanded] = useState(true);
  const [showAllRecs, setShowAllRecs] = useState(false);
  const [activeTab, setActiveTab] = useState('alerts');
  const [activeAlert, setActiveAlert] = useState(null);

  const { data: alerts, loading: alertsLoading } = useFetch(() => api.adminAlerts(), []);
  const { data: recs,   loading: recsLoading }   = useFetch(() => api.adminRecommendations(), []);
  const { data: patFc }                           = useFetch(() => api.adminPatientForecast(), []);
  const { data: bedFc }                           = useFetch(() => api.adminBedForecast(), []);

  const sortedAlerts = (alerts || []).sort((a, b) => (PRIO_ORDER[b.type] || 0) - (PRIO_ORDER[a.type] || 0));
  const sortedRecs   = (recs   || []).sort((a, b) => (PRIO_ORDER[b.priority] || 0) - (PRIO_ORDER[a.priority] || 0));
  const visibleRecs  = showAllRecs ? sortedRecs : sortedRecs.slice(0, 5);

  const critCount = sortedAlerts.filter(a => a.type === 'Critical').length;
  const warnCount = sortedAlerts.filter(a => a.type === 'Warning').length;

  const isLoading = alertsLoading || recsLoading;

  return (
    <>
      {activeAlert && (
        <AIAlertDetailModal
          alert={activeAlert}
          hcId={activeAlert.hc_id}
          onClose={() => setActiveAlert(null)}
        />
      )}
      <div className="data-card mb-6 overflow-hidden" style={{ border: critCount > 0 ? '1px solid rgba(220,38,38,0.25)' : undefined }}>
        {/* Header */}
        <div
          className="px-5 py-4 border-b border-border flex items-center justify-between cursor-pointer"
          style={{ background: critCount > 0 ? 'rgba(220,38,38,0.04)' : 'linear-gradient(135deg, rgba(5,150,105,0.05) 0%, rgba(37,99,235,0.03) 100%)' }}
          onClick={() => setExpanded(v => !v)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-accent/20 to-info/20 relative">
              <i className="fas fa-brain text-accent text-sm" />
              {critCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-danger rounded-full border border-bg-primary animate-ping" />}
            </div>
            <div>
              <span className="font-bold text-[15px] font-display text-text-primary">AI Prediction &amp; Alerts</span>
              <p className="text-[11px] text-text-muted">Healthcare Intelligence Engine — All Centers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {critCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-danger/12 text-danger text-[11px] font-bold border border-danger/20">
                <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                {critCount} Critical
              </span>
            )}
            {warnCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-warning/12 text-warning text-[11px] font-bold border border-warning/20">
                {warnCount} Warning
              </span>
            )}
            <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-text-muted text-xs ml-1`} />
          </div>
        </div>

        {expanded && (
          <>
            {/* Quick System Stats */}
            {(patFc || bedFc) && (
              <div className="grid border-b border-border" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                {patFc && (
                  <>
                    <SysStat icon="fa-calendar-day" color="text-info" label="System Patients Tomorrow" value={patFc.system_wide?.tomorrow ?? '—'} />
                    <SysStat icon="fa-calendar-week" color="text-warning" label="System Patients Next Week" value={patFc.system_wide?.next_week ?? '—'} />
                  </>
                )}
                {bedFc && (
                  <>
                    <SysStat icon="fa-bed" color={bedFc.predicted_occupancy_percentage_next_week > 90 ? 'text-danger' : 'text-accent'} label="Predicted Bed Occ. (Avg)" value={`${bedFc.predicted_occupancy_percentage_next_week}%`} />
                    {bedFc.high_occupancy_centers?.length > 0 && (
                      <SysStat icon="fa-hospital" color="text-danger" label="High Occupancy Centers" value={bedFc.high_occupancy_centers.length} sub="above 80%" />
                    )}
                  </>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 px-5 pt-3 pb-0 border-b border-border">
              {[
                { key: 'alerts', label: `Alerts (${sortedAlerts.length})`, icon: 'fa-bell' },
                { key: 'recs',   label: `Recommendations (${sortedRecs.length})`, icon: 'fa-lightbulb' },
              ].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`tab-btn text-xs ${activeTab === t.key ? 'active' : ''}`}>
                  <i className={`fas ${t.icon} mr-1.5`} />{t.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="p-5 space-y-2 animate-pulse">
                {[1,2,3,4].map(i => <div key={i} className="h-12 rounded-lg bg-bg-secondary" />)}
              </div>
            ) : (
              <>
                {/* ── ALERTS TAB ── */}
                {activeTab === 'alerts' && (
                  sortedAlerts.length === 0
                    ? <div className="flex items-center gap-3 px-5 py-5 text-text-muted"><i className="fas fa-shield-check text-accent text-xl" /><span className="text-[13px]">No active AI alerts across all health centers.</span></div>
                    : <div className="max-h-[380px] overflow-y-auto">
                        {sortedAlerts.map((a, i) => (
                          <AlertRow
                            key={i}
                            alert={a}
                            onNavigate={(hcId) => {
                              setSelectedHCId(hcId);
                              navigateTo('health-centers');
                            }}
                          />
                        ))}
                      </div>
                )}

              {/* ── RECOMMENDATIONS TAB ── */}
              {activeTab === 'recs' && (
                sortedRecs.length === 0
                  ? <div className="flex items-center gap-3 px-5 py-5 text-text-muted"><i className="fas fa-check-circle text-accent text-xl" /><span className="text-[13px]">No active recommendations.</span></div>
                  : <>
                      <div className="max-h-[380px] overflow-y-auto">
                        {visibleRecs.map((r, i) => <RecRow key={i} rec={r} />)}
                      </div>
                      {sortedRecs.length > 5 && (
                        <div className="px-5 py-2.5 border-t border-border">
                          <button onClick={() => setShowAllRecs(v => !v)} className="btn btn-sm btn-secondary text-xs w-full">
                            {showAllRecs ? 'Show less' : `Show ${sortedRecs.length - 5} more recommendations`}
                          </button>
                        </div>
                      )}
                    </>
              )}
            </>
          )}
        </>
      )}
    </div>
    </>
  );
}

function SysStat({ icon, color, label, value, sub }) {
  return (
    <div className="px-4 py-3 border-r border-border last:border-r-0">
      <i className={`fas ${icon} ${color} text-xs mb-1 block`} />
      <p className={`text-[17px] font-bold font-display ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-text-muted">{sub}</p>}
      <p className="text-[10px] text-text-muted mt-0.5">{label}</p>
    </div>
  );
}
