export function stockStatus(stock, max) {
  const pct = max ? stock / max : 0;
  if (pct < 0.15) return 'low';
  if (pct < 0.4) return 'mid';
  return 'high';
}

// low = red (alert), mid = blue, high = green -- keeps the palette to
// green/blue/white with red reserved strictly for things needing attention.
export const STOCK_HEX = { low: '#dc2626', mid: '#0ea5e9', high: '#059669' };
export const STOCK_TW = { low: 'text-danger', mid: 'text-warning', high: 'text-accent' };
export const STOCK_BADGE_CLASS = { low: 'badge-low', mid: 'badge-mid', high: 'badge-high' };
export const STOCK_LABEL = { low: 'Low', mid: 'Medium', high: 'Good' };

export function occupancyColorHex(pct) {
  if (pct > 80) return '#dc2626';
  if (pct > 50) return '#0ea5e9';
  return '#059669';
}
