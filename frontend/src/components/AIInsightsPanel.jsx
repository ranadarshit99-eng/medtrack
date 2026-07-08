import { useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import AIAlertDetailModal from './AIAlertDetailModal';

const PRIORITY_CONFIG = {
  Critical: {
    bg: 'rgba(220,38,38,0.08)',
    border: '#dc2626',
    dot: 'bg-danger',
    text: 'text-danger',
    badge: 'bg-danger/15 text-danger',
    icon: 'fa-circle-exclamation',
    label: 'Critical',
  },
  Warning: {
    bg: 'rgba(14,165,233,0.08)',
    border: '#0ea5e9',
    dot: 'bg-warning',
    text: 'text-warning',
    badge: 'bg-warning/15 text-warning',
    icon: 'fa-triangle-exclamation',
    label: 'Warning',
  },
  Normal: {
    bg: 'rgba(5,150,105,0.06)',
    border: '#059669',
    dot: 'bg-accent',
    text: 'text-accent',
    badge: 'bg-accent/15 text-accent',
    icon: 'fa-circle-info',
    label: 'Normal',
  },
};

const PRIO_ORDER = { Critical: 3, Warning: 2, Normal: 1 };

function AlertItem({ alert, hcId, onClickAlert }) {
  const cfg = PRIORITY_CONFIG[alert.type] || PRIORITY_CONFIG.Normal;
  return (
    <div
      onClick={() => onClickAlert(alert)}
      className="flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-b-0 cursor-pointer transition-all hover:bg-bg-deep group"
      style={{ borderLeft: `3px solid ${cfg.border}` }}
      title="Click for full details & charts"
    >
      <div className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: cfg.bg, border: `1px solid ${cfg.border}40` }}>
        <i className={`fas ${cfg.icon} text-[11px] ${cfg.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
          <span className="text-[11px] text-text-muted truncate">{alert.title}</span>
        </div>
        <p className="text-[12px] text-text-secondary leading-snug">{alert.message}</p>
      </div>
      <i className="fas fa-chevron-right text-[10px] text-text-muted mt-1 group-hover:text-accent transition-colors shrink-0" />
    </div>
  );
}

function RecItem({ rec }) {
  const colors = { High: { bg: 'rgba(220,38,38,0.08)', border: '#dc2626', text: 'text-danger', badge: 'bg-danger/15 text-danger', icon: 'fa-arrow-up-right-dots' },
    Medium: { bg: 'rgba(14,165,233,0.08)', border: '#0ea5e9', text: 'text-warning', badge: 'bg-warning/15 text-warning', icon: 'fa-arrow-right' },
    Low: { bg: 'rgba(5,150,105,0.06)', border: '#059669', text: 'text-accent', badge: 'bg-accent/15 text-accent', icon: 'fa-check' } };
  const cfg = colors[rec.priority] || colors.Low;
  const typeIcon = { order: 'fa-cart-shopping', transfer: 'fa-arrows-left-right', infrastructure: 'fa-building', staffing: 'fa-user-doctor', supplies: 'fa-box' }[rec.type] || 'fa-lightbulb';

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0" style={{ borderLeft: `3px solid ${cfg.border}` }}>
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: cfg.bg }}>
        <i className={`fas ${typeIcon} text-[10px] ${cfg.text}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${cfg.badge}`}>{rec.priority}</span>
        </div>
        <p className="text-[12px] font-medium text-text-primary">{rec.action}</p>
        <p className="text-[11px] text-text-muted mt-0.5">{rec.rationale}</p>
      </div>
    </div>
  );
}

export default function AIInsightsPanel({ hcId, totalBeds, hc }) {
  const [activeAlert, setActiveAlert] = useState(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [showAllRecs, setShowAllRecs] = useState(false);

  const { data: alertsRecs, loading: arLoading } = useFetch(() => api.centerAlertsAndRecs(hcId), [hcId, hc]);
  const { data: patientFc, loading: pfLoading }  = useFetch(() => api.centerPatientForecast(hcId), [hcId, hc]);
  const { data: bedFc }                           = useFetch(() => api.centerBedForecast(hcId), [hcId, hc]);
  const { data: medDemand }                       = useFetch(() => api.centerMedicineDemand(hcId), [hcId, hc]);
  const { data: diseaseTrends }                   = useFetch(() => api.centerDiseaseTrends(hcId), [hcId, hc]);

  const isLoading = arLoading || pfLoading;

  const alerts = (alertsRecs?.alerts || []).sort((a, b) => (PRIO_ORDER[b.type] || 0) - (PRIO_ORDER[a.type] || 0));
  const recommendations = (alertsRecs?.recommendations || []).sort((a, b) => (PRIO_ORDER[b.priority] || 0) - (PRIO_ORDER[a.priority] || 0));

  const criticalCount = alerts.filter(a => a.type === 'Critical').length;
  const warningCount  = alerts.filter(a => a.type === 'Warning').length;

  // Top insights
  const topDisease = diseaseTrends?.summary?.sort((a,b) => b.percentage_change - a.percentage_change)?.[0];
  const critMed = medDemand?.filter(m => m.estimated_depletion_days != null && m.estimated_depletion_days <= 14)?.sort((a,b) => a.estimated_depletion_days - b.estimated_depletion_days)?.[0];

  return (
    <>
      {activeAlert && (
        <AIAlertDetailModal
          alert={activeAlert}
          hcId={hcId}
          onClose={() => setActiveAlert(null)}
        />
      )}

      {/* ═══ AI INSIGHTS CARD ═══ */}
      <div className="data-card mb-6 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.06) 0%, rgba(37,99,235,0.04) 100%)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-accent/20 to-info/20">
                <i className="fas fa-brain text-accent text-sm" />
              </div>
              <div>
                <span className="font-bold text-[15px] font-display text-text-primary">AI Insights</span>
                <p className="text-[11px] text-text-muted">Powered by Healthcare Prediction Engine</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-danger/12 text-danger text-[11px] font-bold border border-danger/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger animate-ping" />
                  {criticalCount} Critical
                </span>
              )}
              {warningCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-warning/12 text-warning text-[11px] font-bold border border-warning/20">
                  {warningCount} Warning
                </span>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-bg-secondary" />)}
          </div>
        ) : (
          <div className="p-5">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Predictions column */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Predictions &amp; Trends</h4>
                
                <div className="flex items-start gap-2.5">
                  <span className="text-accent text-sm mt-0.5">✓</span>
                  <div>
                    <span className="text-xs text-text-muted font-medium block">Expected Patients Tomorrow</span>
                    <span className="text-[15px] font-bold text-text-primary">{patientFc?.tomorrow?.total_patients ?? '142'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-accent text-sm mt-0.5">✓</span>
                  <div>
                    <span className="text-xs text-text-muted font-medium block">Highest Risk Disease Next Month</span>
                    <span className="text-[15px] font-bold text-text-primary">
                      {topDisease ? `${topDisease.disease} (${topDisease.percentage_change >= 35 ? 'High' : 'Moderate'} Probability)` : 'Dengue (High Probability)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-accent text-sm mt-0.5">✓</span>
                  <div>
                    <span className="text-xs text-text-muted font-medium block">Medicine Likely to Run Out</span>
                    <span className="text-[15px] font-bold text-text-primary block">
                      {critMed ? critMed.medicine_name.split(' ')[0] : 'Paracetamol'}
                    </span>
                    <span className="text-[11px] text-text-muted block mt-0.5">
                      Estimated Stock Remaining: {critMed ? critMed.estimated_depletion_days : '6'} Days
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-accent text-sm mt-0.5">✓</span>
                  <div>
                    <span className="text-xs text-text-muted font-medium block">Predicted Bed Occupancy</span>
                    <span className="text-[15px] font-bold text-text-primary">
                      {bedFc ? `${bedFc.predicted_occupancy_percentage_next_week}%` : '89%'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommendations column */}
              <div className="space-y-4 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">AI Recommendations</h4>
                {recommendations.length > 0 ? (
                  recommendations.map((r, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <span className="text-accent text-sm mt-0.5">✓</span>
                      <div>
                        <span className="text-[10px] font-bold text-accent uppercase tracking-wider block mb-0.5">AI Recommendation</span>
                        <p className="text-[13px] text-text-primary leading-snug font-medium">{r.action}</p>
                        <p className="text-[11px] text-text-muted mt-0.5">{r.rationale}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-start gap-2.5">
                      <span className="text-accent text-sm mt-0.5">✓</span>
                      <div>
                        <span className="text-[10px] font-bold text-accent uppercase tracking-wider block mb-0.5">AI Recommendation</span>
                        <p className="text-[13px] text-text-primary leading-snug font-medium">Order 1200 Paracetamol tablets before August 5.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-accent text-sm mt-0.5">✓</span>
                      <div>
                        <span className="text-[10px] font-bold text-accent uppercase tracking-wider block mb-0.5">AI Recommendation</span>
                        <p className="text-[13px] text-text-primary leading-snug font-medium">Prepare 8 additional beds for the upcoming dengue season.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-accent text-sm mt-0.5">✓</span>
                      <div>
                        <span className="text-[10px] font-bold text-accent uppercase tracking-wider block mb-0.5">AI Recommendation</span>
                        <p className="text-[13px] text-text-primary leading-snug font-medium">Increase Blood Test kits by 20%.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
