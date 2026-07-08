# MedTrack

A district health-management dashboard: FastAPI backend + React/Tailwind frontend.
This is a rebuild of an original single-file HTML/vanilla-JS prototype — see
`backend/README.md` and `frontend/README.md` for how to run each half.

Quick start:

```bash
# terminal 1
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# terminal 2
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173.
