import os
import random
import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta
import json

# Set seed for reproducibility
random.seed(42)
np.random.seed(42)

# Disease list matching app/data.py but focused on realistic patterns
DISEASES = [
    "Fever", "Cold/Cough", "Diabetes", "Hypertension", "Stomach Issues",
    "Skin Problems", "Respiratory Issues", "Joint Pain", "Eye Problems", "Other"
]

# Medicine mapping: (Medicine Name, Category, Avg consumption per patient)
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

# Districts and states
DISTRICTS = ["Central District", "East District", "West District", "North District", "South District"]
STATES = ["State A", "State B"]

# Generate Health Center metadata
def generate_health_centers(num_centers=100):
    centers = []
    for i in range(1, num_centers + 1):
        state = random.choice(STATES)
        district = random.choice(DISTRICTS)
        is_chc = (i % 3 == 0) # Community Health Center (larger) vs Primary Health Center (smaller)
        center_type = "CHC" if is_chc else "PHC"
        
        name = f"Center {i} {center_type}"
        total_beds = random.randint(60, 150) if is_chc else random.randint(20, 50)
        num_doctors = random.randint(8, 15) if is_chc else random.randint(3, 7)
        
        centers.append({
            "id": i,
            "name": name,
            "district": district,
            "state": state,
            "total_beds": total_beds,
            "num_doctors": num_doctors,
            "type": center_type
        })
    return centers

def get_season_weather_temp_rain(curr_date):
    month = curr_date.month
    
    # Simple seasons: Summer (Mar-May), Monsoon (Jun-Sep), Winter (Nov-Jan), Spring/Autumn (Feb, Oct)
    if month in [6, 7, 8, 9]:
        season = "Monsoon"
        weather = random.choices(["Rainy", "Humid", "Cloudy"], weights=[0.7, 0.2, 0.1])[0]
        # Rainfall follows a bell curve centered in July-August
        rain_prob = 0.8
        rainfall = round(random.uniform(10, 120) * (1.2 if month in [7, 8] else 0.8), 1) if random.random() < rain_prob else 0.0
        temp = round(random.uniform(24.0, 32.0), 1)
    elif month in [11, 12, 1]:
        season = "Winter"
        weather = random.choices(["Cold", "Foggy", "Sunny"], weights=[0.6, 0.3, 0.1])[0]
        rainfall = round(random.uniform(0, 10), 1) if random.random() < 0.1 else 0.0
        temp = round(random.uniform(8.0, 18.0) - (2.0 if month == 12 else 0.0), 1)
    elif month in [3, 4, 5]:
        season = "Summer"
        weather = random.choices(["Sunny", "Hot", "Humid"], weights=[0.7, 0.2, 0.1])[0]
        rainfall = round(random.uniform(0, 5), 1) if random.random() < 0.05 else 0.0
        temp = round(random.uniform(32.0, 43.0), 1)
    else: # Spring / Autumn (Feb, Oct)
        season = "Spring" if month == 2 else "Autumn"
        weather = random.choices(["Sunny", "Windy", "Pleasant"], weights=[0.6, 0.2, 0.2])[0]
        rainfall = round(random.uniform(0, 15), 1) if random.random() < 0.15 else 0.0
        temp = round(random.uniform(20.0, 28.0), 1)
        
    # Festival/Holiday check (approximate holiday list + weekends)
    is_holiday = 0
    # Common national/major holiday dates
    holidays = [
        (1, 1),   # New Year
        (1, 26),  # Republic Day
        (8, 15),  # Independence Day
        (10, 2),  # Gandhi Jayanti
        (12, 25), # Christmas
    ]
    if (curr_date.month, curr_date.day) in holidays or curr_date.weekday() in [5, 6]:
        is_holiday = 1
        
    return season, weather, temp, rainfall, is_holiday

