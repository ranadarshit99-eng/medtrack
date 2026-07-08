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
        # Expiring details relative to July 2026
        if idx == 1:
            expiry = "2026-08-10" # Expiring soon
        elif idx == 3:
            expiry = "2026-06-15" # Already expired
        elif idx == 5:
            expiry = "2026-09-20" # Expiring soon
        else:
            expiry = f"2027-{random.randint(1,12):02d}-{random.randint(1,28):02d}"
            
        mfg_year = 2024 if idx % 2 == 0 else 2025
        mfg = f"{mfg_year}-{random.randint(1,12):02d}-{random.randint(1,28):02d}"
        
        last_arrived = round(random.random() * 80 + 20)
        arrival = f"2026-{random.randint(4,6):02d}-{random.randint(1,28):02d}"
        
        stock = round(random.random() * 180 + 5)
        if idx == 0:
            stock = round(random.random() * 15 + 2)   # force a low-stock example
        elif idx == 2:
            stock = round(random.random() * 30 + 5)   # force a mid-stock example
            
        batches = []
        batches.append({
            "id": f"b_{idx}_1",
            "mfg_date": mfg,
            "expiry_date": expiry,
            "arrival_date": arrival,
            "initial_quantity": last_arrived,
            "current_quantity": min(stock, last_arrived)
        })
        
        remaining = stock - min(stock, last_arrived)
        if remaining > 0 or idx % 3 == 0:
            qty2 = remaining if remaining > 0 else 40
            batches.append({
                "id": f"b_{idx}_2",
                "mfg_date": "2025-01-10",
                "expiry_date": "2026-08-10" if idx == 0 else "2027-01-10",
                "arrival_date": "2025-02-15",
                "initial_quantity": qty2 + 20,
                "current_quantity": qty2
            })
            
        total_stock = sum(b["current_quantity"] for b in batches)
        
        meds.append({
            "id": _next_id(),
            "name": name,
            "category": cat,
            "stock": total_stock,
            "max_stock": 200,
            "expiry_date": expiry,
            "mfg_date": mfg,
            "last_stock_arrived": last_arrived,
            "last_arrival_date": arrival,
            "batches": batches
        })
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
        self.read_notif_ids: set[int] = set()
        self._notif_id = count(1)
        self._patient_rec_id = count(1021)
        self.patient_history: list[dict] = []
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

        # Populate read_notif_ids
        for n in self.notifications:
            if n.get("read", False):
                self.read_notif_ids.add(n["id"])

        self.patient_history = [
            {
                "id": "REC-1001",
                "patient_name": "Aarav Mehta",
                "patient_age": 45,
                "patient_gender": "Male",
                "disease": "Hypertension",
                "health_center_id": 1,
                "health_center_name": "Rajendra Nagar PHC",
                "admitted": True,
                "admission_details": {
                    "sector": "General",
                    "bed_number": "G3",
                    "admission_date": "2026-04-10",
                    "discharge_date": "2026-04-15",
                    "stay_days": 5
                },
                "medicines": [
                    {"name": "Amlodipine 5mg", "quantity": "30 tablets"},
                    {"name": "ORS Sachets", "quantity": "5 packets"}
                ],
                "doctor_name": "Dr. Priya Sharma",
                "visit_date": "2026-04-10"
            },
            {
                "id": "REC-1002",
                "patient_name": "Sneha Patel",
                "patient_age": 29,
                "patient_gender": "Female",
                "disease": "Stomach Issues",
                "health_center_id": 1,
                "health_center_name": "Rajendra Nagar PHC",
                "admitted": False,
                "admission_details": None,
                "medicines": [
                    {"name": "Omeprazole 20mg", "quantity": "14 tablets"},
                    {"name": "Antacid Tablets", "quantity": "20 tablets"}
                ],
                "doctor_name": "Dr. Vikram Singh",
                "visit_date": "2026-04-12"
            },
            {
                "id": "REC-1003",
                "patient_name": "Ishaan Sharma",
                "patient_age": 8,
                "patient_gender": "Male",
                "disease": "Fever",
                "health_center_id": 2,
                "health_center_name": "Saraswati Nagar CHC",
                "admitted": True,
                "admission_details": {
                    "sector": "General",
                    "bed_number": "G1",
                    "admission_date": "2026-05-02",
                    "discharge_date": "2026-05-05",
                    "stay_days": 3
                },
                "medicines": [
                    {"name": "Paracetamol 500mg", "quantity": "10 tablets"},
                    {"name": "Cough Syrup", "quantity": "1 bottle"}
                ],
                "doctor_name": "Dr. Rahul Verma",
                "visit_date": "2026-05-02"
            },
            {
                "id": "REC-1004",
                "patient_name": "Priya Rao",
                "patient_age": 34,
                "patient_gender": "Female",
                "disease": "Cold/Cough",
                "health_center_id": 2,
                "health_center_name": "Saraswati Nagar CHC",
                "admitted": False,
                "admission_details": None,
                "medicines": [
                    {"name": "Cetirizine 10mg", "quantity": "10 tablets"},
                    {"name": "Cough Syrup", "quantity": "1 bottle"}
                ],
                "doctor_name": "Dr. Rahul Verma",
                "visit_date": "2026-05-04"
            },
            {
                "id": "REC-1005",
                "patient_name": "Rajesh Kumar",
                "patient_age": 62,
                "patient_gender": "Male",
                "disease": "Joint Pain",
                "health_center_id": 3,
                "health_center_name": "Gandhi Marg PHC",
                "admitted": False,
                "admission_details": None,
                "medicines": [
                    {"name": "Ibuprofen 400mg", "quantity": "20 tablets"}
                ],
                "doctor_name": "Dr. Suresh Kumar",
                "visit_date": "2026-03-20"
            },
            {
                "id": "REC-1006",
                "patient_name": "Sunita Devi",
                "patient_age": 55,
                "patient_gender": "Female",
                "disease": "Diabetes",
                "health_center_id": 4,
                "health_center_name": "Lakshmi Purva CHC",
                "admitted": True,
                "admission_details": {
                    "sector": "ICU",
                    "bed_number": "ICU1",
                    "admission_date": "2026-03-12",
                    "discharge_date": "2026-03-19",
                    "stay_days": 7
                },
                "medicines": [
                    {"name": "Metformin 500mg", "quantity": "60 tablets"},
                    {"name": "ORS Sachets", "quantity": "10 packets"}
                ],
                "doctor_name": "Dr. Priya Sharma",
                "visit_date": "2026-03-12"
            },
            {
                "id": "REC-1007",
                "patient_name": "Vikram Malhotra",
                "patient_age": 41,
                "patient_gender": "Male",
                "disease": "Skin Problems",
                "health_center_id": 5,
                "health_center_name": "New Colony PHC",
                "admitted": False,
                "admission_details": None,
                "medicines": [
                    {"name": "Cetirizine 10mg", "quantity": "15 tablets"}
                ],
                "doctor_name": "Dr. Meera Patel",
                "visit_date": "2026-04-18"
            },
            {
                "id": "REC-1008",
                "patient_name": "Ananya Iyer",
                "patient_age": 27,
                "patient_gender": "Female",
                "disease": "Other",
                "health_center_id": 6,
                "health_center_name": "Shanti Nagar CHC",
                "admitted": True,
                "admission_details": {
                    "sector": "Operation",
                    "bed_number": "OP2",
                    "admission_date": "2026-05-20",
                    "discharge_date": "2026-05-24",
                    "stay_days": 4
                },
                "medicines": [
                    {"name": "Vitamin D3 Supplements", "quantity": "30 tablets"}
                ],
                "doctor_name": "Dr. Anita Desai",
                "visit_date": "2026-05-20"
            },
            {
                "id": "REC-1009",
                "patient_name": "Karan Johar",
                "patient_age": 50,
                "patient_gender": "Male",
                "disease": "Respiratory Issues",
                "health_center_id": 6,
                "health_center_name": "Shanti Nagar CHC",
                "admitted": True,
                "admission_details": {
                    "sector": "ICU",
                    "bed_number": "ICU2",
                    "admission_date": "2026-02-15",
                    "discharge_date": "2026-02-24",
                    "stay_days": 9
                },
                "medicines": [
                    {"name": "Amoxicillin 250mg", "quantity": "15 tablets"},
                    {"name": "Paracetamol 500mg", "quantity": "10 tablets"}
                ],
                "doctor_name": "Dr. Priya Sharma",
                "visit_date": "2026-02-15"
            },
            {
                "id": "REC-1010",
                "patient_name": "Meera Nair",
                "patient_age": 73,
                "patient_gender": "Female",
                "disease": "Hypertension",
                "health_center_id": 6,
                "health_center_name": "Shanti Nagar CHC",
                "admitted": True,
                "admission_details": {
                    "sector": "General",
                    "bed_number": "G5",
                    "admission_date": "2026-04-01",
                    "discharge_date": "2026-04-07",
                    "stay_days": 6
                },
                "medicines": [
                    {"name": "Amlodipine 5mg", "quantity": "30 tablets"}
                ],
                "doctor_name": "Dr. Priya Sharma",
                "visit_date": "2026-04-01"
            },
            {
                "id": "REC-1011",
                "patient_name": "Rohan Das",
                "patient_age": 19,
                "patient_gender": "Male",
                "disease": "Fever",
                "health_center_id": 6,
                "health_center_name": "Shanti Nagar CHC",
                "admitted": True,
                "admission_details": {
                    "sector": "General",
                    "bed_number": "G2",
                    "admission_date": "2026-06-10",
                    "discharge_date": "2026-06-14",
                    "stay_days": 4
                },
                "medicines": [
                    {"name": "Paracetamol 500mg", "quantity": "12 tablets"},
                    {"name": "ORS Sachets", "quantity": "12 packets"}
                ],
                "doctor_name": "Dr. Vikram Singh",
                "visit_date": "2026-06-10"
            },
            {
                "id": "REC-1012",
                "patient_name": "Aditi Joshi",
                "patient_age": 31,
                "patient_gender": "Female",
                "disease": "Stomach Issues",
                "health_center_id": 7,
                "health_center_name": "Vikas Nagar PHC",
                "admitted": False,
                "admission_details": None,
                "medicines": [
                    {"name": "ORS Sachets", "quantity": "8 packets"},
                    {"name": "Omeprazole 20mg", "quantity": "10 tablets"}
                ],
                "doctor_name": "Dr. Suresh Kumar",
                "visit_date": "2026-06-18"
            },
            {
                "id": "REC-1013",
                "patient_name": "Amit Singhal",
                "patient_age": 38,
                "patient_gender": "Male",
                "disease": "Cold/Cough",
                "health_center_id": 1,
                "health_center_name": "Rajendra Nagar PHC",
                "admitted": False,
                "admission_details": None,
                "medicines": [
                    {"name": "Cetirizine 10mg", "quantity": "10 tablets"},
                    {"name": "Cough Syrup", "quantity": "1 bottle"}
                ],
                "doctor_name": "Dr. Priya Sharma",
                "visit_date": "2026-06-20"
            },
            {
                "id": "REC-1014",
                "patient_name": "Sanjay Gupta",
                "patient_age": 52,
                "patient_gender": "Male",
                "disease": "Diabetes",
                "health_center_id": 2,
                "health_center_name": "Saraswati Nagar CHC",
                "admitted": False,
                "admission_details": None,
                "medicines": [
                    {"name": "Metformin 500mg", "quantity": "90 tablets"}
                ],
                "doctor_name": "Dr. Rahul Verma",
                "visit_date": "2026-05-15"
            },
            {
                "id": "REC-1015",
                "patient_name": "Kavita Rao",
                "patient_age": 47,
                "patient_gender": "Female",
                "disease": "Joint Pain",
                "health_center_id": 3,
                "health_center_name": "Gandhi Marg PHC",
                "admitted": True,
                "admission_details": {
                    "sector": "General",
                    "bed_number": "G1",
                    "admission_date": "2026-04-22",
                    "discharge_date": "2026-04-28",
                    "stay_days": 6
                },
                "medicines": [
                    {"name": "Ibuprofen 400mg", "quantity": "30 tablets"}
                ],
                "doctor_name": "Dr. Suresh Kumar",
                "visit_date": "2026-04-22"
            },
            {
                "id": "REC-1016",
                "patient_name": "Deepak Chawla",
                "patient_age": 60,
                "patient_gender": "Male",
                "disease": "Hypertension",
                "health_center_id": 4,
                "health_center_name": "Lakshmi Purva CHC",
                "admitted": False,
                "admission_details": None,
                "medicines": [
                    {"name": "Amlodipine 5mg", "quantity": "60 tablets"}
                ],
                "doctor_name": "Dr. Priya Sharma",
                "visit_date": "2026-05-18"
            },
            {
                "id": "REC-1017",
                "patient_name": "Pooja Hegde",
                "patient_age": 25,
                "patient_gender": "Female",
                "disease": "Fever",
                "health_center_id": 5,
                "health_center_name": "New Colony PHC",
                "admitted": True,
                "admission_details": {
                    "sector": "General",
                    "bed_number": "G4",
                    "admission_date": "2026-06-01",
                    "discharge_date": "2026-06-04",
                    "stay_days": 3
                },
                "medicines": [
                    {"name": "Paracetamol 500mg", "quantity": "15 tablets"},
                    {"name": "Amoxicillin 250mg", "quantity": "10 tablets"}
                ],
                "doctor_name": "Dr. Meera Patel",
                "visit_date": "2026-06-01"
            },
            {
                "id": "REC-1018",
                "patient_name": "Arjun Reddy",
                "patient_age": 33,
                "patient_gender": "Male",
                "disease": "Stomach Issues",
                "health_center_id": 6,
                "health_center_name": "Shanti Nagar CHC",
                "admitted": False,
                "admission_details": None,
                "medicines": [
                    {"name": "Omeprazole 20mg", "quantity": "10 tablets"},
                    {"name": "ORS Sachets", "quantity": "4 packets"}
                ],
                "doctor_name": "Dr. Vikram Singh",
                "visit_date": "2026-06-25"
            },
            {
                "id": "REC-1019",
                "patient_name": "Neelam Kothari",
                "patient_age": 68,
                "patient_gender": "Female",
                "disease": "Respiratory Issues",
                "health_center_id": 6,
                "health_center_name": "Shanti Nagar CHC",
                "admitted": True,
                "admission_details": {
                    "sector": "General",
                    "bed_number": "G1",
                    "admission_date": "2026-05-12",
                    "discharge_date": "2026-05-22",
                    "stay_days": 10
                },
                "medicines": [
                    {"name": "Amoxicillin 250mg", "quantity": "20 tablets"},
                    {"name": "Vitamin D3 Supplements", "quantity": "10 tablets"}
                ],
                "doctor_name": "Dr. Priya Sharma",
                "visit_date": "2026-05-12"
            },
            {
                "id": "REC-1020",
                "patient_name": "Vikram Seth",
                "patient_age": 55,
                "patient_gender": "Male",
                "disease": "Joint Pain",
                "health_center_id": 7,
                "health_center_name": "Vikas Nagar PHC",
                "admitted": False,
                "admission_details": None,
                "medicines": [
                    {"name": "Ibuprofen 400mg", "quantity": "20 tablets"}
                ],
                "doctor_name": "Dr. Suresh Kumar",
                "visit_date": "2026-06-15"
            }
        ]

    def next_notif_id(self) -> int:
        return next(self._notif_id)

    def next_patient_rec_id(self) -> int:
        return next(self._patient_rec_id)


store = Store()

