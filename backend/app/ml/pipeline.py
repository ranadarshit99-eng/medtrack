import os
import pandas as pd
import numpy as np
import joblib
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OrdinalEncoder
from sklearn.metrics import mean_absolute_error
from sklearn.ensemble import RandomForestRegressor
try:
    import xgboost as xgb
except ImportError:
    xgb = None

try:
    import lightgbm as lgb
except ImportError:
    lgb = None
import warnings
import json

warnings.filterwarnings("ignore")

# Directory for saved models
MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
os.makedirs(MODEL_DIR, exist_ok=True)

class HealthcareMLPipeline:
    def __init__(self, data_path="data/synthetic_healthcare_data.csv"):
        self.data_path = data_path
        self.df = None
        self.metadata = {}

    def load_data(self):
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Data file not found at {self.data_path}. Please run data_generator.py first.")
        self.df = pd.read_csv(self.data_path)
        self.df["Date"] = pd.to_datetime(self.df["Date"])
        # Downsample to speed up training while keeping all health centers and full 3-year span
        self.df = self.df[self.df["Date"].dt.day % 4 == 0].reset_index(drop=True)
        print(f"Loaded {len(self.df)} records (downsampled) from {self.data_path}")

    def prepare_base_features(self, df):
        # Extract date features
        df["month"] = df["Date"].dt.month
        df["day_of_week"] = df["Date"].dt.dayofweek
        df["day_of_year"] = df["Date"].dt.dayofyear
        df["year"] = df["Date"].dt.year
        df["is_weekend"] = df["day_of_week"].apply(lambda x: 1 if x in [5, 6] else 0)
        return df

    def train_validate_select(self, df, feature_cols, target_col, categorical_cols, task_name):
        print(f"\n--- Training Models for Task: {task_name} ---")
        
        # Sort chronologically for split
        df = df.sort_values("Date").reset_index(drop=True)
        
        # Encoding categorical columns
        encoders = {}
        df_encoded = df.copy()
        
        for col in categorical_cols:
            encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
            df_encoded[[col]] = encoder.fit_transform(df_encoded[[col]].astype(str))
            encoders[col] = encoder
            
        # Chronological split: last 30 days for validation
        max_date = df_encoded["Date"].max()
        split_date = max_date - pd.Timedelta(days=30)
        
        train_idx = df_encoded["Date"] <= split_date
        val_idx = df_encoded["Date"] > split_date
        
        train_data = df_encoded[train_idx]
        val_data = df_encoded[val_idx]
        
        X_train, y_train = train_data[feature_cols], train_data[target_col]
        X_val, y_val = val_data[feature_cols], val_data[target_col]
        
        print(f"Train size: {len(X_train)}, Validation size: {len(X_val)}")
        
        # 1. Random Forest
        print("Training Random Forest...")
        rf = RandomForestRegressor(n_estimators=50, max_depth=10, random_state=42, n_jobs=-1)
        rf.fit(X_train, y_train)
        rf_preds = rf.predict(X_val)
        rf_mae = mean_absolute_error(y_val, rf_preds)
        print(f"Random Forest MAE: {rf_mae:.4f}")
        
        models = {}
        
        # 1. Random Forest
        print("Training Random Forest...")
        rf = RandomForestRegressor(n_estimators=50, max_depth=10, random_state=42, n_jobs=-1)
        rf.fit(X_train, y_train)
        rf_preds = rf.predict(X_val)
        rf_mae = mean_absolute_error(y_val, rf_preds)
        print(f"Random Forest MAE: {rf_mae:.4f}")
        models["Random Forest"] = (rf, rf_mae)
        
        # 2. XGBoost
        if xgb is not None:
            try:
                print("Training XGBoost...")
                xg_reg = xgb.XGBRegressor(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1)
                xg_reg.fit(X_train, y_train)
                xgb_preds = xg_reg.predict(X_val)
                xgb_mae = mean_absolute_error(y_val, xgb_preds)
                print(f"XGBoost MAE: {xgb_mae:.4f}")
                models["XGBoost"] = (xg_reg, xgb_mae)
            except Exception as e:
                print(f"Error training XGBoost: {e}")
        else:
            print("XGBoost is not installed/loaded. Skipping...")
            
        # 3. LightGBM
        if lgb is not None:
            try:
                print("Training LightGBM...")
                lgb_reg = lgb.LGBMRegressor(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, verbosity=-1, n_jobs=-1)
                lgb_reg.fit(X_train, y_train)
                lgb_preds = lgb_reg.predict(X_val)
                lgb_mae = mean_absolute_error(y_val, lgb_preds)
                print(f"LightGBM MAE: {lgb_mae:.4f}")
                models["LightGBM"] = (lgb_reg, lgb_mae)
            except Exception as e:
                print(f"Error training LightGBM: {e}")
        else:
            print("LightGBM is not installed/loaded. Skipping...")
        
        best_name, (best_model, best_mae) = min(models.items(), key=lambda x: x[1][1])
        print(f"==> Best Model for {task_name}: {best_name} with MAE: {best_mae:.4f}")
        
        # Save model, encoders, feature columns
        model_path = os.path.join(MODEL_DIR, f"{task_name}_model.joblib")
        encoders_path = os.path.join(MODEL_DIR, f"{task_name}_encoders.joblib")
        
        joblib.dump(best_model, model_path)
        joblib.dump(encoders, encoders_path)
        
        # Save feature list
        with open(os.path.join(MODEL_DIR, f"{task_name}_features.json"), "w") as f:
            json.dump(feature_cols, f)
            
        self.metadata[task_name] = {
            "best_model": best_name,
            "mae": float(best_mae),
            "feature_columns": feature_cols,
            "categorical_columns": categorical_cols,
            "last_updated": datetime.now().isoformat()
        }

    def run_pipeline(self):
        self.load_data()
        df = self.prepare_base_features(self.df)
        
        # --- TASK 1: Disease Trend Prediction ---
        # Predict: Number_of_Patients
        # Calculate historical baselines for each health center and disease per month
        # Split data to calculate baselines only on the training set to prevent leakage
        max_date = df["Date"].max()
        split_date = max_date - pd.Timedelta(days=30)
        train_df = df[df["Date"] <= split_date]
        
        # Baseline 1: disease monthly average per center
        disease_base = train_df.groupby(["Health_Center_ID", "Disease_Name", "month"])["Number_of_Patients"].mean().reset_index()
        disease_base.rename(columns={"Number_of_Patients": "hist_disease_p_avg"}, inplace=True)
        # Save baseline to joblib for inference
        joblib.dump(disease_base, os.path.join(MODEL_DIR, "disease_baselines.joblib"))
        
        # Merge baseline back
        df_disease = pd.merge(df, disease_base, on=["Health_Center_ID", "Disease_Name", "month"], how="left")
        df_disease["hist_disease_p_avg"] = df_disease["hist_disease_p_avg"].fillna(df_disease["Number_of_Patients"].mean())
        
        disease_feats = [
            "Health_Center_ID", "Disease_Name", "month", "day_of_week", "day_of_year",
            "is_weekend", "Temperature", "Rainfall", "Festival_Holiday", "hist_disease_p_avg"
        ]
        self.train_validate_select(
            df_disease,
            feature_cols=disease_feats,
            target_col="Number_of_Patients",
            categorical_cols=["Disease_Name", "Health_Center_ID"],
            task_name="disease_trend"
        )
        
        # --- TASK 2: Patient Footfall Prediction ---
        # Aggregate to Center-Date level
        footfall_df = df.groupby([
            "Date", "Health_Center_ID", "District", "State", "Total_Beds",
            "Weather", "Temperature", "Rainfall", "Season", "Festival_Holiday",
            "month", "day_of_week", "day_of_year", "is_weekend"
        ])["Number_of_Patients"].sum().reset_index()
        footfall_df.rename(columns={"Number_of_Patients": "Total_Patients"}, inplace=True)
        
        # Calculate historical baselines on training set
        train_ff = footfall_df[footfall_df["Date"] <= split_date]
        ff_base = train_ff.groupby(["Health_Center_ID", "month"])["Total_Patients"].mean().reset_index()
        ff_base.rename(columns={"Total_Patients": "hist_patients_avg"}, inplace=True)
        joblib.dump(ff_base, os.path.join(MODEL_DIR, "footfall_baselines.joblib"))
        
        footfall_df = pd.merge(footfall_df, ff_base, on=["Health_Center_ID", "month"], how="left")
        footfall_df["hist_patients_avg"] = footfall_df["hist_patients_avg"].fillna(footfall_df["Total_Patients"].mean())
        
        footfall_feats = [
            "Health_Center_ID", "Total_Beds", "month", "day_of_week", "day_of_year",
            "is_weekend", "Temperature", "Rainfall", "Festival_Holiday", "hist_patients_avg"
        ]
        self.train_validate_select(
            footfall_df,
            feature_cols=footfall_feats,
            target_col="Total_Patients",
            categorical_cols=["Health_Center_ID"],
            task_name="patient_footfall"
        )
        
        # --- TASK 3: Medicine Demand Prediction ---
        # Predict: Medicine_Consumption
        train_med = df[df["Date"] <= split_date]
        med_base = train_med.groupby(["Health_Center_ID", "Medicine_Name", "month"])["Medicine_Consumption"].mean().reset_index()
        med_base.rename(columns={"Medicine_Consumption": "hist_med_avg"}, inplace=True)
        joblib.dump(med_base, os.path.join(MODEL_DIR, "medicine_baselines.joblib"))
        
        df_med = pd.merge(df, med_base, on=["Health_Center_ID", "Medicine_Name", "month"], how="left")
        df_med["hist_med_avg"] = df_med["hist_med_avg"].fillna(df_med["Medicine_Consumption"].mean())
        
        med_feats = [
            "Health_Center_ID", "Medicine_Name", "month", "day_of_week", "day_of_year",
            "is_weekend", "Temperature", "Rainfall", "Festival_Holiday", "hist_med_avg"
        ]
        self.train_validate_select(
            df_med,
            feature_cols=med_feats,
            target_col="Medicine_Consumption",
            categorical_cols=["Medicine_Name", "Health_Center_ID"],
            task_name="medicine_demand"
        )
        
        # --- TASK 4: Bed Occupancy Prediction ---
        # Aggregate to Center-Date level for Beds
        beds_df = df.groupby([
            "Date", "Health_Center_ID", "Total_Beds", "month", "day_of_week", "day_of_year",
            "is_weekend", "Temperature", "Rainfall", "Festival_Holiday"
        ])["Occupied_Beds"].first().reset_index() # Bed occupancy is same across rows on same date/center
        
        train_beds = beds_df[beds_df["Date"] <= split_date]
        beds_base = train_beds.groupby(["Health_Center_ID", "month"])["Occupied_Beds"].mean().reset_index()
        beds_base.rename(columns={"Occupied_Beds": "hist_beds_avg"}, inplace=True)
        joblib.dump(beds_base, os.path.join(MODEL_DIR, "beds_baselines.joblib"))
        
        beds_df = pd.merge(beds_df, beds_base, on=["Health_Center_ID", "month"], how="left")
        beds_df["hist_beds_avg"] = beds_df["hist_beds_avg"].fillna(beds_df["Occupied_Beds"].mean())
        
        beds_feats = [
            "Health_Center_ID", "Total_Beds", "month", "day_of_week", "day_of_year",
            "is_weekend", "Temperature", "Rainfall", "Festival_Holiday", "hist_beds_avg"
        ]
        self.train_validate_select(
            beds_df,
            feature_cols=beds_feats,
            target_col="Occupied_Beds",
            categorical_cols=["Health_Center_ID"],
            task_name="bed_occupancy"
        )
        
        # Save training metadata
        with open(os.path.join(MODEL_DIR, "pipeline_metadata.json"), "w") as f:
            json.dump(self.metadata, f, indent=4)
        print("\nPipeline execution complete! All models saved.")

if __name__ == "__main__":
    pipeline = HealthcareMLPipeline()
    pipeline.run_pipeline()
