/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-deep': '#f8fafc',
        'bg-primary': '#ffffff',
        'bg-secondary': '#f1f5f9',
        'bg-card': '#ffffff',
        'bg-card-hover': '#f8fafc',
        border: {
          DEFAULT: '#e2e8f0',
          light: '#cbd5e1',
        },
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          muted: '#94a3b8',
        },
        accent: {
          DEFAULT: '#059669',
          hover: '#10b981',
        },
        warning: '#0ea5e9',
        danger: '#dc2626',
        info: '#2563eb',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      keyframes: {
        orbFloat: {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(30px,-20px) scale(1.1)' },
          '100%': { transform: 'translate(-20px,30px) scale(0.95)' },
        },
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        pulseDanger: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        modalIn: {
          from: { opacity: 0, transform: 'scale(0.95) translateY(10px)' },
          to: { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        orbFloat: 'orbFloat 12s ease-in-out infinite alternate',
        fadeUp: 'fadeUp 0.4s ease forwards',
        pulseDanger: 'pulseDanger 2s ease-in-out infinite',
        modalIn: 'modalIn 0.25s cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [],
}
