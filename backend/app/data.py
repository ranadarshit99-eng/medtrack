"""
In-memory data store for MedTrack.

A real deployment would back this with Postgres (see README for the schema
sketch), but an in-memory store keeps this reference implementation runnable
with zero setup while preserving the exact same API contract a DB-backed
version would expose.

Bug fixed vs. the original prototype: the old `genPatientData`/`genDailyData`
picked each disease's count independently at random, so the per-disease
numbers routinely summed to well over (or under) the stated `total`, and the
disease pie chart never reconciled with the headline number. Here we pick the
total first, then distribute it across diseases with random weights so the
parts always sum to the whole.
"""
from __future__ import annotations
import random
from datetime import date, timedelta
from itertools import count

random.seed(42)  # deterministic demo data across restarts

DISEASES = [
    "Fever", "Cold/Cough", "Diabetes", "Hypertension", "Stomach Issues",
    "Skin Problems", "Respiratory Issues", "Joint Pain", "Eye Problems", "Other",
]

MEDICINES_CATALOG = [
    ("Paracetamol 500mg", "Analgesic"),
    ("Amoxicillin 250mg", "Antibiotic"),
    ("Metformin 500mg", "Antidiabetic"),
    ("Omeprazole 20mg", "Antacid"),
    ("Cetirizine 10mg", "Antihistamine"),
    ("Ibuprofen 400mg", "Analgesic"),
    ("Azithromycin 500mg", "Antibiotic"),
    ("ORS Sachets", "Rehydration"),
    ("Vitamin D3 Supplements", "Supplement"),
    ("Cough Syrup", "Expectorant"),
    ("Amlodipine 5mg", "Antihypertensive"),
    ("Antacid Tablets", "Antacid"),
]

TESTS_CATALOG = [
    "Blood Test (CBC)", "Blood Sugar Test", "Urine Test", "X-Ray", "ECG",
    "Blood Pressure Check", "Thyroid Test (TSH)", "Liver Function Test",
    "Kidney Function Test", "Dengue NS1", "Malaria Antigen", "HbA1c Test",
]

DOCTORS_CATALOG = [
    ("Dr. Priya Sharma", "General Medicine"),
    ("Dr. Rahul Verma", "Pediatrics"),
    ("Dr. Anita Desai", "Gynecology"),
    ("Dr. Suresh Kumar", "Orthopedics"),
    ("Dr. Meera Patel", "Dermatology"),
    ("Dr. Vikram Singh", "General Medicine"),
]

_id_counter = count(1)


def _next_id() -> int:
    return next(_id_counter)


def _distribute(total: int, weight_diseases: dict[str, float] | None = None) -> dict[str, int]:
    """Split `total` across DISEASES so the parts always sum to `total`."""
    weights = {d: (weight_diseases or {}).get(d, random.random() + 0.1) for d in DISEASES}
    wsum = sum(weights.values())
    raw = {d: total * w / wsum for d, w in weights.items()}
    floored = {d: int(v) for d, v in raw.items()}
    remainder = total - sum(floored.values())
    # hand out leftover units to the diseases with the largest fractional part
    order = sorted(raw, key=lambda d: raw[d] - floored[d], reverse=True)
    for d in order[:remainder]:
        floored[d] += 1
    return floored


def gen_monthly(months: int) -> list[dict]:
    out = []
    today = date.today().replace(day=1)
    for i in range(months - 1, -1, -1):
        y, m = today.year, today.month - i
        while m <= 0:
            m += 12
            y -= 1
        base = 40 + 15 * random.random() + (months - i) * 1.5
        total = round(base + random.random() * 30)
        diseases = _distribute(total, {"Fever": 4, "Cold/Cough": 3})
        out.append({
            "label": date(y, m, 1).strftime("%b %Y"),
            "total": total,
            "diseases": diseases,
        })
    return out


def gen_daily(days: int) -> list[dict]:
    out = []
    today = date.today()
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        total = round(3 + random.random() * 12)
        diseases = _distribute(total, {"Fever": 3})
        out.append({"label": d.strftime("%d/%m/%Y"), "total": total, "diseases": diseases})
    return out


def gen_yearly(years: int) -> list[dict]:
    out = []
    this_year = date.today().year
    for i in range(years - 1, -1, -1):
        total = round(400 + i * 80 + random.random() * 100)
        diseases = _distribute(total)
        out.append({"label": str(this_year - i), "total": total, "diseases": diseases})
    return out


def make_medicines() -> list[dict]:
    meds = []
    for idx, (name, cat) in enumerate(MEDICINES_CATALOG):
        stock = round(random.random() * 180 + 5)
        if idx == 0:
            stock = round(random.random() * 15 + 2)   # force a low-stock example
        elif idx == 2:
            stock = round(random.random() * 30 + 5)   # force a mid-stock example
        meds.append({"id": _next_id(), "name": name, "category": cat, "stock": stock, "max_stock": 200})
    return meds


