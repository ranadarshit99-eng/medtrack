"""
MedTrack API — FastAPI backend.

Run:
    uvicorn app.main:app --reload --port 8000

This is a reference/demo backend: data lives in-memory (see data.py) and
resets on restart. Swap `Store` for real DB-backed repositories to go to
production; the route layer and response shapes would stay the same.
"""
from __future__ import annotations
from typing import Literal, Optional
from datetime import datetime, date, timedelta
from .ml.predictor import predictor

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .data import store, DISEASES, TESTS_CATALOG
from .models import (
    MedicineCreate, MedicineUpdate, MedicineStockDelta,
    BedsUpdate, TestCreate, DoctorCreate, ScheduleCreate,
    PatientEntryCreate, LoginRequest, BedAllocateRequest,
)

app = FastAPI(title="MedTrack API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- helpers --
def get_hc_or_404(hc_id: int) -> dict:
    hc = store.health_centers.get(hc_id)
    if not hc:
        raise HTTPException(404, f"Health center {hc_id} not found")
    return hc


def find_medicine_or_404(hc: dict, med_id: int) -> dict:
    for m in hc["medicines"]:
        if m["id"] == med_id:
            return m
    raise HTTPException(404, f"Medicine {med_id} not found")


def find_doctor_or_404(hc: dict, doc_id: int) -> dict:
    for d in hc["doctors"]:
        if d["id"] == doc_id:
            return d
    raise HTTPException(404, f"Doctor {doc_id} not found")


def unread_alert_count() -> int:
    return sum(1 for n in store.notifications if not n["read"])


# ------------------------------------------------------------------ auth --
@app.post("/api/auth/login")
def login(payload: LoginRequest):
    """Demo auth: role-based only, matching the original prototype's
    'pick a role card' flow. A real deployment would issue a session/JWT
    tied to a specific health-center account here."""
    user_hc_id = 6 if payload.role == "user" else None
    return {"role": payload.role, "user_health_center_id": user_hc_id}


# ------------------------------------------------------------ meta lists --
@app.get("/api/meta")
def meta():
    return {"diseases": DISEASES, "tests_catalog": TESTS_CATALOG}


# ---------------------------------------------------------- health centers
@app.get("/api/health-centers")
def list_health_centers(
    registered_only: bool = Query(default=True),
    q: Optional[str] = Query(default=None, description="filter by name/location"),
):
    items = list(store.health_centers.values())
    if registered_only:
        items = [h for h in items if h["registered"]]
    if q:
        ql = q.lower()
        items = [h for h in items if ql in h["name"].lower() or ql in h["location"].lower()]
    return items


@app.get("/api/health-centers/{hc_id}")
def get_health_center(hc_id: int):
    return get_hc_or_404(hc_id)


@app.post("/api/health-centers/{hc_id}/register-request")
def request_registration(hc_id: int):
    hc = get_hc_or_404(hc_id)
    if hc["registered"]:
        raise HTTPException(400, "Health center is already registered")
    if any(n["type"] == "request" and n["hc_id"] == hc_id for n in store.notifications):
        raise HTTPException(400, "A registration request is already pending")
    store.notifications.insert(0, {
        "id": store.next_notif_id(),
        "type": "request",
        "message": f"{hc['name']} requested to be listed in the district dashboard",
        "from": hc["name"],
        "date": "Just now",
        "read": False,
        "hc_id": hc_id,
    })
    return {"ok": True}


@app.post("/api/health-centers/{hc_id}/accept")
def accept_health_center(hc_id: int):
    hc = get_hc_or_404(hc_id)
    hc["registered"] = True
    store.notifications = [n for n in store.notifications if not (n["type"] == "request" and n["hc_id"] == hc_id)]
    return hc


@app.post("/api/health-centers/{hc_id}/reject")
def reject_health_center(hc_id: int):
    get_hc_or_404(hc_id)
    store.notifications = [n for n in store.notifications if not (n["type"] == "request" and n["hc_id"] == hc_id)]
    return {"ok": True}


# ------------------------------------------------------------------- beds --
@app.patch("/api/health-centers/{hc_id}/beds")
def update_beds(hc_id: int, payload: BedsUpdate):
    hc = get_hc_or_404(hc_id)
    total = payload.total if payload.total is not None else hc["beds"]["total"]
    occupied = payload.occupied if payload.occupied is not None else hc["beds"]["occupied"]
    if occupied > total:
        occupied = total  # clamp, matches original prototype's guard rail
    
    hc["beds"]["total"] = total
    
    # Sync beds_list size
    if "beds_list" not in hc:
        hc["beds_list"] = []
        
    while len(hc["beds_list"]) < total:
        gen_beds = [b for b in hc["beds_list"] if b["sector"] == "General"]
        idx = len(gen_beds) + 1
        bed_id = f"{hc_id}_General_{idx}"
        while any(b["id"] == bed_id for b in hc["beds_list"]):
            idx += 1
            bed_id = f"{hc_id}_General_{idx}"
        hc["beds_list"].append({
            "id": bed_id,
            "number": f"G{idx}",
            "sector": "General",
            "status": "available",
            "patient_name": None,
            "patient_age": None,
            "patient_gender": None,
            "patient_disease": None,
            "allocated_at": None
        })
        
    while len(hc["beds_list"]) > total:
        available_beds = [b for b in hc["beds_list"] if b["status"] == "available"]
        if available_beds:
            hc["beds_list"].remove(available_beds[-1])
        else:
            hc["beds_list"].pop()
            
    # Sync occupied count with beds_list
    hc["beds"]["occupied"] = sum(1 for b in hc["beds_list"] if b["status"] == "occupied")
    return hc["beds"]


@app.post("/api/health-centers/{hc_id}/beds/{bed_id}/allocate")
def allocate_bed(hc_id: int, bed_id: str, payload: BedAllocateRequest):
    hc = get_hc_or_404(hc_id)
    if "beds_list" not in hc:
        hc["beds_list"] = []
    
    bed = next((b for b in hc["beds_list"] if b["id"] == bed_id), None)
    if not bed:
        raise HTTPException(404, f"Bed {bed_id} not found")
    if bed["status"] == "occupied":
        raise HTTPException(400, "Bed is already occupied")
        
    bed["status"] = "occupied"
    bed["patient_name"] = payload.patient_name
    bed["patient_age"] = payload.patient_age
    bed["patient_gender"] = payload.patient_gender
    bed["patient_disease"] = payload.patient_disease
    bed["allocated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    hc["beds"]["occupied"] = sum(1 for b in hc["beds_list"] if b["status"] == "occupied")
    return bed


@app.post("/api/health-centers/{hc_id}/beds/{bed_id}/release")
def release_bed(hc_id: int, bed_id: str):
    hc = get_hc_or_404(hc_id)
    if "beds_list" not in hc:
        hc["beds_list"] = []
        
    bed = next((b for b in hc["beds_list"] if b["id"] == bed_id), None)
    if not bed:
        raise HTTPException(404, f"Bed {bed_id} not found")
    if bed["status"] == "available":
        raise HTTPException(400, "Bed is already vacant")
        
    bed["status"] = "available"
    bed["patient_name"] = None
    bed["patient_age"] = None
    bed["patient_gender"] = None
    bed["patient_disease"] = None
    bed["allocated_at"] = None
    
    hc["beds"]["occupied"] = sum(1 for b in hc["beds_list"] if b["status"] == "occupied")
    return bed


# -------------------------------------------------------------- medicines --
@app.post("/api/health-centers/{hc_id}/medicines")
def add_medicine(hc_id: int, payload: MedicineCreate):
    hc = get_hc_or_404(hc_id)
    if any(m["name"].lower() == payload.name.lower() for m in hc["medicines"]):
        raise HTTPException(400, "Medicine already exists")
    med = {"id": store.next_notif_id() + 100000, **payload.model_dump()}
    hc["medicines"].append(med)
    return med


@app.patch("/api/health-centers/{hc_id}/medicines/{med_id}")
def update_medicine(hc_id: int, med_id: int, payload: MedicineUpdate):
    hc = get_hc_or_404(hc_id)
    med = find_medicine_or_404(hc, med_id)
    for field, val in payload.model_dump(exclude_unset=True).items():
        med[field] = val
    if med["stock"] > med["max_stock"]:
        raise HTTPException(400, "stock cannot exceed max_stock")
    return med


@app.post("/api/health-centers/{hc_id}/medicines/{med_id}/stock-delta")
def adjust_medicine_stock(hc_id: int, med_id: int, payload: MedicineStockDelta):
    hc = get_hc_or_404(hc_id)
    med = find_medicine_or_404(hc, med_id)
    med["stock"] = max(0, min(med["max_stock"], med["stock"] + payload.delta))
    return med


@app.delete("/api/health-centers/{hc_id}/medicines/{med_id}")
def delete_medicine(hc_id: int, med_id: int):
    hc = get_hc_or_404(hc_id)
    find_medicine_or_404(hc, med_id)
    hc["medicines"] = [m for m in hc["medicines"] if m["id"] != med_id]
    return {"ok": True}


# ------------------------------------------------------------------ tests --
@app.post("/api/health-centers/{hc_id}/tests")
def add_test(hc_id: int, payload: TestCreate):
    hc = get_hc_or_404(hc_id)
    if payload.name in hc["tests"]:
        raise HTTPException(400, "Test already exists")
    hc["tests"].append(payload.name)
    return hc["tests"]


@app.delete("/api/health-centers/{hc_id}/tests/{test_name}")
def remove_test(hc_id: int, test_name: str):
    hc = get_hc_or_404(hc_id)
    hc["tests"] = [t for t in hc["tests"] if t != test_name]
    return hc["tests"]


# --------------------------------------------------------------- doctors --
@app.post("/api/health-centers/{hc_id}/doctors")
def add_doctor(hc_id: int, payload: DoctorCreate):
    hc = get_hc_or_404(hc_id)
    doc = {"id": store.next_notif_id() + 200000, "name": payload.name, "spec": payload.spec, "schedule": []}
    hc["doctors"].append(doc)
    return doc


@app.delete("/api/health-centers/{hc_id}/doctors/{doc_id}")
def remove_doctor(hc_id: int, doc_id: int):
    hc = get_hc_or_404(hc_id)
    find_doctor_or_404(hc, doc_id)
    hc["doctors"] = [d for d in hc["doctors"] if d["id"] != doc_id]
    return {"ok": True}


@app.post("/api/health-centers/{hc_id}/doctors/{doc_id}/schedule")
def add_schedule_slot(hc_id: int, doc_id: int, payload: ScheduleCreate):
    hc = get_hc_or_404(hc_id)
    doc = find_doctor_or_404(hc, doc_id)
    doc["schedule"].append(payload.model_dump())
    return doc


@app.delete("/api/health-centers/{hc_id}/doctors/{doc_id}/schedule/{slot_index}")
def remove_schedule_slot(hc_id: int, doc_id: int, slot_index: int):
    hc = get_hc_or_404(hc_id)
    doc = find_doctor_or_404(hc, doc_id)
    if not (0 <= slot_index < len(doc["schedule"])):
        raise HTTPException(404, "Schedule slot not found")
    doc["schedule"].pop(slot_index)
    return doc


# ------------------------------------------------------------- analytics --
def _series(hc: dict, period: Literal["monthly", "daily", "yearly"]) -> list[dict]:
    return {"monthly": hc["patient_monthly"], "daily": hc["patient_daily"], "yearly": hc["patient_yearly"]}[period]


@app.get("/api/health-centers/{hc_id}/analytics")
def hc_analytics(hc_id: int, period: Literal["monthly", "daily", "yearly"] = "monthly"):
    hc = get_hc_or_404(hc_id)
    return _series(hc, period)


@app.get("/api/analytics/aggregate")
def aggregate_analytics(period: Literal["monthly", "daily", "yearly"] = "monthly"):
    """Sums the given period's series across every *registered* health
    center — this replaces the frontend's old `reg[0]` assumption, and
    simply returns an empty series if nothing is registered instead of
    crashing the dashboard."""
    reg = [h for h in store.health_centers.values() if h["registered"]]
    if not reg:
        return []
    length = len(_series(reg[0], period))
    out = []
    for i in range(length):
        label = _series(reg[0], period)[i]["label"]
        total = 0
        diseases: dict[str, int] = {d: 0 for d in DISEASES}
        for h in reg:
            point = _series(h, period)[i]
            total += point["total"]
            for d, v in point["diseases"].items():
                diseases[d] = diseases.get(d, 0) + v
        out.append({"label": label, "total": total, "diseases": diseases})
    return out


@app.post("/api/health-centers/{hc_id}/patient-entry")
def add_patient_entry(hc_id: int, payload: PatientEntryCreate):
    hc = get_hc_or_404(hc_id)
    latest_month = hc["patient_monthly"][-1]
    latest_month["total"] += payload.count
    latest_month["diseases"][payload.disease] = latest_month["diseases"].get(payload.disease, 0) + payload.count
    latest_day = hc["patient_daily"][-1]
    latest_day["total"] += payload.count
    latest_day["diseases"][payload.disease] = latest_day["diseases"].get(payload.disease, 0) + payload.count
    return {"monthly": latest_month, "daily": latest_day}


# --------------------------------------------------------------- alerts ---
@app.get("/api/notifications")
def list_notifications(hc_id: Optional[int] = Query(default=None)):
    all_notifs = list(store.notifications)
    
    if hc_id is not None:
        all_notifs = [n for n in all_notifs if n.get("hc_id") == hc_id]
        reg_centers = [store.health_centers[hc_id]] if hc_id in store.health_centers else []
    else:
        reg_centers = [hc for hc in store.health_centers.values() if hc["registered"]]
    
    ai_alerts = []
    ai_id = 1000000
    for hc in reg_centers:
        try:
            alerts = predictor.generate_alerts(
                hc_id=hc["id"],
                hc_name=hc["name"],
                total_beds=hc["beds"]["total"],
                current_occupied=hc["beds"]["occupied"],
                current_medicines_stock=hc["medicines"]
            )
            for alert in alerts:
                ai_alerts.append({
                    "id": ai_id,
                    "type": "alert",
                    "priority": alert["type"], # Critical or Warning
                    "message": f"[{alert['type']}] {hc['name']}: {alert['message']}",
                    "from": "AI Engine",
                    "date": "Just now",
                    "read": False,
                    "hc_id": hc["id"]
                })
                ai_id += 1
        except Exception as e:
            print(f"Error generating AI alert for center {hc['id']}: {e}")
            
    def sort_key(n):
        p = n.get("priority", "Normal")
        read_val = 1 if n.get("read", False) else 0
        p_val = 0
        if p == "Critical" or p == "alert":
            p_val = 3
        elif p == "Warning":
            p_val = 2
        else:
            p_val = 1
        return (read_val, -p_val)
        
    return sorted(ai_alerts + all_notifs, key=sort_key)


@app.get("/api/notifications/unread-count")
def unread_count():
    return {"count": unread_alert_count()}


@app.post("/api/notifications/{notif_id}/read")
def mark_read(notif_id: int):
    for n in store.notifications:
        if n["id"] == notif_id:
            n["read"] = True
            return n
    raise HTTPException(404, "Notification not found")


@app.post("/api/notifications/mark-all-read")
def mark_all_read():
    for n in store.notifications:
        n["read"] = True
    return store.notifications


# ----------------------------------------------------------- ML Predictions --
@app.get("/api/predictions/center/{hc_id}/disease-trends")
def center_disease_trends(hc_id: int):
    get_hc_or_404(hc_id)
    return predictor.predict_disease_trends(hc_id)

@app.get("/api/predictions/center/{hc_id}/patient-forecast")
def center_patient_forecast(hc_id: int):
    hc = get_hc_or_404(hc_id)
    return predictor.predict_patient_footfall(hc_id, hc["beds"]["total"])

@app.get("/api/predictions/center/{hc_id}/medicine-demand")
def center_medicine_demand(hc_id: int):
    hc = get_hc_or_404(hc_id)
    return predictor.predict_medicine_demand(hc_id, hc["medicines"])

@app.get("/api/predictions/center/{hc_id}/bed-forecast")
def center_bed_forecast(hc_id: int):
    hc = get_hc_or_404(hc_id)
    return predictor.predict_bed_occupancy(hc_id, hc["beds"]["total"], hc["beds"]["occupied"])

@app.get("/api/predictions/center/{hc_id}/alerts-and-recommendations")
def center_alerts_recs(hc_id: int):
    hc = get_hc_or_404(hc_id)
    reg_centers = [h for h in store.health_centers.values() if h["registered"]]
    alerts = predictor.generate_alerts(hc_id, hc["name"], hc["beds"]["total"], hc["beds"]["occupied"], hc["medicines"])
    recs = predictor.generate_recommendations(hc_id, hc["name"], hc["beds"]["total"], hc["beds"]["occupied"], hc["medicines"], reg_centers)
    return {"alerts": alerts, "recommendations": recs}

# Admin dashboard aggregated endpoints
@app.get("/api/predictions/admin/disease-trends")
def admin_disease_trends():
    reg_centers = [hc for hc in store.health_centers.values() if hc["registered"]]
    districts = {}
    for hc in reg_centers:
        dist = hc["location"].split(",")[-1].strip()
        if not dist:
            dist = "Central District"
        if dist not in districts:
            districts[dist] = []
        districts[dist].append(hc)
        
    res = []
    for dist, hcs in districts.items():
        disease_summary = {}
        for hc in hcs:
            trends = predictor.predict_disease_trends(hc["id"])
            for d in trends["summary"]:
                dis_name = d["disease"]
                if dis_name not in disease_summary:
                    disease_summary[dis_name] = {"predicted": 0.0, "historical": 0.0}
                disease_summary[dis_name]["predicted"] += d["predicted_cases"]
                disease_summary[dis_name]["historical"] += d["historical_cases"]
                
        trends_list = []
        for dis_name, vals in disease_summary.items():
            pct = ((vals["predicted"] - vals["historical"]) / max(1.0, vals["historical"])) * 100.0
            direction = "increase" if pct >= 0 else "decrease"
            trends_list.append({
                "disease": dis_name,
                "predicted_cases": round(vals["predicted"], 1),
                "historical_cases": round(vals["historical"], 1),
                "percentage_change": round(pct, 1),
                "direction": direction,
                "message": f"{dis_name} cases expected to {direction} by {abs(round(pct, 1))}% next month."
            })
        res.append({"district": dist, "disease_trends": trends_list})
    return res

@app.get("/api/predictions/admin/medicine-demand")
def admin_medicine_demand():
    reg_centers = [hc for hc in store.health_centers.values() if hc["registered"]]
    med_aggregates = {}
    for hc in reg_centers:
        demand = predictor.predict_medicine_demand(hc["id"], hc["medicines"])
        for d in demand:
            med_name = d["medicine_name"]
            if med_name not in med_aggregates:
                med_aggregates[med_name] = {
                    "current_stock": 0,
                    "max_stock": 0,
                    "predicted_consumption_30d": 0.0,
                    "depletion_days": [],
                    "reorder_qty": 0
                }
            med_aggregates[med_name]["current_stock"] += d["current_stock"]
            med_aggregates[med_name]["max_stock"] += d["max_stock"]
            med_aggregates[med_name]["predicted_consumption_30d"] += d["predicted_consumption_30d"]
            if d["estimated_depletion_days"] is not None:
                med_aggregates[med_name]["depletion_days"].append(d["estimated_depletion_days"])
            med_aggregates[med_name]["reorder_qty"] += d["recommended_reorder_quantity"]
            
    res = []
    for med_name, vals in med_aggregates.items():
        min_dep = min(vals["depletion_days"]) if vals["depletion_days"] else None
        dep_date = (date.today() + timedelta(days=min_dep)).strftime("%Y-%m-%d") if min_dep is not None else None
        status = f"Stock will finish within {min_dep} days." if min_dep is not None else "Stock is sufficient."
        res.append({
            "medicine_name": med_name,
            "current_stock": vals["current_stock"],
            "max_stock": vals["max_stock"],
            "predicted_consumption_30d": round(vals["predicted_consumption_30d"], 1),
            "estimated_depletion_days": min_dep,
            "estimated_depletion_date": dep_date,
            "recommended_reorder_quantity": vals["reorder_qty"],
            "status_message": status
        })
    return res

@app.get("/api/predictions/admin/patient-forecast")
def admin_patient_forecast():
    reg_centers = [hc for hc in store.health_centers.values() if hc["registered"]]
    system_wide = {"tomorrow": 0, "next_week": 0, "next_month": 0}
    districts = {}
    
    for hc in reg_centers:
        dist = hc["location"].split(",")[-1].strip() or "Central District"
        if dist not in districts:
            districts[dist] = {"tomorrow": 0, "next_week": 0, "next_month": 0}
            
        fc = predictor.predict_patient_footfall(hc["id"], hc["beds"]["total"])
        for period in ["tomorrow", "next_week", "next_month"]:
            val = fc[period]["total_patients"]
            system_wide[period] += val
            districts[dist][period] += val
            
    return {"system_wide": system_wide, "districts": districts}

@app.get("/api/predictions/admin/bed-forecast")
def admin_bed_forecast():
    reg_centers = [hc for hc in store.health_centers.values() if hc["registered"]]
    total_beds = 0
    total_occupied = 0
    predicted_occupied_next_week = 0.0
    high_occupancy_centers = []
    
    for hc in reg_centers:
        total_beds += hc["beds"]["total"]
        total_occupied += hc["beds"]["occupied"]
        
        bed_pred = predictor.predict_bed_occupancy(hc["id"], hc["beds"]["total"], hc["beds"]["occupied"])
        predicted_occupied_next_week += bed_pred["average_predicted_occupied_beds"]
        
        pred_pct = bed_pred["predicted_occupancy_percentage_next_week"]
        curr_pct = bed_pred["current_occupancy_percentage"]
        
        if pred_pct > 80.0:
            high_occupancy_centers.append({
                "hc_id": hc["id"],
                "name": hc["name"],
                "current_occupancy": curr_pct,
                "predicted_occupancy": pred_pct
            })
            
    avg_pred_pct = round((predicted_occupied_next_week / max(1, total_beds)) * 100.0, 1)
    
    return {
        "total_beds": total_beds,
        "current_occupied": total_occupied,
        "predicted_occupancy_percentage_next_week": avg_pred_pct,
        "high_occupancy_centers": high_occupancy_centers
    }

@app.get("/api/predictions/admin/recommendations")
def admin_recommendations():
    reg_centers = [hc for hc in store.health_centers.values() if hc["registered"]]
    all_recs = []
    for hc in reg_centers:
        recs = predictor.generate_recommendations(hc["id"], hc["name"], hc["beds"]["total"], hc["beds"]["occupied"], hc["medicines"], reg_centers)
        for r in recs:
            all_recs.append({
                "hc_id": hc["id"],
                "hc_name": hc["name"],
                **r
            })
    prio_map = {"High": 3, "Medium": 2, "Low": 1}
    all_recs.sort(key=lambda x: prio_map.get(x["priority"], 1), reverse=True)
    return all_recs

@app.get("/api/predictions/admin/alerts")
def admin_alerts():
    reg_centers = [hc for hc in store.health_centers.values() if hc["registered"]]
    all_alerts = []
    for hc in reg_centers:
        alerts = predictor.generate_alerts(hc["id"], hc["name"], hc["beds"]["total"], hc["beds"]["occupied"], hc["medicines"])
        all_alerts.extend(alerts)
    prio_map = {"Critical": 3, "Warning": 2, "Normal": 1}
    all_alerts.sort(key=lambda x: prio_map.get(x["type"], 1), reverse=True)
    return all_alerts


@app.get("/api/analytics/medicine-history")
def medicine_history(medicine_name: str, hc_id: Optional[int] = Query(default=None)):
    import os
    import pandas as pd
    csv_path = "data/synthetic_healthcare_data.csv"
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail="Historical dataset not found. Please run training pipeline.")
    
    # Read the CSV file
    df = pd.read_csv(csv_path)
    df["Date"] = pd.to_datetime(df["Date"])
    
    # Filter by medicine name and health center if provided
    # Perform case-insensitive match
    filtered_df = df[df["Medicine_Name"].str.lower() == medicine_name.lower()]
    if hc_id is not None:
        filtered_df = filtered_df[filtered_df["Health_Center_ID"] == hc_id]
        
    if filtered_df.empty:
        return {
            "medicine_name": medicine_name,
            "category": "General",
            "current_stock": 0,
            "max_stock": 200,
            "yearly": {"2023": 0, "2024": 0, "2025": 0},
            "monthly": [],
            "daily": []
        }
        
    # Aggregate by year
    yearly_data = filtered_df.groupby(filtered_df["Date"].dt.year)["Medicine_Consumption"].sum().to_dict()
    for y in [2023, 2024, 2025]:
        if y not in yearly_data:
            yearly_data[y] = 0
            
    # Aggregate monthly for the last 12 months
    max_date = df["Date"].max()
    start_12m = max_date - pd.Timedelta(days=365)
    df_12m = filtered_df[filtered_df["Date"] > start_12m]
    monthly_series = df_12m.groupby(df_12m["Date"].dt.strftime("%b %Y"))["Medicine_Consumption"].sum()
    monthly_series = monthly_series.reindex(
        pd.date_range(start=start_12m, end=max_date, freq='ME').strftime("%b %Y").unique(),
        fill_value=0
    )
    monthly_list = [{"label": label, "consumption": int(val)} for label, val in monthly_series.items()]
    
    # Daily for the last 30 days
    start_30d = max_date - pd.Timedelta(days=30)
    df_30d = filtered_df[filtered_df["Date"] > start_30d]
    daily_series = df_30d.groupby(df_30d["Date"].dt.strftime("%Y-%m-%d"))["Medicine_Consumption"].sum()
    daily_series = daily_series.reindex(
        pd.date_range(start=start_30d, end=max_date, freq='D').strftime("%Y-%m-%d"),
        fill_value=0
    )
    daily_list = [{"date": label, "consumption": int(val)} for label, val in daily_series.items()]
    
    # Also fetch details (current stock, category, max stock) from memory store if active
    current_stock = 0
    max_stock = 200
    category = "General"
    
    hcs_to_search = [store.health_centers[hc_id]] if (hc_id is not None and hc_id in store.health_centers) else list(store.health_centers.values())
    for hc in hcs_to_search:
        for med in hc.get("medicines", []):
            if med["name"].lower() == medicine_name.lower():
                current_stock += med["stock"]
                max_stock = max(max_stock, med["max_stock"])
                category = med["category"]
                
    return {
        "medicine_name": medicine_name,
        "category": category,
        "current_stock": current_stock,
        "max_stock": max_stock,
        "yearly": {str(k): int(v) for k, v in yearly_data.items()},
        "monthly": monthly_list,
        "daily": daily_list
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
