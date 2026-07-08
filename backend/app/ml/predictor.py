import os
import joblib
import pandas as pd
import numpy as np
import json
from datetime import datetime, date, timedelta

MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")

# Disease list matching data_generator.py
DISEASES = [
    "Fever", "Cold/Cough", "Diabetes", "Hypertension", "Stomach Issues",
    "Skin Problems", "Respiratory Issues", "Joint Pain", "Eye Problems", "Other"
]

# Medicine details matching data_generator.py
DISEASE_MEDICINE_MAP = {
    "Fever": ("Paracetamol 500mg", "Analgesic", 2),
    "Cold/Cough": ("Cough Syrup", "Expectorant", 1),
    "Diabetes": ("Metformin 500mg", "Antidiabetic", 2),
    "Hypertension": ("Amlodipine 5mg", "Antihypertensive", 1),
    "Stomach Issues": ("ORS Sachets", "Rehydration", 3),
    "Skin Problems": ("Cetirizine 10mg", "Antihistamine", 1),
    "Respiratory Issues": ("Amoxicillin 250mg", "Antibiotic", 3),
    "Joint Pain": ("Ibuprofen 400mg", "Analgesic", 2),
    "Eye Problems": ("Vitamin D3 Supplements", "Supplement", 1),
    "Other": ("Paracetamol 500mg", "Analgesic", 2)
}

# Distribute target names
MEDICINES = list(set([val[0] for val in DISEASE_MEDICINE_MAP.values()]))

def get_future_weather(curr_date):
    month = curr_date.month
    # Approximate weather patterns matching generator
    if month in [6, 7, 8, 9]:
        season = "Monsoon"
        weather = "Rainy"
        rainfall = 30.0 if month in [7, 8] else 15.0
        temp = 28.0
    elif month in [11, 12, 1]:
        season = "Winter"
        weather = "Cold"
        rainfall = 0.0
        temp = 12.0
    elif month in [3, 4, 5]:
        season = "Summer"
        weather = "Sunny"
        rainfall = 0.0
        temp = 38.0
    else:
        season = "Spring" if month == 2 else "Autumn"
        weather = "Sunny"
        rainfall = 1.0
        temp = 24.0
        
    is_holiday = 0
    holidays = [(1, 1), (1, 26), (8, 15), (10, 2), (12, 25)]
    if (curr_date.month, curr_date.day) in holidays or curr_date.weekday() in [5, 6]:
        is_holiday = 1
        
    return season, weather, temp, rainfall, is_holiday