def make_doctors() -> list[dict]:
    n = 3 + round(random.random() * 3)
    docs = []
    for name, spec in DOCTORS_CATALOG[:n]:
        docs.append({
            "id": _next_id(),
            "name": name,
            "spec": spec,
            "schedule": [
                {"day": "Monday", "time": "09:00 - 13:00"},
                {"day": "Wednesday", "time": "09:00 - 13:00"},
                {"day": "Friday", "time": "14:00 - 17:00"},
            ],
        })
    return docs


def make_health_center(id_: int, name: str, location: str, beds_total: int, registered: bool) -> dict:
    occupied = round(beds_total * (0.5 + random.random() * 0.4))
    tests = [t for t in TESTS_CATALOG if random.random() > 0.4]
    
    beds_list = []
    icu_cnt = max(1, int(beds_total * 0.2))
    op_cnt = max(1, int(beds_total * 0.2))
    gen_cnt = beds_total - icu_cnt - op_cnt
    
    genders = ["Male", "Female", "Other"]
    male_names = ["Arjun", "Rohan", "Sanjay", "Vikram", "Kabir", "Amit", "Rahul"]
    female_names = ["Ananya", "Pooja", "Priya", "Sneha", "Aditi", "Meera", "Neha"]
    other_names = ["Alex", "Sam", "Taylor", "Jordan", "Morgan"]
    
    occupied_count = 0
    sectors = [("ICU", icu_cnt), ("General", gen_cnt), ("Operation", op_cnt)]
    for sector, count in sectors:
        for idx in range(count):
            bed_id = f"{id_}_{sector}_{idx + 1}"
            bed_num = f"{sector[0]}{idx + 1}"
            is_occupied = False
            patient = {}
            if occupied_count < occupied:
                is_occupied = True
                occupied_count += 1
                gender = random.choices(genders, weights=[0.48, 0.48, 0.04])[0]
                if gender == "Male":
                    name = random.choice(male_names)
                elif gender == "Female":
                    name = random.choice(female_names)
                else:
                    name = random.choice(other_names)
                age = random.randint(18, 85)
                disease = random.choice(DISEASES)
                patient = {
                    "patient_name": name,
                    "patient_age": age,
                    "patient_gender": gender,
                    "patient_disease": disease,
                    "allocated_at": (date.today() - timedelta(days=random.randint(1, 10))).strftime("%Y-%m-%d %H:%M")
                }
            beds_list.append({
                "id": bed_id,
                "number": bed_num,
                "sector": sector,
                "status": "occupied" if is_occupied else "available",
                **patient
            })

    return {
        "id": id_,
        "name": name,
        "location": location,
        "beds": {"total": beds_total, "occupied": occupied},
        "beds_list": beds_list,
        "medicines": make_medicines(),
        "tests": tests,
        "doctors": make_doctors(),
        "registered": registered,
        "patient_monthly": gen_monthly(12),
        "patient_daily": gen_daily(30),
        "patient_yearly": gen_yearly(5),
    }


class Store:
    """Tiny in-memory 'database'. Not thread-safe by design — swap for a real
    DB session per request if you deploy this for real."""

    def __init__(self):
        self.health_centers: dict[int, dict] = {}
        self.notifications: list[dict] = []
        self._notif_id = count(1)
        self._seed()

    def _seed(self):
        seed_hcs = [
            (1, "Rajendra Nagar PHC", "Rajendra Nagar, Downtown", 50, True),
            (2, "Saraswati Nagar CHC", "Saraswati Nagar, East Zone", 80, True),
            (3, "Gandhi Marg PHC", "Gandhi Marg, West Zone", 35, True),
            (4, "Lakshmi Purva CHC", "Lakshmi Purva, North Zone", 100, True),
            (5, "New Colony PHC", "New Colony, South Zone", 40, True),
            (6, "Shanti Nagar CHC", "Shanti Nagar, Central", 60, False),
            (7, "Vikas Nagar PHC", "Vikas Nagar, Suburb Area", 30, False),
        ]
        for hc_id, name, loc, beds, reg in seed_hcs:
            self.health_centers[hc_id] = make_health_center(hc_id, name, loc, beds, reg)

        self.notifications = [
            {"id": next(self._notif_id), "type": "request", "message": "Shanti Nagar CHC requested to be listed",
             "from": "Shanti Nagar CHC", "date": "2 hours ago", "read": False, "hc_id": 6},
            {"id": next(self._notif_id), "type": "request", "message": "Vikas Nagar PHC requested to be listed",
             "from": "Vikas Nagar PHC", "date": "5 hours ago", "read": False, "hc_id": 7},
            {"id": next(self._notif_id), "type": "alert", "message": "Paracetamol 500mg stock critically low (8 units)",
             "from": "Rajendra Nagar PHC", "date": "1 day ago", "read": True, "hc_id": 1},
            {"id": next(self._notif_id), "type": "alert", "message": "Metformin 500mg stock running low (12 units)",
             "from": "Saraswati Nagar CHC", "date": "1 day ago", "read": True, "hc_id": 2},
        ]

    def next_notif_id(self) -> int:
        return next(self._notif_id)


store = Store()
