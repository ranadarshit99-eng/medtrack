import { useState } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { stockStatus, STOCK_HEX, STOCK_BADGE_CLASS, STOCK_LABEL } from '../utils';
import { IconButton } from '../components/UI';

const CATEGORIES = ['Analgesic', 'Antibiotic', 'Antidiabetic', 'Antacid', 'Antihistamine', 'Antihypertensive', 'Supplement', 'Rehydration', 'Expectorant', 'Other'];

export default function MedicineUser({ hc, refetch }) {
  const { showToast, openModal, closeModal } = useApp();

  const adjust = async (m, delta) => {
    await api.adjustStock(hc.id, m.id, delta);
    showToast(`Stock updated: ${m.name}`);
    refetch();
  };

  const remove = async (m) => {
    await api.deleteMedicine(hc.id, m.id);
    showToast(`${m.name} removed`, 'info');
    refetch();
  };

  const openAdd = () => openModal(<AddMedicineForm hc={hc} onDone={() => { closeModal(); refetch(); }} showToast={showToast} closeModal={closeModal} />);
  const openEdit = (m) => openModal(<EditMedicineForm hc={hc} med={m} onDone={() => { closeModal(); refetch(); }} showToast={showToast} closeModal={closeModal} />);

  return (
    <div className="animate-fadeUp">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-text-secondary">{hc.medicines.length} medicines in stock</p>
        <button className="btn btn-primary" onClick={openAdd}><i className="fas fa-plus" /> Add Medicine</button>
      </div>
      <div className="data-card">
        <table className="data-table">
          <thead><tr><th>Medicine</th><th>Category</th><th>Stock</th><th>Max Stock</th><th>Level</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {hc.medicines.map((m) => {
              const st = stockStatus(m.stock, m.max_stock);
              const pct = Math.round((m.stock / m.max_stock) * 100);
              return (
                <tr key={m.id}>
                  <td className="text-text-primary font-medium">{m.name}</td>
                  <td>{m.category}</td>
                  <td className="font-semibold" style={{ color: STOCK_HEX[st] }}>{m.stock}</td>
                  <td>{m.max_stock}</td>
                  <td className="w-[140px]"><div className="stock-bar"><div className="stock-bar-fill" style={{ width: `${pct}%`, background: STOCK_HEX[st] }} /></div></td>
                  <td><span className={`badge ${STOCK_BADGE_CLASS[st]}`}>{STOCK_LABEL[st]}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <IconButton icon="fa-plus" title="Increase stock" onClick={() => adjust(m, 10)} />
                      <IconButton icon="fa-minus" title="Decrease stock" onClick={() => adjust(m, -10)} />
                      <IconButton icon="fa-pen" title="Edit medicine" onClick={() => openEdit(m)} className="ml-1" />
                      <IconButton icon="fa-trash" title="Delete medicine" danger onClick={() => remove(m)} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddMedicineForm({ hc, onDone, showToast, closeModal }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [stock, setStock] = useState(100);
  const [max, setMax] = useState(200);

  const save = async () => {
    if (!name.trim()) { showToast('Medicine name is required', 'error'); return; }
    try {
      await api.addMedicine(hc.id, { name: name.trim(), category, stock: Number(stock) || 0, max_stock: Number(max) || 1 });
      showToast(`${name} added successfully`);
      onDone();
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div>
      <ModalHeader title="Add New Medicine" onClose={closeModal} />
      <Field label="Medicine Name"><input className="form-input" placeholder="e.g., Aspirin 100mg" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Category">
        <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Initial Stock"><input type="number" min="0" className="form-input" value={stock} onChange={(e) => setStock(e.target.value)} /></Field>
      <Field label="Max Stock" last><input type="number" min="1" className="form-input" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
      <button className="btn btn-primary w-full justify-center" onClick={save}>Add Medicine</button>
    </div>
  );
}

function EditMedicineForm({ hc, med, onDone, showToast, closeModal }) {
  const [name, setName] = useState(med.name);
  const [category, setCategory] = useState(med.category);
  const [stock, setStock] = useState(med.stock);
  const [max, setMax] = useState(med.max_stock);

  const save = async () => {
    if (!name.trim()) { showToast('Medicine name is required', 'error'); return; }
    try {
      await api.updateMedicine(hc.id, med.id, { name: name.trim(), category, stock: Number(stock) || 0, max_stock: Number(max) || 1 });
      showToast('Medicine updated successfully');
      onDone();
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div>
      <ModalHeader title="Edit Medicine" onClose={closeModal} />
      <Field label="Medicine Name"><input className="form-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Category"><input className="form-input" value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
      <Field label="Current Stock"><input type="number" min="0" className="form-input" value={stock} onChange={(e) => setStock(e.target.value)} /></Field>
      <Field label="Max Stock" last><input type="number" min="1" className="form-input" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
      <button className="btn btn-primary w-full justify-center" onClick={save}>Save Changes</button>
    </div>
  );
}

export function ModalHeader({ title, onClose }) {
  return (
    <div className="flex justify-between items-center mb-5">
      <h3 className="text-lg font-bold font-display">{title}</h3>
      <button onClick={onClose} aria-label="Close" className="bg-transparent border-none text-text-muted cursor-pointer text-lg"><i className="fas fa-times" /></button>
    </div>
  );
}

export function Field({ label, children, last }) {
  return (
    <div className={last ? 'mb-5' : 'mb-3.5'}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}
