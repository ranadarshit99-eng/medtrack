import { useState } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { IconButton } from '../components/UI';
import { ModalHeader, Field } from './MedicineUser';

const SPECS = ['General Medicine', 'Pediatrics', 'Gynecology', 'Orthopedics', 'Dermatology', 'ENT', 'Ophthalmology', 'Cardiology', 'Other'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Doctors({ hc, refetch }) {
  const { showToast, openModal, closeModal } = useApp();

  const removeDoctor = async (doc) => {
    await api.removeDoctor(hc.id, doc.id);
    showToast('Doctor removed', 'info');
    refetch();
  };
  const removeSlot = async (doc, idx) => {
    await api.removeScheduleSlot(hc.id, doc.id, idx);
    showToast('Schedule slot removed', 'info');
    refetch();
  };

  const openAddDoctor = () => openModal(<AddDoctorForm hc={hc} onDone={() => { closeModal(); refetch(); }} showToast={showToast} closeModal={closeModal} />);
  const openAddSlot = (doc) => openModal(<AddSlotForm hc={hc} doc={doc} onDone={() => { closeModal(); refetch(); }} showToast={showToast} closeModal={closeModal} />);

  return (
    <div className="animate-fadeUp">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-text-secondary">{hc.doctors.length} doctors assigned</p>
        <button className="btn btn-primary" onClick={openAddDoctor}><i className="fas fa-plus" /> Add Doctor</button>
      </div>
      <div className="grid gap-4">
        {hc.doctors.map((doc) => (
          <div key={doc.id} className="data-card">
            <div className="data-card-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center"><i className="fas fa-user-doctor text-info" /></div>
                <div><p className="font-bold text-sm">{doc.name}</p><p className="text-xs text-text-muted">{doc.spec}</p></div>
              </div>
              <div className="flex gap-1.5">
                <button className="btn btn-sm btn-secondary" onClick={() => openAddSlot(doc)}><i className="fas fa-plus" /> Add Slot</button>
                <IconButton icon="fa-trash" title={`Remove ${doc.name}`} danger onClick={() => removeDoctor(doc)} />
              </div>
            </div>
            <div className="px-4 py-3">
              {doc.schedule.length === 0 ? (
                <p className="text-text-muted text-[13px] text-center py-2.5">No schedule set</p>
              ) : (
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                  {doc.schedule.map((s, si) => (
                    <div key={si} className="flex justify-between items-center px-3.5 py-2.5 bg-bg-secondary rounded-lg border border-border">
                      <div><p className="text-[13px] font-semibold text-accent">{s.day}</p><p className="text-xs text-text-muted">{s.time}</p></div>
                      <IconButton icon="fa-times" title="Remove slot" danger onClick={() => removeSlot(doc, si)} className="w-6 h-6" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {hc.doctors.length === 0 && <p className="text-text-muted text-sm text-center py-10">No doctors added yet.</p>}
      </div>
    </div>
  );
}

function AddDoctorForm({ hc, onDone, showToast, closeModal }) {
  const [name, setName] = useState('');
  const [spec, setSpec] = useState(SPECS[0]);

  const save = async () => {
    if (!name.trim()) { showToast('Doctor name is required', 'error'); return; }
    try {
      await api.addDoctor(hc.id, { name: name.trim(), spec });
      showToast(`${name} added successfully`);
      onDone();
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div>
      <ModalHeader title="Add Doctor" onClose={closeModal} />
      <Field label="Doctor Name"><input className="form-input" placeholder="Dr. ..." value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Specialization" last>
        <select className="form-select" value={spec} onChange={(e) => setSpec(e.target.value)}>
          {SPECS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <button className="btn btn-primary w-full justify-center" onClick={save}>Add Doctor</button>
    </div>
  );
}

function AddSlotForm({ hc, doc, onDone, showToast, closeModal }) {
  const [day, setDay] = useState(DAYS[0]);
  const [time, setTime] = useState('');

  const save = async () => {
    if (!time.trim()) { showToast('Please enter time', 'error'); return; }
    try {
      await api.addScheduleSlot(hc.id, doc.id, { day, time: time.trim() });
      showToast('Schedule slot added');
      onDone();
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div>
      <ModalHeader title="Add Schedule Slot" onClose={closeModal} />
      <Field label="Day">
        <select className="form-select" value={day} onChange={(e) => setDay(e.target.value)}>
          {DAYS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </Field>
      <Field label="Time" last><input className="form-input" placeholder="e.g., 09:00 - 13:00" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      <button className="btn btn-primary w-full justify-center" onClick={save}>Add Slot</button>
    </div>
  );
}
