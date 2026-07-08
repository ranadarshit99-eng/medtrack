"""
Pydantic models shared across the MedTrack API.

These mirror the shape of data the frontend consumes, but are the single
source of truth on the server (the original single-file HTML prototype kept
all of this as ad-hoc JS objects with no validation at all).
"""
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


class ScheduleSlot(BaseModel):
    day: Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    time: str = Field(min_length=1, max_length=40)


class Doctor(BaseModel):
    id: int
    name: str = Field(min_length=1, max_length=120)
    spec: str = Field(min_length=1, max_length=80)
    schedule: list[ScheduleSlot] = Field(default_factory=list)


class Medicine(BaseModel):
    id: int
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=60)
    stock: int = Field(ge=0)
    max_stock: int = Field(ge=1)

    @field_validator("stock")
    @classmethod
    def stock_not_absurd(cls, v: int) -> int:
        if v > 100_000:
            raise ValueError("stock value is unreasonably large")
        return v

    @property
    def status(self) -> Literal["low", "mid", "high"]:
        pct = self.stock / self.max_stock if self.max_stock else 0
        if pct < 0.15:
            return "low"
        if pct < 0.4:
            return "mid"
        return "high"


class Beds(BaseModel):
    total: int = Field(ge=1)
    occupied: int = Field(ge=0)

    @field_validator("occupied")
    @classmethod
    def occupied_cannot_exceed_total(cls, v, info):
        total = info.data.get("total")
        if total is not None and v > total:
            raise ValueError("occupied beds cannot exceed total beds")
        return v


class BedDetail(BaseModel):
    id: str
    number: str
    sector: Literal["ICU", "General", "Operation"]
    status: Literal["available", "occupied"]
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[Literal["Male", "Female", "Other"]] = None
    patient_disease: Optional[str] = None
    allocated_at: Optional[str] = None


class BedAllocateRequest(BaseModel):
    patient_name: str = Field(min_length=1, max_length=120)
    patient_age: int = Field(ge=0, le=130)
    patient_gender: Literal["Male", "Female", "Other"]
    patient_disease: str = Field(min_length=1, max_length=120)


class PatientPeriod(BaseModel):
    label: str
    total: int
    diseases: dict[str, int]


class HealthCenter(BaseModel):
    id: int
    name: str
    location: str
    beds: Beds
    beds_list: list[BedDetail] = Field(default_factory=list)
    medicines: list[Medicine]
    tests: list[str]
    doctors: list[Doctor]
    registered: bool
    patient_monthly: list[PatientPeriod]
    patient_daily: list[PatientPeriod]
    patient_yearly: list[PatientPeriod]


class Notification(BaseModel):
    id: int
    type: Literal["request", "alert"]
    message: str
    from_name: str = Field(alias="from")
    date: str
    read: bool
    hc_id: int

    class Config:
        populate_by_name = True


# ---------- request payloads ----------

class LoginRequest(BaseModel):
    role: Literal["admin", "user"]


class MedicineCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=60)
    stock: int = Field(ge=0)
    max_stock: int = Field(ge=1)


class MedicineUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    category: Optional[str] = Field(default=None, min_length=1, max_length=60)
    stock: Optional[int] = Field(default=None, ge=0)
    max_stock: Optional[int] = Field(default=None, ge=1)


class MedicineStockDelta(BaseModel):
    delta: int


class BedsUpdate(BaseModel):
    total: Optional[int] = Field(default=None, ge=1, le=2000)
    occupied: Optional[int] = Field(default=None, ge=0)


class TestCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class DoctorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    spec: str = Field(min_length=1, max_length=80)


class ScheduleCreate(BaseModel):
    day: Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    time: str = Field(min_length=1, max_length=40)


class PatientEntryCreate(BaseModel):
    disease: str = Field(min_length=1, max_length=60)
    count: int = Field(ge=1, le=10_000)


class AIRecommendation(BaseModel):
    type: str
    priority: str
    action: str
    rationale: str


class AIAlert(BaseModel):
    hc_id: int
    hc_name: str
    type: str
    title: str
    message: str
    code: str

