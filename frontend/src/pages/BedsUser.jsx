import { useState, useEffect } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { occupancyColorHex } from '../utils';
import { chartColors, donutOptions } from '../charts/setup';
import { IconButton } from '../components/UI';

function BedIcon({ status, gender }) {
  let sheetColor = '#10b981'; // Green (Vacant)
  let blanketColor = '#059669';
  let frameColor = '#475569'; // Slate frame

  if (status === 'occupied') {
    if (gender === 'Male') {
      sheetColor = '#60a5fa'; // Blue (Male)
      blanketColor = '#2563eb';
    } else if (gender === 'Female') {
      sheetColor = '#f472b6'; // Pink (Female)
      blanketColor = '#db2777';
    } else {
      sheetColor = '#c084fc'; // Purple (Other)
      blanketColor = '#7c3aed';
    }
  }

  return (
    <svg
      className="w-12 h-12 transition-transform duration-200 group-hover:scale-105"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Bed legs shadows */}
      <rect x="14" y="6" width="6" height="4" rx="1" fill="#1e293b" opacity="0.3" />
      <rect x="44" y="6" width="6" height="4" rx="1" fill="#1e293b" opacity="0.3" />
      <rect x="14" y="54" width="6" height="4" rx="1" fill="#1e293b" opacity="0.3" />
      <rect x="44" y="54" width="6" height="4" rx="1" fill="#1e293b" opacity="0.3" />

      {/* Frame Headboard */}
      <rect x="12" y="8" width="40" height="6" rx="2" fill={frameColor} />

      {/* Mattress / Sheet */}
      <rect x="14" y="14" width="36" height="40" rx="3" fill={sheetColor} />

      {/* Pillow */}
      <rect x="20" y="17" width="24" height="9" rx="2.5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />

      {/* Blanket */}
      <path
        d="M 14 32 C 14 32 20 30 32 30 C 44 30 50 32 50 32 L 50 51 C 50 52.6 48.6 54 47 54 L 17 54 C 15.4 54 14 52.6 14 51 Z"
        fill={blanketColor}
      />

      {/* Blanket Fold Crease */}
      <path
        d="M 14 32 C 14 32 20 30 32 30 C 44 30 50 32 50 32 C 50 32 44 35 32 35 C 20 35 14 32 14 32 Z"
        fill="#ffffff"
        opacity="0.25"
      />

      {/* Footboard */}
      <rect x="16" y="53" width="32" height="3" rx="1" fill={frameColor} />
    </svg>
  );
}

