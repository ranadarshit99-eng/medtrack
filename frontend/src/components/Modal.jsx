import { useApp } from '../context/AppContext';

export default function Modal() {
  const { modal, closeModal } = useApp();
  if (!modal) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div className="bg-bg-card border border-border rounded-2xl p-7 w-[90%] max-w-[520px] max-h-[85vh] overflow-y-auto animate-modalIn">
        {modal}
      </div>
    </div>
  );
}
