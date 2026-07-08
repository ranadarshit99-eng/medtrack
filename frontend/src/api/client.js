const BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) {
        let detail = res.statusText;
        try { detail = (await res.json()).detail ?? detail; } catch { /* ignore */ }
        throw new Error(detail);
    }
    if (res.status === 204) return null;
    return res.json();
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
const patch = (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) });
const del = (path) => request(path, { method: 'DELETE' });

export const api = {
        login: (role) => post('/auth/login', { role }),
        meta: () => get('/meta'),

        listHealthCenters: (registeredOnly = true, q = '') =>
            get(`/health-centers?registered_only=${registeredOnly}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  getHealthCenter: (id) => get(`/health-centers/${id}`),
  requestRegistration: (id) => post(`/health-centers/${id}/register-request`),
  acceptHealthCenter: (id) => post(`/health-centers/${id}/accept`),
  rejectHealthCenter: (id) => post(`/health-centers/${id}/reject`),
  restoreDemoCenter: () => post('/health-centers/restore-demo'),

  updateBeds: (id, payload) => patch(`/health-centers/${id}/beds`, payload),
  allocateBed: (id, bedId, payload) => post(`/health-centers/${id}/beds/${bedId}/allocate`, payload),
  releaseBed: (id, bedId) => post(`/health-centers/${id}/beds/${bedId}/release`),
  addBed: (id, payload) => post(`/health-centers/${id}/beds`, payload),
  deleteBed: (id, bedId) => del(`/health-centers/${id}/beds/${bedId}`),

  addMedicine: (id, payload) => post(`/health-centers/${id}/medicines`, payload),
  updateMedicine: (id, medId, payload) => patch(`/health-centers/${id}/medicines/${medId}`, payload),
  adjustStock: (id, medId, delta) => post(`/health-centers/${id}/medicines/${medId}/stock-delta`, { delta }),
  deleteMedicine: (id, medId) => del(`/health-centers/${id}/medicines/${medId}`),
  addMedicineBatch: (id, medId, payload) => post(`/health-centers/${id}/medicines/${medId}/batches`, payload),
  updateMedicineBatch: (id, medId, batchId, payload) => patch(`/health-centers/${id}/medicines/${medId}/batches/${batchId}`, payload),
  deleteMedicineBatch: (id, medId, batchId) => del(`/health-centers/${id}/medicines/${medId}/batches/${batchId}`),

  addTest: (id, name) => post(`/health-centers/${id}/tests`, { name }),
  removeTest: (id, name) => del(`/health-centers/${id}/tests/${encodeURIComponent(name)}`),

  addDoctor: (id, payload) => post(`/health-centers/${id}/doctors`, payload),
  removeDoctor: (id, docId) => del(`/health-centers/${id}/doctors/${docId}`),
  addScheduleSlot: (id, docId, payload) => post(`/health-centers/${id}/doctors/${docId}/schedule`, payload),
  removeScheduleSlot: (id, docId, slotIndex) => del(`/health-centers/${id}/doctors/${docId}/schedule/${slotIndex}`),

  hcAnalytics: (id, period) => get(`/health-centers/${id}/analytics?period=${period}`),
  aggregateAnalytics: (period) => get(`/analytics/aggregate?period=${period}`),
  addPatientEntry: (id, payload) => post(`/health-centers/${id}/patient-entry`, payload),

  listNotifications: (hcId = null) => get(`/notifications${hcId ? `?hc_id=${hcId}` : ''}`),
  markRead: (id) => post(`/notifications/${id}/read`),
  markAllRead: () => post('/notifications/mark-all-read'),

  // AI Prediction APIs — Health Center
  centerDiseaseTrends: (id) => get(`/predictions/center/${id}/disease-trends`),
  centerPatientForecast: (id) => get(`/predictions/center/${id}/patient-forecast`),
  centerMedicineDemand: (id) => get(`/predictions/center/${id}/medicine-demand`),
  centerBedForecast: (id) => get(`/predictions/center/${id}/bed-forecast`),
  centerAlertsAndRecs: (id) => get(`/predictions/center/${id}/alerts-and-recommendations`),

  // AI Prediction APIs — Admin
  adminDiseaseTrends: () => get('/predictions/admin/disease-trends'),
  adminMedicineDemand: () => get('/predictions/admin/medicine-demand'),
  adminPatientForecast: () => get('/predictions/admin/patient-forecast'),
  adminBedForecast: () => get('/predictions/admin/bed-forecast'),
  adminRecommendations: () => get('/predictions/admin/recommendations'),
  adminAlerts: () => get('/predictions/admin/alerts'),

  // Medicine Historical analytics API
  medicineHistory: (medName, hcId = null) => get(`/analytics/medicine-history?medicine_name=${encodeURIComponent(medName)}${hcId ? `&hc_id=${hcId}` : ''}`),

  // Patient History APIs
  listPatientHistory: (hcId = null, q = '') =>
    get(`/patient-history?${hcId ? `hc_id=${hcId}&` : ''}q=${encodeURIComponent(q)}`),
  addPatientHistoryRecord: (payload) => post('/patient-history', payload),
};