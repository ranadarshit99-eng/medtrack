# MedTrack backend

FastAPI reference backend for the MedTrack district health dashboard.
Data is stored in-memory (see `app/data.py`) and reseeds on every restart —
swap `Store` for real repositories backed by Postgres/SQLAlchemy to persist.

## Run

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

## Suggested production schema

```
health_centers(id, name, location, beds_total, beds_occupied, registered, created_at)
medicines(id, health_center_id FK, name, category, stock, max_stock)
tests(id, health_center_id FK, name)
doctors(id, health_center_id FK, name, spec)
schedule_slots(id, doctor_id FK, day, time)
patient_periods(id, health_center_id FK, period_type[monthly|daily|yearly], label, total)
patient_period_diseases(id, patient_period_id FK, disease, count)
notifications(id, type[request|alert], message, from_name, hc_id FK, read, created_at)
```
