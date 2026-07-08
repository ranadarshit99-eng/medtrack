import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

// Palette: green (accent) + blue (info/warning) for normal data, red (danger)
// reserved strictly for alerts/critical values -- matches the app's light
// green/blue/white theme.
export const chartColors = {
  accent: '#059669', accentLight: 'rgba(5,150,105,0.15)',
  warning: '#0ea5e9', warningLight: 'rgba(14,165,233,0.15)',
  danger: '#dc2626', dangerLight: 'rgba(220,38,38,0.15)',
  info: '#2563eb', infoLight: 'rgba(37,99,235,0.15)',
  grid: 'rgba(226,232,240,0.8)', text: '#475569',
  diseasePalette: ['#059669', '#2563eb', '#0ea5e9', '#dc2626', '#0d9488', '#64748b'],
};

export const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: chartColors.text, font: { family: 'DM Sans', size: 12 }, padding: 16 } } },
  scales: {
    x: { grid: { color: chartColors.grid }, ticks: { color: chartColors.text, font: { family: 'DM Sans', size: 11 } } },
    y: { grid: { color: chartColors.grid }, ticks: { color: chartColors.text, font: { family: 'DM Sans', size: 11 } } },
  },
};

export const donutOptions = (cutout = '70%') => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout,
  plugins: { legend: { position: 'bottom', labels: { color: chartColors.text, font: { family: 'DM Sans', size: 12 }, padding: 12 } } },
});