class HealthcarePredictor:
    def __init__(self):
        self.models = {}
        self.encoders = {}
        self.features = {}
        self.baselines = {}
        self.pipeline_meta = {}
        self.loaded = False

    def load_resources(self):
        if self.loaded:
            return
            
        tasks = ["disease_trend", "patient_footfall", "medicine_demand", "bed_occupancy"]
        
        # Check if all files exist
        for task in tasks:
            model_path = os.path.join(MODEL_DIR, f"{task}_model.joblib")
            encoders_path = os.path.join(MODEL_DIR, f"{task}_encoders.joblib")
            features_path = os.path.join(MODEL_DIR, f"{task}_features.json")
            
            if not (os.path.exists(model_path) and os.path.exists(encoders_path) and os.path.exists(features_path)):
                print(f"ML models are not fully trained yet. Call train pipeline first. Missing: {task}")
                return
                
            self.models[task] = joblib.load(model_path)
            self.encoders[task] = joblib.load(encoders_path)
            with open(features_path, "r") as f:
                self.features[task] = json.load(f)
                
        # Load baselines
        self.baselines["disease"] = pd.read_csv(os.path.join(MODEL_DIR, "disease_baselines.csv"))
        self.baselines["footfall"] = pd.read_csv(os.path.join(MODEL_DIR, "footfall_baselines.csv"))
        self.baselines["medicine"] = pd.read_csv(os.path.join(MODEL_DIR, "medicine_baselines.csv"))
        self.baselines["beds"] = pd.read_csv(os.path.join(MODEL_DIR, "beds_baselines.csv"))
        
        # Load pipeline metadata
        meta_path = os.path.join(MODEL_DIR, "pipeline_metadata.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                self.pipeline_meta = json.load(f)
                
        self.loaded = True
        print("HealthcarePredictor resources loaded successfully!")

    def prepare_future_dataframe(self, hc_id, target_dates, task_name, extra_keys=None):
        """Generates raw feature dataframe for a center and target dates."""
        records = []
        for d in target_dates:
            season, weather, temp, rainfall, is_holiday = get_future_weather(d)
            month = d.month
            day_of_week = d.weekday()
            day_of_year = d.timetuple().tm_yday
            is_weekend = 1 if day_of_week in [5, 6] else 0
            
            base_record = {
                "Date": d,
                "Health_Center_ID": hc_id,
                "month": month,
                "day_of_week": day_of_week,
                "day_of_year": day_of_year,
                "is_weekend": is_weekend,
                "Temperature": temp,
                "Rainfall": rainfall,
                "Festival_Holiday": is_holiday,
                "Weather": weather,
                "Season": season
            }
            
            if extra_keys:
                for k, v in extra_keys.items():
                    for val in v:
                        rec = base_record.copy()
                        rec[k] = val
                        records.append(rec)
            else:
                records.append(base_record)
                
        df = pd.DataFrame(records)
        return df

    def encode_and_predict(self, df, task_name):
        """Applies ordinal encoders and predicts using the chosen model."""
        self.load_resources()
        if not self.loaded:
            # Fallback average if not loaded
            return np.zeros(len(df))
            
        model = self.models[task_name]
        encoders = self.encoders[task_name]
        features = self.features[task_name]
        
        df_encoded = df.copy()
        for col, encoder in encoders.items():
            if col in df_encoded.columns:
                df_encoded[[col]] = encoder.transform(df_encoded[[col]].astype(str))
                
        # Fill standard scaling or missing baseline if any
        X = df_encoded[features]
        preds = model.predict(X)
        return np.maximum(0, preds)

    # 1. Disease Trend Prediction
    def predict_disease_trends(self, hc_id, days=30):
        self.load_resources()
        target_dates = [date.today() + timedelta(days=i) for i in range(days)]
        
        # Build raw frame with diseases
        df = self.prepare_future_dataframe(hc_id, target_dates, "disease_trend", {"Disease_Name": DISEASES})
        
        # Add baseline
        if self.loaded:
            base_df = self.baselines["disease"]
            df = pd.merge(df, base_df, on=["Health_Center_ID", "Disease_Name", "month"], how="left")
            df["hist_disease_p_avg"] = df["hist_disease_p_avg"].fillna(df["Number_of_Patients"].mean() if "Number_of_Patients" in df else 1.0)
        else:
            df["hist_disease_p_avg"] = 1.0
            
        preds = self.encode_and_predict(df, "disease_trend")
        df["Predicted_Patients"] = preds
        
        # Aggregate results
        # Group by disease to get trends
        trend_summary = df.groupby("Disease_Name")["Predicted_Patients"].sum().reset_index()
        
        # Compare with historical averages to calculate percentage change
        # Historical baseline: monthly average * days ratio
        historical_summary = []
        curr_month = date.today().month
        for d in DISEASES:
            if self.loaded:
                base_val = self.baselines["disease"]
                val = base_val[(base_val["Health_Center_ID"] == hc_id) & (base_val["Disease_Name"] == d) & (base_val["month"] == curr_month)]
                hist_avg = val["hist_disease_p_avg"].values[0] if len(val) > 0 else 2.0
            else:
                hist_avg = 2.0
            historical_summary.append(hist_avg * days)
            
        trend_summary["Historical_Average"] = historical_summary
        trend_summary["Percentage_Change"] = ((trend_summary["Predicted_Patients"] - trend_summary["Historical_Average"]) / np.maximum(1.0, trend_summary["Historical_Average"])) * 100.0
        
        # Predict daily values
        daily_trends = []
        for d in DISEASES:
            d_df = df[df["Disease_Name"] == d].sort_values("Date")
            daily_trends.append({
                "disease": d,
                "daily_forecast": [{"date": r["Date"].strftime("%Y-%m-%d"), "patients": round(float(r["Predicted_Patients"]), 1)} for _, r in d_df.iterrows()]
            })
            
        results = []
        for _, r in trend_summary.iterrows():
            disease = r["Disease_Name"]
            pct = round(r["Percentage_Change"], 1)
            direction = "increase" if pct >= 0 else "decrease"
            results.append({
                "disease": disease,
                "predicted_cases": round(float(r["Predicted_Patients"]), 1),
                "historical_cases": round(float(r["Historical_Average"]), 1),
                "percentage_change": pct,
                "direction": direction,
                "message": f"{disease} cases expected to {direction} by {abs(pct)}% next {days} days."
            })
            
        return {"summary": results, "daily": daily_trends}

    # 2. Patient Footfall Prediction
    def predict_patient_footfall(self, hc_id, total_beds=50):
        self.load_resources()
        # Tomorrow (1 day), Next Week (7 days), Next Month (30 days)
        periods = {"tomorrow": 1, "next_week": 7, "next_month": 30}
        predictions = {}
        
        for name, days in periods.items():
            target_dates = [date.today() + timedelta(days=i) for i in range(1, days + 1)]
            df = self.prepare_future_dataframe(hc_id, target_dates, "patient_footfall")
            df["Total_Beds"] = total_beds
            
            # Baseline
            if self.loaded:
                base_df = self.baselines["footfall"]
                df = pd.merge(df, base_df, on=["Health_Center_ID", "month"], how="left")
                df["hist_patients_avg"] = df["hist_patients_avg"].fillna(25.0)
            else:
                df["hist_patients_avg"] = 25.0
                
            preds = self.encode_and_predict(df, "patient_footfall")
            predictions[name] = {
                "total_patients": int(np.sum(preds)),
                "daily_average": round(float(np.mean(preds)), 1),
                "daily_forecast": [{"date": r["Date"].strftime("%Y-%m-%d"), "patients": round(float(p), 1)} for r, p in zip(df.to_dict('records'), preds)]
            }
            
        return predictions

    # 3. Medicine Demand Prediction
    def predict_medicine_demand(self, hc_id, current_medicines_stock):
        """
        current_medicines_stock: list of dicts representing medicines with keys: name, stock, max_stock
        """
        self.load_resources()
        days_to_forecast = 30
        target_dates = [date.today() + timedelta(days=i) for i in range(days_to_forecast)]
        
        # Generate DataFrame with all medicines
        df = self.prepare_future_dataframe(hc_id, target_dates, "medicine_demand", {"Medicine_Name": MEDICINES})
        
        # Baselines
        if self.loaded:
            base_df = self.baselines["medicine"]
            df = pd.merge(df, base_df, on=["Health_Center_ID", "Medicine_Name", "month"], how="left")
            df["hist_med_avg"] = df["hist_med_avg"].fillna(10.0)
        else:
            df["hist_med_avg"] = 10.0
            
        preds = self.encode_and_predict(df, "medicine_demand")
        df["Predicted_Consumption"] = preds
        
        # Group by medicine name and date
        results = []
        for med in current_medicines_stock:
            name = med["name"]
            curr_stock = med["stock"]
            max_stock = med["max_stock"]
            
            med_df = df[df["Medicine_Name"] == name].sort_values("Date")
            
            total_30d_consumption = float(med_df["Predicted_Consumption"].sum())
            daily_avg = float(med_df["Predicted_Consumption"].mean())
            
            # Stock depletion calculation
            depletion_days = None
            temp_stock = curr_stock
            for idx, r in enumerate(med_df.to_dict("records")):
                temp_stock -= r["Predicted_Consumption"]
                if temp_stock <= 0:
                    depletion_days = idx + 1
                    break
                    
            depletion_date = None
            if depletion_days is not None:
                depletion_date = (date.today() + timedelta(days=depletion_days)).strftime("%Y-%m-%d")
                status = f"Paracetamol stock will finish within {depletion_days} days." if "paracetamol" in name.lower() else f"{name} stock will finish within {depletion_days} days."
            else:
                status = f"{name} stock is sufficient for the next 30 days."
                
            # Recommended reorder quantity: replenish back to max stock if depletion occurs in next 15 days
            reorder_qty = 0
            if depletion_days is not None and depletion_days <= 15:
                reorder_qty = max(0, max_stock - curr_stock)
                if reorder_qty == 0:
                    reorder_qty = int(daily_avg * 30) # 30 day supply
                    
            daily_consumption_forecast = [{"date": r["Date"].strftime("%Y-%m-%d"), "consumption": round(float(r["Predicted_Consumption"]), 1)} for r in med_df.to_dict("records")]
            
            results.append({
                "medicine_name": name,
                "current_stock": curr_stock,
                "max_stock": max_stock,
                "predicted_consumption_30d": round(total_30d_consumption, 1),
                "daily_average_consumption": round(daily_avg, 1),
                "estimated_depletion_days": depletion_days,
                "estimated_depletion_date": depletion_date,
                "recommended_reorder_quantity": int(reorder_qty),
                "status_message": status,
                "daily_forecast": daily_consumption_forecast
            })
            
        return results

    # 4. Bed Occupancy Prediction
    def predict_bed_occupancy(self, hc_id, total_beds=50, current_occupied=30):
        self.load_resources()
        # Predict occupied beds for next 7 days
        target_dates = [date.today() + timedelta(days=i) for i in range(1, 8)]
        df = self.prepare_future_dataframe(hc_id, target_dates, "bed_occupancy")
        df["Total_Beds"] = total_beds
        
        # Baselines
        if self.loaded:
            base_df = self.baselines["beds"]
            df = pd.merge(df, base_df, on=["Health_Center_ID", "month"], how="left")
            df["hist_beds_avg"] = df["hist_beds_avg"].fillna(float(total_beds * 0.5))
        else:
            df["hist_beds_avg"] = float(total_beds * 0.5)
            
        preds = self.encode_and_predict(df, "bed_occupancy")
        df["Predicted_Occupied"] = np.minimum(total_beds, preds)
        
        daily_forecast = []
        for r, val in zip(df.to_dict("records"), preds):
            occ_pct = round((val / total_beds) * 100.0, 1)
            daily_forecast.append({
                "date": r["Date"].strftime("%Y-%m-%d"),
                "occupied_beds": int(min(total_beds, round(val))),
                "occupancy_percentage": min(100.0, occ_pct)
            })
            
        avg_occupied = np.mean(preds)
        predicted_occupancy_pct = round((avg_occupied / total_beds) * 100.0, 1)
        current_occupancy_pct = round((current_occupied / total_beds) * 100.0, 1)
        
        return {
            "current_occupancy_percentage": min(100.0, current_occupancy_pct),
            "predicted_occupancy_percentage_next_week": min(100.0, predicted_occupancy_pct),
            "average_predicted_occupied_beds": int(round(avg_occupied)),
            "total_beds": total_beds,
            "status_message": f"Current Occupancy : {current_occupancy_pct}%. Predicted Occupancy Next Week : {predicted_occupancy_pct}%.",
            "daily_forecast": daily_forecast
        }

    # 5. AI Recommendations
    def generate_recommendations(self, hc_id, hc_name, total_beds, current_occupied, current_medicines_stock, registered_centers=None):
        self.load_resources()
        recommendations = []
        
        # 1. Medicine Stocks & Transfer Recommendations
        med_demand = self.predict_medicine_demand(hc_id, current_medicines_stock)
        for med in med_demand:
            med_name = med["medicine_name"]
            depletion_days = med["estimated_depletion_days"]
            reorder_qty = med["recommended_reorder_quantity"]
            curr_stock = med["current_stock"]
            max_stock = med["max_stock"]
            
            clean_med_name = med_name
            for suffix in [" 500mg", " 5mg", " 250mg", " 400mg", " Syrup", " Sachets", " 10mg"]:
                clean_med_name = clean_med_name.replace(suffix, "")
            clean_med_name = clean_med_name.strip()
            
            if depletion_days is not None and depletion_days <= 10:
                # Calculate target date: date.today() + depletion_days - 3 days
                order_by_date = (date.today() + timedelta(days=max(1, depletion_days - 3)))
                order_by_str = order_by_date.strftime("%B %d").replace(" 0", " ") # e.g. "August 5"
                
                unit = "tablets"
                if "syrup" in med_name.lower():
                    unit = "bottles"
                elif "sachets" in med_name.lower() or "ors" in med_name.lower():
                    unit = "packets"
                
                # High priority order recommendation
                recommendations.append({
                    "type": "order",
                    "priority": "High" if depletion_days <= 3 else "Medium",
                    "action": f"Order {reorder_qty} {clean_med_name} {unit} before {order_by_str}.",
                    "rationale": f"Stock is critically low and predicted to deplete in {depletion_days} days due to forecasted consumption."
                })
                
                # Check for transfers if we have multiple centers
                if registered_centers:
                    for other_hc in registered_centers:
                        if other_hc["id"] == hc_id:
                            continue
                        # Look for same medicine in other center
                        for other_med in other_hc.get("medicines", []):
                            if other_med["name"] == med_name and other_med["stock"] > 0.5 * other_med["max_stock"]:
                                transfer_amount = min(int(other_med["stock"] * 0.3), reorder_qty)
                                if transfer_amount >= 50:
                                    recommendations.append({
                                        "type": "transfer",
                                        "priority": "Medium",
                                        "action": f"Transfer {transfer_amount} units of {med_name} from {other_hc['name']} to {hc_name}.",
                                        "rationale": f"{other_hc['name']} has surplus stock ({other_med['stock']} units), while {hc_name} is running dry."
                                    })
                                    break
                                    
        # 2. Bed Occupancy Recommendations
        bed_pred = self.predict_bed_occupancy(hc_id, total_beds, current_occupied)
        predicted_occ_pct = bed_pred["predicted_occupancy_percentage_next_week"]
        
        disease_trends = self.predict_disease_trends(hc_id, days=30)
        dengue_outbreak = any(d["disease"] == "Dengue" and d["percentage_change"] >= 35.0 for d in disease_trends["summary"])
        
        if predicted_occ_pct > 95.0:
            extra_beds = int(total_beds * 0.15)
            action_msg = f"Prepare {extra_beds} additional beds for the upcoming dengue season." if dengue_outbreak else f"Prepare {extra_beds} extra beds at {hc_name}."
            recommendations.append({
                "type": "infrastructure",
                "priority": "High",
                "action": action_msg,
                "rationale": f"Bed occupancy is predicted to reach {predicted_occ_pct}% next week, exceeding critical threshold (95%)."
            })
        elif predicted_occ_pct > 80.0:
            extra_beds = int(total_beds * 0.1)
            action_msg = f"Prepare {extra_beds} additional beds for the upcoming dengue season." if dengue_outbreak else f"Prepare {extra_beds} extra beds at {hc_name}."
            recommendations.append({
                "type": "infrastructure",
                "priority": "Medium",
                "action": action_msg,
                "rationale": f"Bed occupancy is predicted to reach {predicted_occ_pct}% next week."
            })
            
        # 3. Doctor/Staff Deployment Recommendations
        footfall_pred = self.predict_patient_footfall(hc_id, total_beds)
        next_week_avg_daily = footfall_pred["next_week"]["daily_average"]
        
        if self.loaded:
            curr_month = date.today().month
            base_ff = self.baselines["footfall"]
            hc_base = base_ff[(base_ff["Health_Center_ID"] == hc_id) & (base_ff["month"] == curr_month)]
            hist_daily_avg = hc_base["hist_patients_avg"].values[0] if len(hc_base) > 0 else 25.0
        else:
            hist_daily_avg = 25.0
            
        if next_week_avg_daily > 1.35 * hist_daily_avg:
            recommendations.append({
                "type": "staffing",
                "priority": "High",
                "action": f"Deploy one additional doctor to {hc_name} for the next week.",
                "rationale": f"Patient footfall is forecasted to surge by {round(((next_week_avg_daily - hist_daily_avg)/hist_daily_avg)*100)}% over the historical average."
            })
            
        # 4. Outbreak-specific Medical Supplies
        for d in disease_trends["summary"]:
            disease = d["disease"]
            pct_change = d["percentage_change"]
            
            if pct_change >= 35.0:
                if disease in ["Dengue", "Malaria"]:
                    recommendations.append({
                        "type": "supplies",
                        "priority": "High",
                        "action": "Increase Blood Test kits by 20%.",
                        "rationale": f"{disease} cases are predicted to spike by {pct_change}% next month due to monsoon weather trends."
                    })
                elif disease == "Stomach Issues":
                    recommendations.append({
                        "type": "supplies",
                        "priority": "Medium",
                        "action": f"Procure 1000 extra ORS packets and IV fluids for {hc_name}.",
                        "rationale": f"Stomach disease cases are expected to increase by {pct_change}%."
                    })
                    
        # 5. Routine / Normal Priority Recommendations
        if not any(r["priority"] == "High" for r in recommendations):
            recommendations.append({
                "type": "routine",
                "priority": "Low",
                "action": "Perform routine inspection of medicine batch expiry dates.",
                "rationale": "Recommended preventive task for health center inventory maintenance."
            })
            
        return recommendations

    # 6. AI Alerts
    def generate_alerts(self, hc_id, hc_name, total_beds, current_occupied, current_medicines_stock):
        self.load_resources()
        alerts = []
        
        # 1. Medicine Expiry/Depletion Alerts
        med_demand = self.predict_medicine_demand(hc_id, current_medicines_stock)
        for med in med_demand:
            name = med["medicine_name"]
            depletion_days = med["estimated_depletion_days"]
            curr_stock = med["current_stock"]
            max_stock = med["max_stock"]
            
            clean_name = name
            for suffix in [" 500mg", " 5mg", " 250mg", " 400mg", " Syrup", " Sachets", " 10mg"]:
                clean_name = clean_name.replace(suffix, "")
            clean_name = clean_name.strip()
            
            if depletion_days is not None:
                if depletion_days <= 3:
                    alerts.append({
                        "hc_id": hc_id,
                        "hc_name": hc_name,
                        "type": "Critical",
                        "title": f"Medicine stock depletion: {clean_name}",
                        "message": f"Medicine stock for {clean_name} is expected to finish within {depletion_days} days.",
                        "code": "MED_DEPLETION"
                    })
                elif depletion_days <= 10:
                    alerts.append({
                        "hc_id": hc_id,
                        "hc_name": hc_name,
                        "type": "Warning",
                        "title": f"Medicine stock below threshold: {clean_name}",
                        "message": f"Medicine stock for {clean_name} is below threshold. Estimated Stock Remaining: {depletion_days} Days.",
                        "code": "MED_DEPLETION_WARN"
                    })
            elif curr_stock <= 0.2 * max_stock:
                alerts.append({
                    "hc_id": hc_id,
                    "hc_name": hc_name,
                    "type": "Warning",
                    "title": f"Medicine stock below threshold: {clean_name}",
                    "message": f"Medicine stock for {clean_name} ({curr_stock}/{max_stock}) is below threshold.",
                    "code": "MED_THRESHOLD"
                })
                
        # 2. Bed Occupancy Alerts
        bed_pred = self.predict_bed_occupancy(hc_id, total_beds, current_occupied)
        predicted_occ_pct = bed_pred["predicted_occupancy_percentage_next_week"]
        if predicted_occ_pct > 95.0:
            alerts.append({
                "hc_id": hc_id,
                "hc_name": hc_name,
                "type": "Critical",
                "title": "Critical Bed Occupancy Predicted",
                "message": f"Bed occupancy is predicted to rise above 95% ({round(predicted_occ_pct)}%) in the upcoming week.",
                "code": "BED_OVERFLOW"
            })
        elif predicted_occ_pct > 80.0:
            alerts.append({
                "hc_id": hc_id,
                "hc_name": hc_name,
                "type": "Warning",
                "title": "High Bed Occupancy Predicted",
                "message": f"Bed occupancy is predicted to rise above 80% ({round(predicted_occ_pct)}%) in the upcoming week.",
                "code": "BED_HIGH"
            })
            
        # 3. Disease Outbreaks Alerts
        disease_trends = self.predict_disease_trends(hc_id, days=30)
        for d in disease_trends["summary"]:
            disease = d["disease"]
            pct_change = d["percentage_change"]
            if pct_change >= 35.0:
                alerts.append({
                    "hc_id": hc_id,
                    "hc_name": hc_name,
                    "type": "Critical",
                    "title": f"Predicted Disease Outbreak: {disease}",
                    "message": f"{disease} cases expected to increase by {round(pct_change)}% next month. Prepare preventive measures.",
                    "code": f"OUTBREAK_{disease.upper().replace(' ', '_')}"
                })
            elif pct_change >= 10.0:
                alerts.append({
                    "hc_id": hc_id,
                    "hc_name": hc_name,
                    "type": "Normal",
                    "title": f"Seasonal Trend: {disease}",
                    "message": f"Seasonal trend detected: {disease} cases expected to rise by {round(pct_change)}% next month.",
                    "code": f"SEASONAL_{disease.upper().replace(' ', '_')}"
                })
                
        # 4. Patient Load Alerts
        footfall_pred = self.predict_patient_footfall(hc_id, total_beds)
        next_week_avg_daily = footfall_pred["next_week"]["daily_average"]
        if self.loaded:
            curr_month = date.today().month
            base_ff = self.baselines["footfall"]
            hc_base = base_ff[(base_ff["Health_Center_ID"] == hc_id) & (base_ff["month"] == curr_month)]
            hist_daily_avg = hc_base["hist_patients_avg"].values[0] if len(hc_base) > 0 else 25.0
        else:
            hist_daily_avg = 25.0
            
        if next_week_avg_daily > hist_daily_avg:
            alerts.append({
                "hc_id": hc_id,
                "hc_name": hc_name,
                "type": "Warning",
                "title": "Patient Load Warning",
                "message": f"Patient footfall is expected to increase by {round(((next_week_avg_daily - hist_daily_avg)/hist_daily_avg)*100)}% next week.",
                "code": "PATIENT_SURGE"
            })
            
        # 5. Routine / Normal Priority alerts for recommendations
        recs = self.generate_recommendations(hc_id, hc_name, total_beds, current_occupied, current_medicines_stock)
        for r in recs:
            if r["priority"] == "Low":
                alerts.append({
                    "hc_id": hc_id,
                    "hc_name": hc_name,
                    "type": "Normal",
                    "title": "Routine Recommendation",
                    "message": r["action"],
                    "code": f"REC_{r['type'].upper()}"
                })
                
        return alerts

predictor = HealthcarePredictor()