def generate_dataset(num_centers=100, years=3):
    print("Generating synthetic healthcare dataset...")
    centers = generate_health_centers(num_centers)
    
    start_date = date.today() - timedelta(days=years * 365)
    end_date = date.today() - timedelta(days=1)
    delta_days = (end_date - start_date).days + 1
    
    # Track medicine stocks and bed occupancy statefully per health center
    # center_med_stocks[center_id][medicine_name] = current_stock
    center_med_stocks = {}
    for c in centers:
        center_med_stocks[c["id"]] = {}
        for disease, (med_name, _, _) in DISEASE_MEDICINE_MAP.items():
            # initialize stocks randomly near max (e.g., 200 to 500)
            center_med_stocks[c["id"]][med_name] = random.randint(150, 400)
            
    records = []
    
    # To speed up generation, let's pre-calculate weather variables for each date
    date_vars = {}
    curr = start_date
    for _ in range(delta_days):
        date_vars[curr] = get_season_weather_temp_rain(curr)
        curr += timedelta(days=1)
        
    for idx_day in range(delta_days):
        curr_date = start_date + timedelta(days=idx_day)
        date_str = curr_date.strftime("%Y-%m-%d")
        season, weather, temp, rainfall, is_holiday = date_vars[curr_date]
        
        if idx_day % 100 == 0:
            print(f"Processing day {idx_day}/{delta_days} ({date_str})...")
            
        for c in centers:
            hc_id = c["id"]
            hc_name = c["name"]
            district = c["district"]
            state = c["state"]
            total_beds = c["total_beds"]
            num_docs = c["num_doctors"]
            
            # Doctor attendance
            doc_attendance_rate = random.uniform(0.8, 0.98) - (0.1 if is_holiday else 0.0)
            doc_attendance = max(1, round(num_docs * doc_attendance_rate))
            
            # Test availability (mostly fully available, but occasionally some tests run out)
            available_tests = ["Blood Test (CBC)", "Blood Sugar Test", "Urine Test", "Blood Pressure Check"]
            if season == "Monsoon" and random.random() > 0.1:
                available_tests.extend(["Dengue NS1", "Malaria Antigen"])
            if total_beds > 50:
                available_tests.extend(["X-Ray", "ECG", "HbA1c Test"])
            tests_avail_str = ", ".join(available_tests)
            
            # Total daily patient count (footfall) across the health center
            # Base patient count depending on health center size
            base_patients = random.randint(10, 25) if total_beds < 50 else random.randint(30, 70)
            
            # Seasonal patient load adjustments
            multiplier = 1.0
            if season == "Monsoon":
                multiplier += (rainfall / 100.0) + 0.2
            elif season == "Winter":
                multiplier += 0.3
            elif is_holiday:
                multiplier -= 0.2 # fewer regular patients on holidays
                
            total_daily_patients = max(5, int(base_patients * multiplier + random.randint(-5, 5)))
            
            # Generate patient cases for each disease
            # We distribute total_daily_patients among the 10 diseases based on seasonal weights
            disease_weights = []
            for d in DISEASES:
                w = 1.0 # default weight
                if d == "Dengue" or d == "Malaria" or d == "Fever":
                    if season == "Monsoon":
                        # increase weights based on rainfall
                        w += 3.0 + (rainfall / 20.0)
                elif d in ["Respiratory Issues", "Cold/Cough", "Fever"]:
                    if season == "Winter":
                        # colder means more colds/coughs
                        w += 4.0 + (22.0 - temp) / 3.0
                elif d == "Stomach Issues":
                    if season == "Summer":
                        w += 2.0 + (temp - 30) / 5.0
                    elif season == "Monsoon":
                        w += 1.5
                elif d in ["Diabetes", "Hypertension"]:
                    w = 0.5 # relatively stable, slightly lower weight than seasonal acute illnesses
                disease_weights.append(max(0.1, w))
                
            # Normalize weights
            sum_w = sum(disease_weights)
            disease_probs = [w / sum_w for w in disease_weights]
            
            # Distribute patients among diseases
            disease_counts = np.random.multinomial(total_daily_patients, disease_probs)
            
            # Track bed occupancy on this day
            admitted_patients = 0
            for d_idx, d in enumerate(DISEASES):
                cnt = disease_counts[d_idx]
                if cnt > 0:
                    if d in ["Dengue", "Malaria", "Respiratory Issues", "Stomach Issues"]:
                        admitted_patients += np.random.binomial(cnt, 0.4)
                    else:
                        admitted_patients += np.random.binomial(cnt, 0.1)
            
            # Model beds occupancy statefully (slightly correlated day-to-day)
            occupied_beds = min(total_beds, max(0, admitted_patients + int(total_beds * random.uniform(0.1, 0.3))))
            available_beds = total_beds - occupied_beds
            
            # Record rows for active diseases
            for d_idx, disease_name in enumerate(DISEASES):
                num_p = disease_counts[d_idx]
                if num_p <= 0:
                    continue # only record rows with active patients
                    
                # Age Group Distribution
                if disease_name in ["Diabetes", "Hypertension", "Joint Pain"]:
                    age_weights = [0.05, 0.2, 0.35, 0.4]
                elif disease_name in ["Cold/Cough", "Fever", "Respiratory Issues"]:
                    age_weights = [0.4, 0.3, 0.15, 0.15]
                else:
                    age_weights = [0.2, 0.4, 0.2, 0.2]
                
                age_counts = np.random.multinomial(num_p, age_weights)
                age_dist = {
                    "0-18": int(age_counts[0]),
                    "19-45": int(age_counts[1]),
                    "46-60": int(age_counts[2]),
                    "60+": int(age_counts[3])
                }
                
                # Gender Distribution
                gender_counts = np.random.multinomial(num_p, [0.48, 0.48, 0.04])
                gender_dist = {
                    "Male": int(gender_counts[0]),
                    "Female": int(gender_counts[1]),
                    "Other": int(gender_counts[2])
                }
                
                # Medicine Details
                med_name, med_cat, unit_rate = DISEASE_MEDICINE_MAP[disease_name]
                med_consumption = num_p * unit_rate
                
                # Retrieve current stock
                current_stock = center_med_stocks[hc_id][med_name]
                
                # Consume medicine
                consumed = min(current_stock, med_consumption)
                current_stock -= consumed
                
                # Check for reorder
                new_stock_added = 0
                max_stock = 500 if total_beds > 50 else 200
                if current_stock < 0.2 * max_stock:
                    new_stock_added = max_stock - current_stock
                    current_stock += new_stock_added
                    
                # Save updated stock back
                center_med_stocks[hc_id][med_name] = current_stock
                
                records.append({
                    "Date": date_str,
                    "Health_Center_ID": hc_id,
                    "Health_Center_Name": hc_name,
                    "District": district,
                    "State": state,
                    "Disease_Name": disease_name,
                    "Number_of_Patients": num_p,
                    "Age_Group_Distribution": json.dumps(age_dist),
                    "Gender_Distribution": json.dumps(gender_dist),
                    "Medicine_Name": med_name,
                    "Medicine_Consumption": consumed,
                    "Current_Medicine_Stock": current_stock,
                    "New_Medicine_Stock_Added": new_stock_added,
                    "Total_Beds": total_beds,
                    "Occupied_Beds": occupied_beds,
                    "Available_Beds": available_beds,
                    "Doctor_Attendance": doc_attendance,
                    "Test_Availability": tests_avail_str,
                    "Weather": weather,
                    "Temperature": temp,
                    "Rainfall": rainfall,
                    "Season": season,
                    "Festival_Holiday": is_holiday
                })
                
    df = pd.DataFrame(records)
    print(f"Generated {len(df)} records.")
    return df

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    df = generate_dataset(num_centers=100, years=3)
    df.to_csv("data/synthetic_healthcare_data.csv", index=False)
    print("Dataset saved to data/synthetic_healthcare_data.csv successfully!")
