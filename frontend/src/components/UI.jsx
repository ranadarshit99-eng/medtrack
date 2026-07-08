export function StatCard({ label, value, sub, subClass = 'text-text-secondary', icon, iconBg, iconColor, glowColor, pulse }) {
  return (
    <div className="stat-card">
      <div className="stat-glow" style={{ background: glowColor }} />
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs text-text-muted mb-1.5 font-semibold uppercase tracking-wide">{label}</p>
          <p className={`text-[28px] font-bold font-display ${pulse ? 'animate-pulseDanger' : ''}`}>{value}</p>
          {sub && <p className={`text-xs mt-0.5 ${subClass}`}>{sub}</p>}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: iconBg, color: iconColor }}
        >
          <i className={`fas ${icon}`} />
        </div>
      </div>
    </div>
  );
}

export function StockBadge({ status }) {
  const cls = { low: 'badge-low', mid: 'badge-mid', high: 'badge-high' }[status];
  const label = { low: 'Low', mid: 'Medium', high: 'Good' }[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function EmptyState({ icon = 'fa-check-circle', text, color = 'text-accent' }) {
  return (
    <div className="text-center py-16 text-text-muted">
      <i className={`fas ${icon} text-3xl mb-3 block ${color}`} />
      {text}
    </div>
  );
}

export function IconButton({ icon, onClick, title, danger, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`bed-ctrl ${danger ? 'text-danger' : ''} ${className}`}
    >
      <i className={`fas ${icon} text-[10px]`} />
    </button>
  );
}