function BookingModal({ bed, hcId, onClose, onSuccess }) {
  const { showToast } = useApp();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [disease, setDisease] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter patient name', 'error');
      return;
    }
    if (!age || age < 0 || age > 130) {
      showToast('Please enter a valid age', 'error');
      return;
    }
    if (!disease.trim()) {
      showToast('Please enter or select a disease', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.allocateBed(hcId, bed.id, {
        patient_name: name,
        patient_age: Number(age),
        patient_gender: gender,
        patient_disease: disease,
      });
      showToast(`Bed ${bed.number} booked successfully for ${name}`);
      onSuccess();
    } catch (err) {
      showToast(err.message || 'Failed to book bed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBed = async () => {
    setSubmitting(true);
    try {
      await api.deleteBed(hcId, bed.id);
      showToast(`Bed ${bed.number} deleted successfully`);
      onSuccess();
    } catch (err) {
      showToast(err.message || 'Failed to delete bed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const DISEASES = [
    'Fever',
    'Cold/Cough',
    'Diabetes',
    'Hypertension',
    'Stomach Issues',
    'Skin Problems',
    'Respiratory Issues',
    'Joint Pain',
    'Eye Problems',
    'Other',
  ];

  return (
    <div className="animate-fadeUp text-left">
      <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
        <h3 className="text-base font-bold font-display text-text-primary">
          Book Bed {bed.number} ({bed.sector})
        </h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <i className="fas fa-times text-lg" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Patient Name</label>
          <input
            type="text"
            className="form-input"
            placeholder="Enter full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Age</label>
            <input
              type="number"
              className="form-input"
              placeholder="e.g. 35"
              min="0"
              max="130"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div>
            <label className="form-label">Gender</label>
            <select
              className="form-select"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              disabled={submitting}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="form-label">Disease / Diagnosis</label>
          <div className="flex gap-2">
            <select
              className="form-select flex-1"
              value={DISEASES.includes(disease) ? disease : 'Other'}
              onChange={(e) => {
                if (e.target.value !== 'Other') {
                  setDisease(e.target.value);
                } else {
                  setDisease('');
                }
              }}
              disabled={submitting}
            >
              <option value="" disabled>Select pre-defined</option>
              {DISEASES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input
              type="text"
              className="form-input flex-1"
              placeholder="Type diagnosis..."
              value={disease}
              onChange={(e) => setDisease(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t border-border mt-6">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-semibold">Delete bed?</span>
              <button
                type="button"
                className="btn btn-danger py-1 px-2 text-xs"
                onClick={handleDeleteBed}
                disabled={submitting}
              >
                Yes
              </button>
              <button
                type="button"
                className="btn btn-secondary py-1 px-2 text-xs"
                onClick={() => setConfirmDelete(false)}
                disabled={submitting}
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-danger flex items-center gap-1.5"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting}
            >
              <i className="fas fa-trash-alt" /> Delete Bed
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary animate-none"
              disabled={submitting}
            >
              {submitting ? 'Booking...' : 'Book Bed'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function DischargeModal({ bed, hcId, onClose, onSuccess }) {
  const { showToast } = useApp();
  const [submitting, setSubmitting] = useState(false);

  const handleDischarge = async () => {
    setSubmitting(true);
    try {
      await api.releaseBed(hcId, bed.id);
      showToast(`Discharged ${bed.patient_name} from Bed ${bed.number}`);
      onSuccess();
    } catch (err) {
      showToast(err.message || 'Failed to discharge patient', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getGenderColorClass = (g) => {
    if (g === 'Male') return 'text-info bg-info/10 border-info/20';
    if (g === 'Female') return 'text-pink-500 bg-pink-500/10 border-pink-500/20';
    return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
  };

  return (
    <div className="animate-fadeUp text-left">
      <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
        <h3 className="text-base font-bold font-display text-text-primary">
          Bed {bed.number} Occupied Details
        </h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <i className="fas fa-times text-lg" />
        </button>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex justify-center py-4 bg-bg-secondary rounded-2xl border border-border">
          <BedIcon status={bed.status} gender={bed.patient_gender} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3.5 bg-bg-secondary rounded-xl border border-border">
            <span className="text-[10px] text-text-muted uppercase font-bold block mb-1">Patient Name</span>
            <span className="text-sm font-bold text-text-primary">{bed.patient_name}</span>
          </div>
          <div className="p-3.5 bg-bg-secondary rounded-xl border border-border">
            <span className="text-[10px] text-text-muted uppercase font-bold block mb-1">Gender / Age</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getGenderColorClass(bed.patient_gender)}`}>
              {bed.patient_gender} ({bed.patient_age} yrs)
            </span>
          </div>
          <div className="p-3.5 bg-bg-secondary rounded-xl border border-border">
            <span className="text-[10px] text-text-muted uppercase font-bold block mb-1">Diagnosis</span>
            <span className="text-sm font-bold text-text-primary">{bed.patient_disease}</span>
          </div>
          <div className="p-3.5 bg-bg-secondary rounded-xl border border-border">
            <span className="text-[10px] text-text-muted uppercase font-bold block mb-1">Admitted At</span>
            <span className="text-sm font-semibold text-text-secondary">{bed.allocated_at || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Close
        </button>
        <button
          type="button"
          className="btn btn-danger flex items-center gap-1.5"
          onClick={handleDischarge}
          disabled={submitting}
        >
          <i className="fas fa-sign-out-alt" />
          {submitting ? 'Discharging...' : 'Discharge Patient'}
        </button>
      </div>
    </div>
  );
}

export default function BedsUser({ hc, refetch }) {
  const { showToast, openModal, closeModal } = useApp();
  const free = hc.beds.total - hc.beds.occupied;
  const pct = hc.beds.total ? Math.round((hc.beds.occupied / hc.beds.total) * 100) : 0;
  const color = occupancyColorHex(pct);

  const [occInput, setOccInput] = useState(hc.beds.occupied);
  const [totalInput, setTotalInput] = useState(hc.beds.total);
  const [selectedSector, setSelectedSector] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setOccInput(hc.beds.occupied);
    setTotalInput(hc.beds.total);
  }, [hc.beds.occupied, hc.beds.total]);

  const [newBedSector, setNewBedSector] = useState('General');
  const [newBedNumber, setNewBedNumber] = useState('');
  const [submittingBed, setSubmittingBed] = useState(false);

  const handleAddBed = async (e) => {
    e.preventDefault();
    setSubmittingBed(true);
    try {
      await api.addBed(hc.id, {
        sector: newBedSector,
        number: newBedNumber.trim() || null,
      });
      showToast(`Successfully added a new ${newBedSector} Bed ${newBedNumber.trim() ? newBedNumber.trim() : ''}`);
      setNewBedNumber('');
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to add bed', 'error');
    } finally {
      setSubmittingBed(false);
    }
  };

  const patchBeds = async (payload) => {
    await api.updateBeds(hc.id, payload);
    refetch();
  };

  const incTotal = () => patchBeds({ total: hc.beds.total + 1 });
  const decTotal = () => patchBeds({ total: Math.max(1, hc.beds.total - 1) });
  const incOcc = () => {
    if (hc.beds.occupied < hc.beds.total) patchBeds({ occupied: hc.beds.occupied + 1 });
  };
  const decOcc = () => {
    if (hc.beds.occupied > 0) patchBeds({ occupied: hc.beds.occupied - 1 });
  };

  const setOcc = async () => {
    const val = Math.max(0, Math.min(Number(occInput) || 0, hc.beds.total));
    await patchBeds({ occupied: val });
    showToast('Bed status updated');
  };
  const setTotal = async () => {
    const val = Math.max(1, Number(totalInput) || 1);
    await patchBeds({ total: val });
    showToast('Bed count updated');
  };

  const handleBedClick = (bed) => {
    if (bed.status === 'available') {
      openModal(
        <BookingModal
          bed={bed}
          hcId={hc.id}
          onClose={closeModal}
          onSuccess={() => {
            closeModal();
            refetch();
          }}
        />
      );
    } else {
      openModal(
        <DischargeModal
          bed={bed}
          hcId={hc.id}
          onClose={closeModal}
          onSuccess={() => {
            closeModal();
            refetch();
          }}
        />
      );
    }
  };

  const sectors = ['All', 'ICU', 'General', 'Operation'];

  const filteredBeds = (hc.beds_list || []).filter((bed) => {
    const matchesSector = selectedSector === 'All' || bed.sector === selectedSector;
    const matchesSearch =
      !searchQuery ||
      bed.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bed.patient_name && bed.patient_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (bed.patient_disease && bed.patient_disease.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSector && matchesSearch;
  });

  return (
    <div className="animate-fadeUp space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-text-muted mb-1.5 font-semibold uppercase tracking-wide">Total Beds</p>
              <p className="text-[32px] font-bold text-info font-display">{hc.beds.total}</p>
            </div>
            <div className="flex flex-col gap-1">
              <IconButton icon="fa-plus" title="Increase total beds" onClick={incTotal} className="w-7 h-7" />
              <IconButton icon="fa-minus" title="Decrease total beds" onClick={decTotal} className="w-7 h-7" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-text-muted mb-1.5 font-semibold uppercase tracking-wide">Occupied</p>
              <p className="text-[32px] font-bold text-warning font-display">{hc.beds.occupied}</p>
            </div>
            <div className="flex flex-col gap-1">
              <IconButton icon="fa-plus" title="Increase occupied beds" onClick={incOcc} className="w-7 h-7" />
              <IconButton icon="fa-minus" title="Decrease occupied beds" onClick={decOcc} className="w-7 h-7" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-muted mb-1.5 font-semibold uppercase tracking-wide">Available</p>
          <p className="text-[32px] font-bold text-accent font-display">{free}</p>
        </div>
      </div>

      {/* Main Charts & Quick Update */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="data-card">
          <div className="data-card-header">
            <span className="font-bold text-[15px] font-display">Occupancy Chart</span>
          </div>
          <div className="p-6 flex justify-center h-[290px]">
            <div className="h-[240px] w-[240px]">
              <Doughnut
                data={{
                  labels: ['Occupied', 'Available'],
                  datasets: [
                    {
                      data: [hc.beds.occupied, free],
                      backgroundColor: [chartColors.warning, chartColors.accent],
                      borderWidth: 0,
                      hoverOffset: 6,
                    },
                  ],
                }}
                options={donutOptions('68%')}
              />
            </div>
          </div>
        </div>
        <div className="data-card">
          <div className="data-card-header">
            <span className="font-bold text-[15px] font-display">Quick Update</span>
          </div>
          <div className="p-6">
            <p className="text-[13px] text-text-secondary mb-4">
              Use the controls on the stat cards above or set exact values below.
            </p>
            <div className="mb-3.5">
              <label className="form-label">Set Occupied Beds</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="form-input flex-1"
                  min="0"
                  max={hc.beds.total}
                  value={occInput}
                  onChange={(e) => setOccInput(e.target.value)}
                />
                <button className="btn btn-primary animate-none" onClick={setOcc}>
                  Update
                </button>
              </div>
            </div>
            <div className="mb-3.5">
              <label className="form-label">Set Total Beds</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="form-input flex-1"
                  min="1"
                  max="2000"
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                />
                <button className="btn btn-primary animate-none" onClick={setTotal}>
                  Update
                </button>
              </div>
            </div>
            <div className="p-3 bg-bg-secondary rounded-xl mt-2">
              <div className="flex justify-between text-[13px] mb-2">
                <span className="text-text-secondary">Occupancy Rate</span>
                <span className="font-bold" style={{ color }}>
                  {pct}%
                </span>
              </div>
              <div className="stock-bar h-2.5">
                <div className="stock-bar-fill rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>

            <hr className="border-border my-4" />
            
            <form onSubmit={handleAddBed} className="space-y-3">
              <span className="font-bold text-[14px] font-display block">Add Specific Bed</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Type / Category</label>
                  <select
                    className="form-select w-full"
                    value={newBedSector}
                    onChange={(e) => setNewBedSector(e.target.value)}
                    disabled={submittingBed}
                  >
                    <option value="General">General</option>
                    <option value="ICU">ICU</option>
                    <option value="Operation">Operation</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Bed Number (Optional)</label>
                  <input
                    type="text"
                    className="form-input w-full"
                    placeholder="e.g. G10, ICU5"
                    value={newBedNumber}
                    onChange={(e) => setNewBedNumber(e.target.value)}
                    disabled={submittingBed}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-accent w-full animate-none flex items-center justify-center gap-1.5"
                disabled={submittingBed}
              >
                <i className="fas fa-plus" /> {submittingBed ? 'Adding...' : 'Add Bed'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bed Map / Allocation Grid */}
      <div className="data-card">
        <div className="data-card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="font-bold text-[15px] font-display block">Interactive Ward Map</span>
            <span className="text-xs text-text-muted">Click any bed to book a new patient or discharge an existing patient.</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search patient / bed..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input py-1.5 px-3 text-xs w-[180px] pl-7"
              />
              <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
            </div>

            {/* Sector Tabs */}
            <div className="flex bg-bg-secondary p-0.5 rounded-lg border border-border">
              {sectors.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSector(s)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    selectedSector === s ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-5 mb-5 pb-4 border-b border-border text-xs font-medium text-text-secondary">
            <span className="text-text-muted font-bold uppercase tracking-wider text-[10px]">LEGEND:</span>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#10b981] border border-[#059669] inline-block" />
              <span>Vacant Bed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#60a5fa] border border-[#2563eb] inline-block" />
              <span>Male Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#f472b6] border border-[#db2777] inline-block" />
              <span>Female Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#c084fc] border border-[#7c3aed] inline-block" />
              <span>Other Occupied</span>
            </div>
          </div>

          {filteredBeds.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <i className="fas fa-bed text-2xl mb-2 block text-text-muted/60" />
              No beds match your filter criteria.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {filteredBeds.map((bed) => {
                const isOccupied = bed.status === 'occupied';
                return (
                  <div
                    key={bed.id}
                    onClick={() => handleBedClick(bed)}
                    className="flex flex-col items-center justify-between p-3.5 bg-bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer text-center relative overflow-hidden group hover:border-accent"
                  >
                    {/* Bed Info Header */}
                    <div className="text-[10px] font-bold text-text-muted tracking-wider uppercase mb-1">
                      {bed.number}
                    </div>

                    {/* SVG Bed Design */}
                    <BedIcon status={bed.status} gender={bed.patient_gender} />

                    {/* Patient Name / Availability status */}
                    <div className="text-xs font-semibold mt-2.5 w-full truncate px-1">
                      {isOccupied ? (
                        <span className="text-text-primary font-bold block">{bed.patient_name}</span>
                      ) : (
                        <span className="text-[#10b981] font-medium block">Vacant</span>
                      )}
                    </div>

                    {/* Subtitle / Disease */}
                    {isOccupied && (
                      <div className="text-[9px] text-text-muted truncate w-full mt-0.5" title={bed.patient_disease}>
                        {bed.patient_disease}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
