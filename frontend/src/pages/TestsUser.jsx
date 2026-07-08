import { useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { useApp } from '../context/AppContext';
import { ModalHeader, Field } from './MedicineUser';

export default function TestsUser({ hc, refetch }) {
  const { showToast, openModal, closeModal } = useApp();
  const { data: meta } = useFetch(() => api.meta(), []);
  const catalog = meta?.tests_catalog || [];
  const unavailable = catalog.filter((t) => !hc.tests.includes(t));

  const quickAdd = async (test) => {
    await api.addTest(hc.id, test);
    showToast(`${test} added`);
    refetch();
  };
  const remove = async (test) => {
    await api.removeTest(hc.id, test);
    showToast(`${test} removed`, 'info');
    refetch();
  };

  const openAdd = () => openModal(
    <AddTestForm
      hc={hc}
      available={unavailable}
      onDone={() => { closeModal(); refetch(); }}
      showToast={showToast}
      closeModal={closeModal}
    />
  );

  return (
    <div className="animate-fadeUp">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-text-secondary">{hc.tests.length} tests available</p>
        <button className="btn btn-primary" onClick={openAdd}><i className="fas fa-plus" /> Add Test</button>
      </div>

      <div className="data-card mb-5">
        <div className="data-card-header"><span className="font-bold text-[15px] text-accent font-display"><i className="fas fa-check-circle mr-1.5" />Available Tests</span></div>
        <div className="p-4 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {hc.tests.map((t) => (
            <div key={t} className="flex justify-between items-center px-4 py-3 bg-bg-secondary rounded-xl border border-accent/15">
              <div className="flex items-center gap-2.5"><i className="fas fa-flask text-accent text-[13px]" /><span className="text-[13px] font-medium">{t}</span></div>
              <button className="bed-ctrl w-[26px] h-[26px] text-danger" title={`Remove ${t}`} aria-label={`Remove ${t}`} onClick={() => remove(t)}><i className="fas fa-times text-[9px]" /></button>
            </div>
          ))}
          {hc.tests.length === 0 && <p className="text-text-muted text-[13px] col-span-full text-center py-5">No tests added yet.</p>}
        </div>
      </div>

      {unavailable.length > 0 && (
        <div className="data-card">
          <div className="data-card-header"><span className="font-bold text-[15px] text-text-muted font-display"><i className="fas fa-plus-circle mr-1.5" />Add More Tests</span></div>
          <div className="p-4 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {unavailable.map((t) => (
              <div key={t} onClick={() => quickAdd(t)} className="flex justify-between items-center px-4 py-3 bg-bg-secondary rounded-xl border border-border cursor-pointer transition-colors hover:border-accent">
                <span className="text-[13px] text-text-secondary">{t}</span>
                <i className="fas fa-plus text-accent text-[11px]" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AddTestForm({ hc, available, onDone, showToast, closeModal }) {
  const [sel, setSel] = useState('');
  const [custom, setCustom] = useState('');

  const save = async () => {
    const test = custom.trim() || sel;
    if (!test) { showToast('Please select or enter a test name', 'error'); return; }
    try {
      await api.addTest(hc.id, test);
      showToast(`${test} added successfully`);
      onDone();
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div>
      <ModalHeader title="Add Test" onClose={closeModal} />
      <Field label="Select from existing tests">
        <select className="form-select" value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">-- Choose a test --</option>
          {available.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <div className="text-center text-text-muted text-[13px] my-4">OR</div>
      <Field label="Enter custom test name" last>
        <input className="form-input" placeholder="e.g., MRI Scan" value={custom} onChange={(e) => setCustom(e.target.value)} />
      </Field>
      <button className="btn btn-primary w-full justify-center" onClick={save}>Add Test</button>
    </div>
  );
}
