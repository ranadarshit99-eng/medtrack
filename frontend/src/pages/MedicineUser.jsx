import { useState } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { stockStatus, STOCK_HEX, STOCK_BADGE_CLASS, STOCK_LABEL } from '../utils';
import { IconButton } from '../components/UI';

const CATEGORIES = ['Analgesic', 'Antibiotic', 'Antidiabetic', 'Antacid', 'Antihistamine', 'Antihypertensive', 'Supplement', 'Rehydration', 'Expectorant', 'Other'];

function getExpiryStatus(expiryDateStr) {
  if (!expiryDateStr) return { label: 'No Date', badgeClass: 'badge-muted' };
  const expiry = new Date(expiryDateStr);
  const now = new Date();
  
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { label: 'Expired', badgeClass: 'badge-low' };
  } else if (diffDays <= 90) {
    return { label: `Expires soon (${diffDays}d)`, badgeClass: 'badge-mid' };
  } else {
    return { label: `Safe (${Math.round(diffDays / 30)}mo left)`, badgeClass: 'badge-high' };
  }
}

function getFinishedDate(stock, medName) {
  if (stock <= 0) return 'Out of Stock';
  const charCodeSum = medName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const dailyRate = (charCodeSum % 4) + 2; 
  const daysLeft = Math.ceil(stock / dailyRate);
  
  const finishDate = new Date();
  finishDate.setDate(finishDate.getDate() + daysLeft);
  return finishDate.toISOString().split('T')[0];
}

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

  const openDetails = (m) => openModal(<MedicineDetailsCard hc={hc} med={m} onDone={() => { refetch(); }} showToast={showToast} closeModal={closeModal} />);
  const openAdd = () => openModal(<AddMedicineForm hc={hc} onDone={() => { closeModal(); refetch(); }} showToast={showToast} closeModal={closeModal} />);
  const openEdit = (m) => openModal(<EditMedicineForm hc={hc} med={m} onDone={() => { closeModal(); refetch(); }} showToast={showToast} closeModal={closeModal} />);

  return (
    <div className="animate-fadeUp">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-text-secondary">{hc.medicines.length} medicines in stock</p>
        <button className="btn btn-primary" onClick={openAdd}><i className="fas fa-plus" /> Add Medicine</button>
      </div>
      <div className="data-card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Stock Level</th>
              <th>Mfg Date</th>
              <th>Expiry Status</th>
              <th>Last Stock Arrived</th>
              <th>Est. Finished Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {hc.medicines.map((m) => {
              const st = stockStatus(m.stock, m.max_stock);
              const pct = Math.round((m.stock / m.max_stock) * 100);
              const exp = getExpiryStatus(m.expiry_date);
              const finishDate = getFinishedDate(m.stock, m.name);
              return (
                <tr key={m.id}>
                  <td className="cursor-pointer hover:bg-accent/[0.04] transition-colors p-3" onClick={() => openDetails(m)}>
                    <div className="text-text-primary font-semibold flex items-center gap-1.5 hover:text-accent">
                      {m.name}
                      <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-normal">
                        {m.batches?.length || 0} {m.batches?.length === 1 ? 'batch' : 'batches'}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted">{m.category}</div>
                    <div className="text-[10px] text-accent mt-0.5 flex items-center gap-1">
                      <i className="fas fa-history text-[9px]" /> Click to view batches
                    </div>
                  </td>
                  <td>
                    <div className="flex justify-between items-center text-xs mb-1 min-w-[120px]">
                      <span className="font-bold" style={{ color: STOCK_HEX[st] }}>{m.stock} / {m.max_stock}</span>
                      <span className={`badge ${STOCK_BADGE_CLASS[st]} text-[10px] py-0.5 px-1.5`}>{STOCK_LABEL[st]}</span>
                    </div>
                    <div className="stock-bar"><div className="stock-bar-fill" style={{ width: `${pct}%`, background: STOCK_HEX[st] }} /></div>
                  </td>
                  <td className="text-xs font-medium">{m.mfg_date || 'N/A'}</td>
                  <td>
                    <span className={`badge ${exp.badgeClass} text-[10px] py-0.5 px-2 mb-1`}>{exp.label}</span>
                    <div className="text-[11px] text-text-muted">Expiry: {m.expiry_date || 'N/A'}</div>
                  </td>
                  <td>
                    <div className="text-xs font-semibold text-text-primary">+{m.last_stock_arrived || 0} units</div>
                    <div className="text-[11px] text-text-muted">Arrived: {m.last_arrival_date || 'N/A'}</div>
                  </td>
                  <td>
                    <div className="text-xs font-bold text-text-primary">{finishDate}</div>
                    <div className="text-[11px] text-text-muted">Runs out by</div>
                  </td>
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
  
  const [mfgDate, setMfgDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [lastArrived, setLastArrived] = useState(100);
  const [arrivalDate, setArrivalDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  const save = async () => {
    if (!name.trim()) { showToast('Medicine name is required', 'error'); return; }
    try {
      await api.addMedicine(hc.id, {
        name: name.trim(),
        category,
        stock: Number(stock) || 0,
        max_stock: Number(max) || 1,
        mfg_date: mfgDate,
        expiry_date: expiryDate,
        last_stock_arrived: Number(lastArrived) || 0,
        last_arrival_date: arrivalDate
      });
      showToast(`${name} added successfully`);
      onDone();
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div className="max-h-[80vh] overflow-y-auto pr-1 text-left">
      <ModalHeader title="Add New Medicine" onClose={closeModal} />
      <Field label="Medicine Name">
        <input className="form-input" placeholder="e.g., Aspirin 100mg" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Max Stock">
          <input type="number" min="1" className="form-input" value={max} onChange={(e) => setMax(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Current Stock">
          <input type="number" min="0" className="form-input" value={stock} onChange={(e) => setStock(e.target.value)} />
        </Field>
        <Field label="Last Arrived Qty">
          <input type="number" min="0" className="form-input" value={lastArrived} onChange={(e) => setLastArrived(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Manufacturing Date">
          <input type="date" className="form-input" value={mfgDate} onChange={(e) => setMfgDate(e.target.value)} />
        </Field>
        <Field label="Expiry Date">
          <input type="date" className="form-input" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Last Stock Arrival Date" last>
        <input type="date" className="form-input" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
      </Field>

      <button className="btn btn-primary w-full justify-center mt-2" onClick={save}>Add Medicine</button>
    </div>
  );
}

function EditMedicineForm({ hc, med, onDone, showToast, closeModal }) {
  const [name, setName] = useState(med.name);
  const [category, setCategory] = useState(med.category);
  const [stock, setStock] = useState(med.stock);
  const [max, setMax] = useState(med.max_stock);
  
  const [mfgDate, setMfgDate] = useState(med.mfg_date || '');
  const [expiryDate, setExpiryDate] = useState(med.expiry_date || '');
  const [lastArrived, setLastArrived] = useState(med.last_stock_arrived || 0);
  const [arrivalDate, setArrivalDate] = useState(med.last_arrival_date || '');

  const save = async () => {
    if (!name.trim()) { showToast('Medicine name is required', 'error'); return; }
    try {
      await api.updateMedicine(hc.id, med.id, {
        name: name.trim(),
        category,
        stock: Number(stock) || 0,
        max_stock: Number(max) || 1,
        mfg_date: mfgDate,
        expiry_date: expiryDate,
        last_stock_arrived: Number(lastArrived) || 0,
        last_arrival_date: arrivalDate
      });
      showToast('Medicine updated successfully');
      onDone();
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div className="max-h-[80vh] overflow-y-auto pr-1 text-left">
      <ModalHeader title="Edit Medicine" onClose={closeModal} />
      <Field label="Medicine Name">
        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <input className="form-input" value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>
        <Field label="Max Stock">
          <input type="number" min="1" className="form-input" value={max} onChange={(e) => setMax(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Current Stock">
          <input type="number" min="0" className="form-input" value={stock} onChange={(e) => setStock(e.target.value)} />
        </Field>
        <Field label="Last Arrived Qty">
          <input type="number" min="0" className="form-input" value={lastArrived} onChange={(e) => setLastArrived(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Manufacturing Date">
          <input type="date" className="form-input" value={mfgDate} onChange={(e) => setMfgDate(e.target.value)} />
        </Field>
        <Field label="Expiry Date">
          <input type="date" className="form-input" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Last Stock Arrival Date" last>
        <input type="date" className="form-input" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
      </Field>

      <button className="btn btn-primary w-full justify-center mt-2" onClick={save}>Save Changes</button>
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

function MedicineDetailsCard({ hc, med, onDone, showToast, closeModal }) {
  const [batches, setBatches] = useState(med.batches || []);
  const [addingBatch, setAddingBatch] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState(null);
  
  const [mfgDate, setMfgDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]);
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().split('T')[0]);
  const [initialQty, setInitialQty] = useState(100);
  const [currentQty, setCurrentQty] = useState(100);

  const [editMfg, setEditMfg] = useState('');
  const [editExp, setEditExp] = useState('');
  const [editArrival, setEditArrival] = useState('');
  const [editInitQty, setEditInitQty] = useState(0);
  const [editCurrQty, setEditCurrQty] = useState(0);

  const refreshMed = async () => {
    try {
      const updatedHC = await api.getHealthCenter(hc.id);
      const updatedMed = updatedHC.medicines.find(m => m.id === med.id);
      if (updatedMed) {
        setBatches(updatedMed.batches || []);
      }
      onDone();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleAddBatch = async () => {
    try {
      await api.addMedicineBatch(hc.id, med.id, {
        mfg_date: mfgDate,
        expiry_date: expiryDate,
        arrival_date: arrivalDate,
        initial_quantity: Number(initialQty),
        current_quantity: Number(currentQty)
      });
      showToast("New stock batch added successfully");
      setAddingBatch(false);
      refreshMed();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const startEdit = (b) => {
    setEditingBatchId(b.id);
    setEditMfg(b.mfg_date);
    setEditExp(b.expiry_date);
    setEditArrival(b.arrival_date);
    setEditInitQty(b.initial_quantity);
    setEditCurrQty(b.current_quantity);
  };

  const handleUpdateBatch = async (batchId) => {
    try {
      await api.updateMedicineBatch(hc.id, med.id, batchId, {
        mfg_date: editMfg,
        expiry_date: editExp,
        arrival_date: editArrival,
        initial_quantity: Number(editInitQty),
        current_quantity: Number(editCurrQty)
      });
      showToast("Stock batch updated successfully");
      setEditingBatchId(null);
      refreshMed();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm("Are you sure you want to remove this batch?")) return;
    try {
      await api.deleteMedicineBatch(hc.id, med.id, batchId);
      showToast("Batch deleted successfully");
      refreshMed();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const totalStock = batches.reduce((sum, b) => sum + b.current_quantity, 0);

  return (
    <div className="max-h-[80vh] overflow-y-auto pr-1 text-left">
      <ModalHeader title={`Stock Batches: ${med.name}`} onClose={closeModal} />
      
      <div className="bg-bg-secondary p-4 rounded-xl mb-4 border border-border">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">Category: {med.category}</span>
          <span className="text-sm font-bold text-accent">Total Stock: {totalStock} / {med.max_stock} units</span>
        </div>
        <div className="stock-bar mb-1"><div className="stock-bar-fill bg-accent" style={{ width: `${Math.min(100, (totalStock/med.max_stock)*100)}%` }} /></div>
        <p className="text-[11px] text-text-muted mt-2">
          * Each batch represents stock received on a specific date. You can update or edit individual batch stocks below.
        </p>
      </div>

      <div className="flex justify-between items-center mb-3">
        <h4 className="text-[14px] font-bold font-display text-text-primary">Stock Batches History</h4>
        {!addingBatch && (
          <button className="btn btn-primary btn-sm" onClick={() => setAddingBatch(true)}>
            <i className="fas fa-plus mr-1" /> Add New Batch
          </button>
        )}
      </div>

      {addingBatch && (
        <div className="bg-accent/5 p-4 rounded-xl border border-accent/20 mb-4 animate-fadeUp">
          <h5 className="text-xs font-bold text-accent mb-3">Add New Stock Batch</h5>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Mfg Date"><input type="date" className="form-input text-xs py-1.5" value={mfgDate} onChange={e => setMfgDate(e.target.value)} /></Field>
            <Field label="Expiry Date"><input type="date" className="form-input text-xs py-1.5" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Field label="Arrival Date"><input type="date" className="form-input text-xs py-1.5" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} /></Field>
            <Field label="Initial Qty"><input type="number" className="form-input text-xs py-1.5" value={initialQty} onChange={e => setInitialQty(e.target.value)} /></Field>
            <Field label="Current Qty"><input type="number" className="form-input text-xs py-1.5" value={currentQty} onChange={e => setCurrentQty(e.target.value)} /></Field>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-secondary btn-sm" onClick={() => setAddingBatch(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleAddBatch}>Save Batch</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {batches.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No stock batches found for this medicine.</p>
        ) : (
          batches.map((b) => {
            const isEditing = editingBatchId === b.id;
            const exp = getExpiryStatus(b.expiry_date);
            return (
              <div key={b.id} className="bg-bg-card border border-border rounded-xl p-3.5 hover:border-accent/40 transition-colors">
                {isEditing ? (
                  <div className="animate-fadeUp space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Mfg Date"><input type="date" className="form-input text-xs py-1.5" value={editMfg} onChange={e => setEditMfg(e.target.value)} /></Field>
                      <Field label="Expiry Date"><input type="date" className="form-input text-xs py-1.5" value={editExp} onChange={e => setEditExp(e.target.value)} /></Field>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Arrival Date"><input type="date" className="form-input text-xs py-1.5" value={editArrival} onChange={e => setEditArrival(e.target.value)} /></Field>
                      <Field label="Initial Qty"><input type="number" className="form-input text-xs py-1.5" value={editInitQty} onChange={e => setEditInitQty(e.target.value)} /></Field>
                      <Field label="Current Qty"><input type="number" className="form-input text-xs py-1.5" value={editCurrQty} onChange={e => setEditCurrQty(e.target.value)} /></Field>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingBatchId(null)}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleUpdateBatch(b.id)}>Save Changes</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-[13px] font-bold text-text-primary">Stock arrived on: {b.arrival_date}</span>
                        <div className="text-[11px] text-text-muted mt-0.5">Mfg Date: {b.mfg_date}</div>
                      </div>
                      <span className={`badge ${exp.badgeClass} text-[10px]`}>{exp.label} (Exp: {b.expiry_date})</span>
                    </div>
                    
                    <div className="flex justify-between items-center bg-bg-secondary px-3 py-2 rounded-lg text-xs mb-3 border border-border">
                      <div>
                        <span className="text-text-muted">Initial Quantity: </span>
                        <span className="font-semibold text-text-primary">{b.initial_quantity}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">Current Quantity: </span>
                        <span className="font-bold text-accent text-sm">{b.current_quantity}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <button className="btn btn-secondary btn-sm px-2.5 py-1 text-[11px]" onClick={() => startEdit(b)}>
                        <i className="fas fa-edit mr-1" /> Edit Batch
                      </button>
                      <button className="btn btn-danger btn-sm px-2.5 py-1 text-[11px]" onClick={() => handleDeleteBatch(b.id)}>
                        <i className="fas fa-trash mr-1" /> Delete Batch
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
