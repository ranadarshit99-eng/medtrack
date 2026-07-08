import { useApp } from './context/AppContext';
import { api } from './api/client';
import { useFetch } from './hooks';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Modal from './components/Modal';
import ToastStack from './components/Toast';

import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import HealthCenters from './pages/HealthCenters';
import MedicineAdmin from './pages/MedicineAdmin';
import MedicineUser from './pages/MedicineUser';
import BedsAdmin from './pages/BedsAdmin';
import BedsUser from './pages/BedsUser';
import AnalyticsAdmin from './pages/AnalyticsAdmin';
import AnalyticsUser from './pages/AnalyticsUser';
import Alerts from './pages/Alerts';
import TestsAdmin from './pages/TestsAdmin';
import TestsUser from './pages/TestsUser';
import Doctors from './pages/Doctors';
import Register from './pages/Register';
import PatientHistory from './pages/PatientHistory';

export default function App() {
  const { role } = useApp();
  if (!role) return <><Login /><ToastStack /></>;
  return <AppShell />;
}

function AppShell() {
  const { role, currentPage, userHCId } = useApp();
  const { data: userHC, refetch } = useFetch(
    () => (role === 'user' ? api.getHealthCenter(userHCId) : Promise.resolve(null)),
    [role, userHCId]
  );

  return (
    <div className="flex h-screen">
      <Sidebar userHC={userHC} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 bg-bg-deep">
          {role === 'admin' ? <AdminPage page={currentPage} /> : <UserPage page={currentPage} hc={userHC} refetch={refetch} />}
        </main>
      </div>
      <Modal />
      <ToastStack />
    </div>
  );
}

function AdminPage({ page }) {
  switch (page) {
    case 'dashboard': return <AdminDashboard />;
    case 'health-centers': return <HealthCenters />;
    case 'medicine': return <MedicineAdmin />;
    case 'beds': return <BedsAdmin />;
    case 'analytics': return <AnalyticsAdmin />;
    case 'patient-history': return <PatientHistory />;
    case 'alerts': return <Alerts />;
    case 'tests': return <TestsAdmin />;
    default: return <AdminDashboard />;
  }
}

function UserPage({ page, hc, refetch }) {
  if (!hc) return <p className="text-text-muted">Loading…</p>;
  switch (page) {
    case 'dashboard': return <UserDashboard hc={hc} />;
    case 'medicine': return <MedicineUser hc={hc} refetch={refetch} />;
    case 'beds': return <BedsUser hc={hc} refetch={refetch} />;
    case 'analytics': return <AnalyticsUser hc={hc} refetch={refetch} />;
    case 'patient-history': return <PatientHistory hc={hc} />;
    case 'tests': return <TestsUser hc={hc} refetch={refetch} />;
    case 'doctors': return <Doctors hc={hc} refetch={refetch} />;
    case 'register': return <Register hc={hc} refetch={refetch} />;
    default: return <UserDashboard hc={hc} />;
  }
}
