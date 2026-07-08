import os
import pandas as pd

CSV_PATH = "data/synthetic_healthcare_data.csv"
MODEL_DIR = "app/ml/saved_models"

print("Reading CSV (this might take a few seconds due to 279MB size)...")
df = pd.read_csv(CSV_PATH)
print("Parsing Date...")
df["Date"] = pd.to_datetime(df["Date"])
df["month"] = df["Date"].dt.month

print("Generating disease baselines...")
disease_base = df.groupby(["Health_Center_ID", "Disease_Name", "month"])["Number_of_Patients"].mean().reset_index()
disease_base.rename(columns={"Number_of_Patients": "hist_disease_p_avg"}, inplace=True)
disease_base.to_csv(os.path.join(MODEL_DIR, "disease_baselines.csv"), index=False)

print("Generating footfall baselines...")
footfall_df = df.groupby([
    "Date", "Health_Center_ID", "month"
])["Number_of_Patients"].sum().reset_index()
footfall_df.rename(columns={"Number_of_Patients": "Total_Patients"}, inplace=True)
ff_base = footfall_df.groupby(["Health_Center_ID", "month"])["Total_Patients"].mean().reset_index()
ff_base.rename(columns={"Total_Patients": "hist_patients_avg"}, inplace=True)
ff_base.to_csv(os.path.join(MODEL_DIR, "footfall_baselines.csv"), index=False)

print("Generating medicine baselines...")
med_base = df.groupby(["Health_Center_ID", "Medicine_Name", "month"])["Medicine_Consumption"].mean().reset_index()
med_base.rename(columns={"Medicine_Consumption": "hist_med_avg"}, inplace=True)
med_base.to_csv(os.path.join(MODEL_DIR, "medicine_baselines.csv"), index=False)

print("Generating bed baselines...")
beds_df = df.groupby([
    "Date", "Health_Center_ID", "month"
])["Occupied_Beds"].first().reset_index()
beds_base = beds_df.groupby(["Health_Center_ID", "month"])["Occupied_Beds"].mean().reset_index()
beds_base.rename(columns={"Occupied_Beds": "hist_beds_avg"}, inplace=True)
beds_base.to_csv(os.path.join(MODEL_DIR, "beds_baselines.csv"), index=False)

print("Baselines CSV generation complete!")
