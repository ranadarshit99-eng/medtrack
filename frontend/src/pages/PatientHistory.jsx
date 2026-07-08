import { useState, useMemo } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { useFetch } from '../hooks';
import { chartColors, donutOptions } from '../charts/setup';

export default function PatientHistory({ hc }) {
  const { role, openModal, closeModal, showToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [admittedFilter, setAdmittedFilter] = useState('All');
  const [hcFilter, setHcFilter] = useState('All');
  const [diseaseFilter, setDiseaseFilter] = useState('All');

  // Fetch all patient records
  // If user role, pass hc.id to filter. Admin gets all.
  const { data: recordsData, loading, refetch } = useFetch(
    () => api.listPatientHistory(role === 'user' ? hc.id : null),
    [hc?.id, role]
  );
  const records = recordsData || [];

  // Fetch registered health centers for filter and form (admin view)
  const { data: healthCentersData } = useFetch(
    () => api.listHealthCenters(true),
    []
  );
  const healthCenters = healthCentersData || [];

  // Predefined lists
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
    'Other'
  ];

  // Filter records locally for instant feedback
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // 1. Search Query
      const matchesSearch =
        !searchQuery ||
        r.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.disease.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.doctor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.medicines.some((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()));

      // 2. Admission Status
      const matchesAdmitted =
        admittedFilter === 'All' ||
        (admittedFilter === 'Admitted' && r.admitted) ||
        (admittedFilter === 'OPD' && !r.admitted);

      // 3. Health Center Filter (Admin only)
      const matchesHC =
        role === 'user' ||
        hcFilter === 'All' ||
        r.health_center_id === Number(hcFilter);

      // 4. Disease Filter
      const matchesDisease =
        diseaseFilter === 'All' ||
        r.disease.toLowerCase() === diseaseFilter.toLowerCase();

      return matchesSearch && matchesAdmitted && matchesHC && matchesDisease;
    });
  }, [records, searchQuery, admittedFilter, hcFilter, diseaseFilter, role]);

  // Aggregate Stats for Top Stats Section
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const admitted = filteredRecords.filter((r) => r.admitted).length;
    const opd = total - admitted;
    
    // Average stay calculation
    const stays = filteredRecords.filter((r) => r.admitted && r.admission_details?.stay_days);
    const avgStay = stays.length
      ? (stays.reduce((acc, curr) => acc + curr.admission_details.stay_days, 0) / stays.length).toFixed(1)
      : '0.0';

    return { total, admitted, opd, avgStay };
  }, [filteredRecords]);

  // Chart Data preparation
  const chartData = useMemo(() => {
    // 1. Admitted vs OPD
    const admittedCount = filteredRecords.filter((r) => r.admitted).length;
    const opdCount = filteredRecords.length - admittedCount;

    const donut = {
      labels: ['Admitted Stay', 'Outpatient (OPD)'],
      datasets: [
        {
          data: [admittedCount, opdCount],
          backgroundColor: [chartColors.info, chartColors.accent],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };

    // 2. Diseases breakdown (Top 5)
    const diseaseCounts = {};
    filteredRecords.forEach((r) => {
      diseaseCounts[r.disease] = (diseaseCounts[r.disease] || 0) + 1;
    });

    const sortedDiseases = Object.entries(diseaseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const bar = {
      labels: sortedDiseases.map(([name]) => name),
      datasets: [
        {
          label: 'Diagnoses Count',
          data: sortedDiseases.map(([, count]) => count),
          backgroundColor: chartColors.accent,
          borderRadius: 6,
          maxBarThickness: 32,
        },
      ],
    };

    return { donut, bar, hasData: filteredRecords.length > 0 };
  }, [filteredRecords]);

  const openViewDetailsModal = (record) => {
    openModal(<CaseDetailsModal record={record} onClose={closeModal} />);
  };

  const openAddRecordModal = () => {
    openModal(
      <AddRecordModal
        hc={hc}
        role={role}
        healthCenters={healthCenters}
        onClose={closeModal}
        onSuccess={() => {
          closeModal();
          refetch();
        }}
      />
    );
  };

  return (
    <div className="animate-fadeUp space-y-6">
      {/* Title & Register Button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-display text-text-primary">Patient History Records</h1>
          <p className="text-sm text-text-muted">
            {role === 'admin'
              ? 'District-wide repository of past patient admissions, diagnoses, and treatments.'
              : `Historical records for patients checked or admitted at ${hc?.name}.`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAddRecordModal}>
          <i className="fas fa-plus-circle" /> Register Past Record
        </button>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-glow bg-info" />
          <p className="text-xs text-text-muted mb-1 font-semibold uppercase tracking-wide">Total Records</p>
          <p className="text-[32px] font-bold text-info font-display">{stats.total}</p>
          <span className="text-[11px] text-text-secondary mt-1 block">Filtered Patient Cases</span>
        </div>
        <div className="stat-card">
          <div className="stat-glow bg-warning" />
          <p className="text-xs text-text-muted mb-1 font-semibold uppercase tracking-wide">Hospitalizations</p>
          <p className="text-[32px] font-bold text-warning font-display">{stats.admitted}</p>
          <span className="text-[11px] text-text-secondary mt-1 block">
            {stats.total ? Math.round((stats.admitted / stats.total) * 100) : 0}% Admission Rate
          </span>
        </div>
        <div className="stat-card">
          <div className="stat-glow bg-accent" />
          <p className="text-xs text-text-muted mb-1 font-semibold uppercase tracking-wide font-display">Outpatients (OPD)</p>
          <p className="text-[32px] font-bold text-accent font-display">{stats.opd}</p>
          <span className="text-[11px] text-text-secondary mt-1 block">Checkups & consultations</span>
        </div>
        <div className="stat-card">
          <div className="stat-glow bg-danger" />
          <p className="text-xs text-text-muted mb-1 font-semibold uppercase tracking-wide">Avg Stay Duration</p>
          <p className="text-[32px] font-bold text-danger font-display">{stats.avgStay} <span className="text-sm font-medium text-text-muted">days</span></p>
          <span className="text-[11px] text-text-secondary mt-1 block">Average bed usage period</span>
        </div>
      </div>

      {/* Charts section (hidden if no data) */}
      {chartData.hasData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="data-card">
            <div className="data-card-header">
              <span className="font-bold text-[15px] font-display">Admission Breakdown</span>
            </div>
            <div className="p-5 flex justify-center h-[260px]">
              <div className="h-[210px] w-[210px]">
                <Doughnut data={chartData.donut} options={donutOptions('70%')} />
              </div>
            </div>
          </div>
          <div className="data-card">
            <div className="data-card-header">
              <span className="font-bold text-[15px] font-display">Top 5 Diagnoses (Past Records)</span>
            </div>
            <div className="p-5 h-[260px]">
              <Bar
                data={chartData.bar}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 } } },
                    y: { grid: { color: chartColors.grid }, ticks: { font: { family: 'DM Sans', size: 11 }, stepSize: 1 } },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="bg-bg-primary border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by Patient Name, ID, Disease, Doctor or Medicine..."
              className="form-input pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-[14px]" />
          </div>

          {/* Admitted Status Filter */}
          <div className="w-full md:w-[200px]">
            <select
              className="form-select"
              value={admittedFilter}
              onChange={(e) => setAdmittedFilter(e.target.value)}
            >
              <option value="All">All Visit Types</option>
              <option value="Admitted">Admitted (Inpatient)</option>
              <option value="OPD">OPD (Outpatient)</option>
            </select>
          </div>

          {/* Disease Filter */}
          <div className="w-full md:w-[200px]">
            <select
              className="form-select"
              value={diseaseFilter}
              onChange={(e) => setDiseaseFilter(e.target.value)}
            >
              <option value="All">All Diseases</option>
              {DISEASES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Health Center Filter (Admin only) */}
          {role === 'admin' && (
            <div className="w-full md:w-[220px]">
              <select
                className="form-select"
                value={hcFilter}
                onChange={(e) => setHcFilter(e.target.value)}
              >
                <option value="All">All Health Centers</option>
                {healthCenters.map((center) => (
                  <option key={center.id} value={center.id}>{center.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Patient Table */}
      <div className="data-card">
        <div className="data-card-header">
          <span className="font-bold text-[15px] font-display">Patient Records Log</span>
          <span className="text-xs text-text-muted">Showing {filteredRecords.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-text-muted">
              <i className="fas fa-spinner fa-spin text-2xl mb-2 block" />
              Loading patient history log...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <i className="fas fa-clipboard-question text-3xl mb-3 text-text-muted/60 block" />
              No historical patient records found matching the criteria.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Record ID</th>
                  <th>Patient Name</th>
                  <th>Visit Date</th>
                  <th>Diagnosis / Disease</th>
                  {role === 'admin' && <th>Health Center</th>}
                  <th>Type</th>
                  <th>Checked By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-bg-secondary/40 transition-colors">
                    <td className="font-semibold text-text-primary text-[13px]">{r.id}</td>
                    <td>
                      <div className="font-medium text-text-primary">{r.patient_name}</div>
                      <div className="text-xs text-text-muted">{r.patient_gender}, {r.patient_age} yrs</div>
                    </td>
                    <td>
                      <div className="font-medium text-[13px]">{r.visit_date}</div>
                    </td>
                    <td>
                      <span className="badge bg-bg-secondary text-text-primary border border-border">
                        {r.disease}
                      </span>
                    </td>
                    {role === 'admin' && (
                      <td className="text-xs font-semibold text-text-secondary">
                        {r.health_center_name}
                      </td>
                    )}
                    <td>
                      {r.admitted ? (
                        <span className="badge bg-info/10 text-info border border-info/20">
                          Admitted ({r.admission_details?.stay_days} days)
                        </span>
                      ) : (
                        <span className="badge bg-accent/10 text-accent border border-accent/20">
                          OPD
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-bg-secondary flex items-center justify-center text-[10px] font-bold text-text-secondary border border-border">
                          {r.doctor_name.replace('Dr. ', '').substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[13px] text-text-secondary font-medium">{r.doctor_name}</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openViewDetailsModal(r)}
                      >
                        <i className="fas fa-eye text-accent" /> View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- MODAL COMPONENTS --

function CaseDetailsModal({ record, onClose }) {
  const genderColorClass = (g) => {
    if (g === 'Male') return 'text-info bg-info/10 border-info/20';
    if (g === 'Female') return 'text-pink-500 bg-pink-500/10 border-pink-500/20';
    return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
  };

  return (
    <div className="animate-fadeUp text-left max-w-[650px] w-full">
      <div className="flex justify-between items-center mb-5 border-b border-border pb-3">
        <div>
          <span className="text-[10px] bg-bg-secondary text-text-muted px-2 py-0.5 rounded font-bold tracking-wider uppercase">
            {record.id}
          </span>
          <h3 className="text-lg font-bold font-display text-text-primary mt-1">
            Patient Visit Case Summary
          </h3>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
          <i className="fas fa-times text-lg" />
        </button>
      </div>

      <div className="space-y-5">
        {/* Patient Profile Header */}
        <div className="flex items-center gap-4 bg-bg-secondary/70 p-4 rounded-xl border border-border">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-xl">
            <i className="fas fa-user-injured" />
          </div>
          <div>
            <h4 className="font-bold text-base text-text-primary leading-tight">{record.patient_name}</h4>
            <div className="flex gap-2 items-center mt-1">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${genderColorClass(record.patient_gender)}`}>
                {record.patient_gender}
              </span>
              <span className="text-xs text-text-secondary font-medium">Age: {record.patient_age} years</span>
            </div>
          </div>
        </div>

        {/* Diagnosis & Attending Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3.5 bg-bg-secondary/50 rounded-xl border border-border">
            <span className="text-[10px] text-text-muted uppercase font-bold block mb-1">Diagnosis</span>
            <span className="text-sm font-bold text-text-primary">{record.disease}</span>
          </div>
          <div className="p-3.5 bg-bg-secondary/50 rounded-xl border border-border">
            <span className="text-[10px] text-text-muted uppercase font-bold block mb-1">Visit / Record Date</span>
            <span className="text-sm font-bold text-text-primary">{record.visit_date}</span>
          </div>
          <div className="p-3.5 bg-bg-secondary/50 rounded-xl border border-border">
            <span className="text-[10px] text-text-muted uppercase font-bold block mb-1">Attending Physician</span>
            <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
              <i className="fas fa-user-md text-accent text-xs" /> {record.doctor_name}
            </span>
          </div>
          <div className="p-3.5 bg-bg-secondary/50 rounded-xl border border-border">
            <span className="text-[10px] text-text-muted uppercase font-bold block mb-1">Facility Name</span>
            <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
              <i className="fas fa-hospital text-info text-xs" /> {record.health_center_name}
            </span>
          </div>
        </div>

        {/* Admission Details (Inpatient only) */}
        {record.admitted ? (
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-info/10 px-4 py-2 border-b border-border flex items-center gap-2">
              <i className="fas fa-bed text-info text-xs" />
              <span className="text-xs font-bold text-info uppercase tracking-wider">Hospitalization Record (Inpatient Stay)</span>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3 bg-bg-secondary/20">
              <div>
                <span className="text-[10px] text-text-muted block font-semibold mb-0.5">Ward / Bed Sector</span>
                <span className="text-sm font-bold text-text-primary">{record.admission_details?.sector} Sector</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted block font-semibold mb-0.5">Bed Number</span>
                <span className="text-sm font-bold text-text-primary">{record.admission_details?.bed_number}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted block font-semibold mb-0.5">Length of Stay</span>
                <span className="text-sm font-bold text-text-primary text-danger">{record.admission_details?.stay_days} Days</span>
              </div>
              <div className="col-span-3 pt-2 border-t border-border/60 flex justify-between text-xs font-medium text-text-secondary mt-1">
                <span>Admission: <strong className="text-text-primary">{record.admission_details?.admission_date}</strong></span>
                <span>Discharge: <strong className="text-text-primary">{record.admission_details?.discharge_date}</strong></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-accent/5 p-4 rounded-xl border border-accent/15 flex items-center gap-3 text-accent">
            <i className="fas fa-circle-info text-base" />
            <span className="text-xs font-medium">Outpatient consultation only. No bed allocation or inpatient admission was required.</span>
          </div>
        )}

        {/* Prescribed Medicines */}
        <div>
          <span className="text-[10px] text-text-muted uppercase font-bold block mb-2">Prescribed Medicines & Dosage</span>
          {record.medicines && record.medicines.length > 0 ? (
            <div className="bg-bg-primary border border-border rounded-xl divide-y divide-border overflow-hidden">
              {record.medicines.map((med, idx) => (
                <div key={idx} className="flex justify-between items-center py-2.5 px-4 text-sm">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-pills text-text-muted text-[13px]" />
                    <span className="font-semibold text-text-primary">{med.name}</span>
                  </div>
                  <span className="badge bg-bg-secondary text-text-secondary border border-border">
                    {med.quantity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic bg-bg-secondary/40 py-2.5 px-4 rounded-xl border border-dashed border-border text-center">
              No medications prescribed for this visit.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border mt-6">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close Case Summary
        </button>
      </div>
    </div>
  );
}

function AddRecordModal({ hc, role, healthCenters, onClose, onSuccess }) {
  const { showToast } = useApp();
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [disease, setDisease] = useState('');
  const [healthCenterId, setHealthCenterId] = useState(role === 'user' ? hc.id : '');
  const [doctorName, setDoctorName] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [admitted, setAdmitted] = useState(false);

  // Inpatient details form states
  const [sector, setSector] = useState('General');
  const [bedNumber, setBedNumber] = useState('');
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [dischargeDate, setDischargeDate] = useState(new Date().toISOString().split('T')[0]);
  const [stayDays, setStayDays] = useState('3');

  // Prescribed medicines dynamic rows
  const [medicines, setMedicines] = useState([]);

  // Auto calculate stay days when dates change
  const handleDatesChange = (adm, dis) => {
    try {
      const d1 = new Date(adm);
      const d2 = new Date(dis);
      const diffTime = Math.abs(d2 - d1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
      setStayDays(diffDays.toString());
    } catch {
      // ignore
    }
  };

  // Find selected health center object
  const activeHC = useMemo(() => {
    if (role === 'user') return hc;
    return healthCenters.find((c) => c.id === Number(healthCenterId)) || null;
  }, [role, hc, healthCenterId, healthCenters]);

  // Available medicines catalog for selected health center
  const availableMedicines = useMemo(() => {
    return activeHC?.medicines?.map((m) => m.name) || [
      'Paracetamol 500mg',
      'Amoxicillin 250mg',
      'Metformin 500mg',
      'Omeprazole 20mg',
      'Cetirizine 10mg',
      'Ibuprofen 400mg',
      'Azithromycin 500mg',
      'ORS Sachets',
      'Vitamin D3 Supplements',
      'Cough Syrup',
      'Amlodipine 5mg',
      'Antacid Tablets'
    ];
  }, [activeHC]);

  // Available doctors catalog for selected health center
  const availableDoctors = useMemo(() => {
    return activeHC?.doctors?.map((d) => d.name) || [
      'Dr. Priya Sharma',
      'Dr. Rahul Verma',
      'Dr. Anita Desai',
      'Dr. Suresh Kumar',
      'Dr. Meera Patel',
      'Dr. Vikram Singh'
    ];
  }, [activeHC]);

  const addMedicineRow = () => {
    setMedicines([...medicines, { name: availableMedicines[0] || '', quantity: '10 tablets' }]);
  };

  const removeMedicineRow = (index) => {
    setMedicines(medicines.filter((_, idx) => idx !== index));
  };

  const handleMedRowChange = (index, field, value) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!patientName.trim()) {
      showToast('Please enter patient name', 'error');
      return;
    }
    if (!patientAge || patientAge < 0 || patientAge > 130) {
      showToast('Please enter a valid age', 'error');
      return;
    }
    if (!disease.trim()) {
      showToast('Please enter or select a diagnosis/disease', 'error');
      return;
    }
    if (!healthCenterId) {
      showToast('Please select a health center', 'error');
      return;
    }
    if (!doctorName.trim()) {
      showToast('Please enter or select a doctor name', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        patient_name: patientName,
        patient_age: Number(patientAge),
        patient_gender: patientGender,
        disease,
        health_center_id: Number(healthCenterId),
        doctor_name: doctorName,
        visit_date: visitDate,
        admitted,
        medicines: medicines.filter((m) => m.name.trim()),
      };

      if (admitted) {
        payload.admission_details = {
          sector,
          bed_number: bedNumber || 'G-Unkn',
          admission_date: admissionDate,
          discharge_date: dischargeDate,
          stay_days: Number(stayDays) || 1,
        };
      }

      await api.addPatientHistoryRecord(payload);
      showToast('Patient record registered successfully!');
      onSuccess();
    } catch (err) {
      showToast(err.message || 'Failed to register patient record', 'error');
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
    'Other'
  ];

  return (
    <div className="animate-fadeUp text-left max-w-[650px] w-full max-h-[85vh] overflow-y-auto pr-1">
      <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
        <h3 className="text-base font-bold font-display text-text-primary">
          Register Past Patient History Record
        </h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <i className="fas fa-times text-lg" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Core details */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-3 md:col-span-2">
            <label className="form-label">Patient Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Aarav Mehta"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div>
            <label className="form-label">Gender</label>
            <select
              className="form-select"
              value={patientGender}
              onChange={(e) => setPatientGender(e.target.value)}
              disabled={submitting}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Age</label>
            <input
              type="number"
              className="form-input"
              placeholder="e.g. 45"
              min="0"
              max="130"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div>
            <label className="form-label">Visit / Consult Date</label>
            <input
              type="date"
              className="form-input"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="form-label">Health Center</label>
            {role === 'user' ? (
              <input
                type="text"
                className="form-input bg-bg-secondary cursor-not-allowed"
                value={hc.name}
                disabled
              />
            ) : (
              <select
                className="form-select"
                value={healthCenterId}
                onChange={(e) => setHealthCenterId(e.target.value)}
                disabled={submitting}
                required
              >
                <option value="" disabled>Select Center</option>
                {healthCenters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Disease / Diagnosis</label>
            <select
              className="form-select"
              value={DISEASES.includes(disease) ? disease : (disease ? 'Other' : '')}
              onChange={(e) => {
                if (e.target.value !== 'Other') {
                  setDisease(e.target.value);
                } else {
                  setDisease('');
                }
              }}
              disabled={submitting}
              required
            >
              <option value="" disabled>Select Diagnosis</option>
              {DISEASES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
              <option value="Other">Other (Custom type below)</option>
            </select>
            {(!DISEASES.includes(disease) || disease === '') && (
              <input
                type="text"
                className="form-input mt-2"
                placeholder="Enter custom diagnosis..."
                value={disease}
                onChange={(e) => setDisease(e.target.value)}
                disabled={submitting}
                required
              />
            )}
          </div>

          <div>
            <label className="form-label">Attending Doctor</label>
            <select
              className="form-select"
              value={availableDoctors.includes(doctorName) ? doctorName : (doctorName ? 'Custom' : '')}
              onChange={(e) => {
                if (e.target.value !== 'Custom') {
                  setDoctorName(e.target.value);
                } else {
                  setDoctorName('');
                }
              }}
              disabled={submitting}
              required
            >
              <option value="" disabled>Select Doctor</option>
              {availableDoctors.map((doc) => (
                <option key={doc} value={doc}>{doc}</option>
              ))}
              <option value="Custom">Custom Doctor (Type below)</option>
            </select>
            {(!availableDoctors.includes(doctorName) || doctorName === '') && (
              <input
                type="text"
                className="form-input mt-2"
                placeholder="Enter doctor's full name..."
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                disabled={submitting}
                required
              />
            )}
          </div>
        </div>

        {/* Admission Toggle & Form */}
        <div className="bg-bg-secondary/40 p-4 rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="admitted-check"
              className="w-4.5 h-4.5 rounded accent-accent cursor-pointer"
              checked={admitted}
              onChange={(e) => setAdmitted(e.target.checked)}
              disabled={submitting}
            />
            <label htmlFor="admitted-check" className="font-semibold text-text-primary text-[13px] cursor-pointer">
              Patient was Hospitalized (Admitted in Bed)
            </label>
          </div>

          {admitted && (
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-3 gap-3 animate-fadeUp">
              <div>
                <label className="form-label text-xs">Ward Sector</label>
                <select
                  className="form-select py-2 text-xs"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  disabled={submitting}
                >
                  <option value="General">General</option>
                  <option value="ICU">ICU</option>
                  <option value="Operation">Operation</option>
                </select>
              </div>
              <div>
                <label className="form-label text-xs">Bed Number</label>
                <input
                  type="text"
                  className="form-input py-2 text-xs"
                  placeholder="e.g. G4, ICU2"
                  value={bedNumber}
                  onChange={(e) => setBedNumber(e.target.value)}
                  disabled={submitting}
                  required={admitted}
                />
              </div>
              <div>
                <label className="form-label text-xs">Stay Period (Days)</label>
                <input
                  type="number"
                  className="form-input py-2 text-xs"
                  min="1"
                  value={stayDays}
                  onChange={(e) => setStayDays(e.target.value)}
                  disabled={submitting}
                  required={admitted}
                />
              </div>
              <div>
                <label className="form-label text-xs">Admission Date</label>
                <input
                  type="date"
                  className="form-input py-2 text-xs"
                  value={admissionDate}
                  onChange={(e) => {
                    setAdmissionDate(e.target.value);
                    handleDatesChange(e.target.value, dischargeDate);
                  }}
                  disabled={submitting}
                  required={admitted}
                />
              </div>
              <div>
                <label className="form-label text-xs">Discharge Date</label>
                <input
                  type="date"
                  className="form-input py-2 text-xs"
                  value={dischargeDate}
                  onChange={(e) => {
                    setDischargeDate(e.target.value);
                    handleDatesChange(admissionDate, e.target.value);
                  }}
                  disabled={submitting}
                  required={admitted}
                />
              </div>
            </div>
          )}
        </div>

        {/* Medicines Prescribed */}
        <div className="bg-bg-secondary/40 p-4 rounded-xl border border-border">
          <div className="flex justify-between items-center mb-3">
            <span className="font-semibold text-text-primary text-[13px]">
              Prescribed Medications
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm flex items-center gap-1"
              onClick={addMedicineRow}
              disabled={submitting}
            >
              <i className="fas fa-plus text-accent" /> Add row
            </button>
          </div>

          {medicines.length === 0 ? (
            <p className="text-xs text-text-muted italic text-center py-2 bg-bg-primary/50 rounded-lg border border-dashed border-border">
              No medicines added. Click "Add row" to prescribe medications.
            </p>
          ) : (
            <div className="space-y-2.5">
              {medicines.map((med, idx) => (
                <div key={idx} className="flex gap-2 items-center animate-fadeUp">
                  {/* Select medicine */}
                  <select
                    className="form-select py-1.5 text-xs flex-1"
                    value={med.name}
                    onChange={(e) => handleMedRowChange(idx, 'name', e.target.value)}
                    disabled={submitting}
                  >
                    {availableMedicines.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="Custom">Custom Medicine (Type below)</option>
                  </select>
                  {med.name === 'Custom' || !availableMedicines.includes(med.name) ? (
                    <input
                      type="text"
                      className="form-input py-1.5 text-xs flex-1"
                      placeholder="Type custom medicine name..."
                      value={med.name === 'Custom' ? '' : med.name}
                      onChange={(e) => handleMedRowChange(idx, 'name', e.target.value)}
                      disabled={submitting}
                      required
                    />
                  ) : null}

                  {/* Quantity input */}
                  <input
                    type="text"
                    className="form-input py-1.5 text-xs w-[120px]"
                    placeholder="e.g. 10 tablets"
                    value={med.quantity}
                    onChange={(e) => handleMedRowChange(idx, 'quantity', e.target.value)}
                    disabled={submitting}
                    required
                  />

                  {/* Delete button */}
                  <button
                    type="button"
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors"
                    onClick={() => removeMedicineRow(idx)}
                    disabled={submitting}
                  >
                    <i className="fas fa-trash-alt text-xs" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-6">
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
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Registering...' : 'Register Record'}
          </button>
        </div>
      </form>
    </div>
  );
}
