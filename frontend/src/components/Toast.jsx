import { useApp } from '../context/AppContext';

const ICON = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
const COLOR = {
  success: 'bg-accent/15 text-accent border-accent/30',
  error: 'bg-danger/20 text-danger border-danger/30',
  info: 'bg-info/20 text-info border-info/30',
};

export default function ToastStack() {
  const { toasts } = useApp();
  return (
    <div className="fixed top-20 right-6 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-5 py-3 rounded-xl flex items-center gap-2.5 text-sm font-medium border backdrop-blur-md animate-fadeUp ${COLOR[t.type]}`}
        >
          <i className={`fas ${ICON[t.type]}`} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
