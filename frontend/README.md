# MedTrack frontend

React + Vite + Tailwind CSS rebuild of the MedTrack dashboard, talking to
the FastAPI backend in `../backend`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to :8000
```

Make sure the backend is running first (`uvicorn app.main:app --reload --port 8000`
from `../backend`).

## Structure

- `src/context/AppContext.jsx` — role/session, navigation, toasts, modal, notifications
- `src/api/client.js` — thin fetch wrapper around the backend
- `src/components/` — shell pieces: Login, Sidebar, TopBar, Modal, Toast, NotifPanel
- `src/pages/` — one file per screen, split into Admin/User variants where the
  original single-file app branched on role
- `src/charts/setup.js` — Chart.js registration + shared dark-safe (now light) theme

## Theme

Colors are defined once as semantic Tailwind tokens in `tailwind.config.js`
(`accent` = green, `info` = blue, `danger` = red, plus neutral `bg-*`/`text-*`/`border`
scales for the white/light surfaces). Components reference the semantic names,
not raw hex, so the whole palette can be re-themed by editing one file.
