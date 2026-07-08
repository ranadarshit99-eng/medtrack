import { api } from '../api/client';
import { useApp } from '../context/AppContext';

export default function Register({ hc, refetch }) {
  const { notifications, showToast, refreshNotifications } = useApp();

  if (hc.registered) {
    return (
      <Centered>
        <IconCircle icon="fa-circle-check" bg="rgba(16,185,129,0.15)" color="text-accent" />
        <h2 className="text-2xl font-bold mb-2 font-display">Registered</h2>
        <p className="text-text-secondary text-[15px]">Your health center is already registered with the district administration.</p>
      </Centered>
    );
  }

  const existingReq = notifications.find((n) => n.type === 'request' && n.hc_id === hc.id);
  if (existingReq) {
    return (
      <Centered>
        <IconCircle icon="fa-clock" bg="rgba(14,165,233,0.2)" color="text-warning" />
        <h2 className="text-2xl font-bold mb-2 font-display">Registration is Pending</h2>
        <p className="text-text-secondary text-[15px]">Your request has been sent to the district admin. You will be notified once it is reviewed.</p>
      </Centered>
    );
  }

  const send = async () => {
    await api.requestRegistration(hc.id);
    showToast('Registration request sent to District Admin!');
    await Promise.all([refetch(), refreshNotifications()]);
  };

  return (
    <div className="animate-fadeUp flex items-center justify-center min-h-[60vh]">
      <div className="data-card max-w-[500px] w-full">
        <div className="p-8 text-center">
          <div className="w-[72px] h-[72px] rounded-2xl bg-warning/20 flex items-center justify-center mx-auto mb-5">
            <i className="fas fa-file-circle-plus text-[30px] text-warning" />
          </div>
          <h2 className="text-[22px] font-bold mb-2 font-display">Request Registration</h2>
          <p className="text-text-secondary text-sm mb-6 leading-relaxed">
            Send a request to the District Admin to list your health center in the district dashboard. The admin will review your request.
          </p>
          <div className="bg-bg-secondary p-4 rounded-xl mb-6 text-left">
            <p className="text-[13px] text-text-muted mb-1">Health Center</p>
            <p className="font-semibold">{hc.name}</p>
            <p className="text-[13px] text-text-muted mt-2 mb-1">Location</p>
            <p className="font-medium text-text-secondary">{hc.location}</p>
            <p className="text-[13px] text-text-muted mt-2 mb-1">Facilities</p>
            <p className="font-medium text-text-secondary">{hc.beds.total} beds, {hc.medicines.length} medicines, {hc.tests.length} tests, {hc.doctors.length} doctors</p>
          </div>
          <button className="btn btn-primary w-full justify-center py-3" onClick={send}>
            <i className="fas fa-paper-plane" /> Send Registration Request
          </button>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }) {
  return <div className="animate-fadeUp flex items-center justify-center min-h-[60vh]"><div className="text-center">{children}</div></div>;
}
function IconCircle({ icon, bg, color }) {
  return (
    <div className="w-20 h-20 rounded-[20px] flex items-center justify-center mx-auto mb-5" style={{ background: bg }}>
      <i className={`fas ${icon} text-4xl ${color}`} />
    </div>
  );
}
