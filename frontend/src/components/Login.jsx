import { useApp } from '../context/AppContext';

const ORBS = [
  { className: 'w-[500px] h-[500px] bg-accent -top-36 -left-24', style: {} },
  { className: 'w-[400px] h-[400px] bg-info -bottom-24 -right-12', style: { animationDelay: '-4s' } },
  { className: 'w-[300px] h-[300px] bg-warning top-1/2 left-1/2 !opacity-10', style: { animationDelay: '-8s', transform: 'translate(-50%,-50%)' } },
];

export default function Login() {
  const { login, showToast } = useApp();

  const handleLogin = async (role) => {
    try {
      await login(role);
    } catch (e) {
      showToast(`Login failed: ${e.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-deep overflow-hidden">
      {ORBS.map((o, i) => (
        <div key={i} className={`absolute rounded-full blur-[120px] opacity-20 animate-orbFloat ${o.className}`} style={o.style} />
      ))}

      <div className="relative z-[2] text-center px-4">
        <div className="mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-accent to-info rounded-xl flex items-center justify-center">
              <i className="fas fa-heartbeat text-white text-[22px]" />
            </div>
            <h1 className="text-[32px] font-bold tracking-tight font-display">MedTrack</h1>
          </div>
          <p className="text-text-secondary text-base">District Health Management System</p>
        </div>

        <div className="flex gap-6 flex-wrap justify-center">
          <RoleCard
            onClick={() => handleLogin('admin')}
            icon="fa-shield-halved"
            iconBg="bg-gradient-to-br from-accent/20 to-accent/5"
            iconColor="text-accent"
            title="District Admin"
            desc="Oversee all health centers, manage resources, and monitor district-wide analytics."
          />
          <RoleCard
            onClick={() => handleLogin('user')}
            icon="fa-hospital"
            iconBg="bg-gradient-to-br from-info/20 to-info/5"
            iconColor="text-info"
            title="Health Center"
            desc="Manage your health center's medicines, beds, tests, doctors, and patient data."
          />
        </div>
      </div>
    </div>
  );
}

function RoleCard({ onClick, icon, iconBg, iconColor, title, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-[280px] bg-bg-card/80 backdrop-blur-xl border border-border rounded-2xl px-8 py-10 text-left transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] hover:border-accent hover:shadow-[0_20px_60px_rgba(16,185,129,0.15)]"
    >
      <div className={`w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-[28px] mb-5 ${iconBg}`}>
        <i className={`fas ${icon} ${iconColor}`} />
      </div>
      <h3 className="text-xl font-bold mb-2 font-display">{title}</h3>
      <p className="text-text-secondary text-[13px] leading-relaxed">{desc}</p>
    </button>
  );
}
