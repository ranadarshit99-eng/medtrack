import { useMemo } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { useApp } from '../context/AppContext';

export default function TestsAdmin() {
  const { searchQuery } = useApp();
  const { data: allHCs, loading } = useFetch(() => api.listHealthCenters(false), []);
  const q = searchQuery.toLowerCase();
  const reg = useMemo(() => (allHCs || [])
    .filter((h) => h.registered)
    .filter((h) => !q || h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q)), [allHCs, q]);
  const allTests = useMemo(() => [...new Set(reg.flatMap((h) => h.tests))].sort(), [reg]);

  if (loading) return <p className="text-text-muted">Loading…</p>;

  return (
    <div className="animate-fadeUp data-card">
      <div className="data-card-header">
        <span className="font-bold text-[15px] font-display">Test Availability Matrix</span>
        <span className="text-xs text-text-muted">{allTests.length} test types across {reg.length} centers</span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sticky left-0 bg-bg-secondary z-10">Test / Center</th>
              {reg.map((h) => <th key={h.id} className="text-[11px] min-w-[100px]">{h.name.split(' ')[0]}</th>)}
            </tr>
          </thead>
          <tbody>
            {allTests.map((test) => (
              <tr key={test}>
                <td className="sticky left-0 bg-bg-card z-10 text-text-primary font-medium">{test}</td>
                {reg.map((h) => {
                  const has = h.tests.includes(test);
                  return (
                    <td key={h.id} className="text-center">
                      <i className={`fas ${has ? 'fa-check-circle text-accent' : 'fa-times-circle text-text-muted'} text-base`} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
