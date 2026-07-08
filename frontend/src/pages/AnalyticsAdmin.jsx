import { useEffect, useMemo, useState } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import { api } from '../api/client';
import { useFetch } from '../hooks';
import { useApp } from '../context/AppContext';
import { chartColors, baseOptions } from '../charts/setup';

const PERIOD_LABELS = { monthly: 'Monthly Overview', daily: 'Daily Overview (Last 30 Days)', yearly: 'Yearly Overview' };

export default function AnalyticsAdmin() {
  const { searchQuery } = useApp();
  const [period, setPeriod] = useState('monthly');
  const [selectedHC, setSelectedHC] = useState('all');
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [showAllDiseases, setShowAllDiseases] = useState(false);

  const { data: allHCs } = useFetch(() => api.listHealthCenters(false), []);
  const { data: series } = useFetch(
    () => (selectedHC === 'all' ? api.aggregateAnalytics(period) : api.hcAnalytics(selectedHC, period)),
    [period, selectedHC]
  );

  const q = searchQuery.toLowerCase();
  const reg = useMemo(() => (allHCs || [])
    .filter((h) => h.registered)
    .filter((h) => !q || h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q)), [allHCs, q]);

  const latest = series && series.length ? series[series.length - 1] : null;
  const sortedDiseases = useMemo(() => {
    return latest ? Object.entries(latest.diseases).sort((a, b) => b[1] - a[1]).slice(0, 6) : [];
  }, [latest]);

  // Reset selected disease / comparisons when parameters change
  const handleHCChange = (e) => {
    setSelectedHC(e.target.value);
    setSelectedDisease(null);
    setShowAllDiseases(false);
  };

  const handlePeriodChange = (p) => {
    setPeriod(p);
    setSelectedDisease(null);
    setShowAllDiseases(false);
  };

  // Line Chart Data
  const lineData = useMemo(() => {
    if (!series || !series.length) return { labels: [], datasets: [] };
    const labels = series.map((p) => p.label);

    if (showAllDiseases) {
      const datasets = sortedDiseases.map(([d, _], i) => ({
        label: d,
        data: series.map((p) => p.diseases[d] || 0),
        borderColor: chartColors.diseasePalette[i],
        backgroundColor: 'transparent',
        tension: 0.4,
        pointRadius: 3.5,
        pointBackgroundColor: chartColors.diseasePalette[i],
        borderWidth: 2,
      }));
      return { labels, datasets };
    }

    if (selectedDisease) {
      const idx = sortedDiseases.findIndex(([d, _]) => d === selectedDisease);
      const color = idx !== -1 ? chartColors.diseasePalette[idx] : '#64748b';
      return {
        labels,
        datasets: [
          {
            label: `${selectedDisease} Patients`,
            data: series.map((p) => p.diseases[selectedDisease] || 0),
            borderColor: color,
            backgroundColor: color + '22',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: color,
            borderWidth: 2.5,
          },
        ],
      };
    }

    return {
      labels,
      datasets: [
        {
          label: 'Total Patients',
          data: series.map((p) => p.total),
          borderColor: chartColors.accent,
          backgroundColor: chartColors.accentLight,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: chartColors.accent,
          borderWidth: 2.5,
        },
      ],
    };
  }, [series, showAllDiseases, selectedDisease, sortedDiseases]);

  // Line Chart Options
  const lineOptions = useMemo(() => {
    return {
      ...baseOptions,
      plugins: {
        ...baseOptions.plugins,
        legend: {
          display: showAllDiseases,
          position: 'top',
          labels: {
            color: chartColors.text,
            font: { family: 'DM Sans', size: 11 },
          },
        },
      },
    };
  }, [showAllDiseases]);

  // Doughnut Chart Options
  const donutOptionsConfig = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: { legend: { display: false } },
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const index = elements[0].index;
          if (sortedDiseases[index]) {
            const diseaseName = sortedDiseases[index][0];
            setSelectedDisease((prev) => (prev === diseaseName ? null : diseaseName));
            setShowAllDiseases(false);
          }
        }
      },
    };
  }, [sortedDiseases]);

  return (
    <div className="animate-fadeUp">
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <div className="flex gap-1 bg-bg-card border border-border rounded-xl p-1">
          {['monthly', 'daily', 'yearly'].map((p) => (
            <button key={p} className={`tab-btn ${period === p ? 'active' : ''}`} onClick={() => handlePeriodChange(p)}>
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <select className="form-select w-72" value={selectedHC} onChange={handleHCChange}>
          <option value="all">All Health Centers</option>
          {reg.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      <div className="data-card mb-5">
        <div className="data-card-header flex items-center justify-between">
          <div>
            <span className="font-bold text-[15px] font-display">Patient Trend</span>
            <span className="text-xs text-text-muted ml-2">({PERIOD_LABELS[period]})</span>
            {selectedDisease ? (
              <span className="text-xs text-accent font-bold ml-2">Selected Disease: {selectedDisease}</span>
            ) : showAllDiseases ? (
              <span className="text-xs text-info font-bold ml-2">Multi-Disease Comparison</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowAllDiseases((prev) => !prev);
                setSelectedDisease(null);
              }}
              className={`btn btn-sm ${showAllDiseases ? 'btn-primary' : 'btn-secondary'}`}
            >
              <i className="fas fa-chart-line mr-1.5" />
              {showAllDiseases ? 'Show Total Trend' : 'Compare All Diseases'}
            </button>
            {(selectedDisease || showAllDiseases) && (
              <button
                onClick={() => {
                  setSelectedDisease(null);
                  setShowAllDiseases(false);
                }}
                className="btn btn-sm btn-secondary text-danger hover:bg-danger/10"
                title="Reset Chart View"
              >
                <i className="fas fa-redo-alt" />
              </button>
            )}
          </div>
        </div>
        <div className="p-4 h-[320px]">
          {series && (
            <Line data={lineData} options={lineOptions} />
          )}
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header flex items-center justify-between">
          <div>
            <span className="font-bold text-[15px] font-display">Disease Breakdown</span>
            <span className="text-xs text-text-muted ml-2">(Latest Period)</span>
          </div>
          <span className="text-xs text-text-muted italic">Click slices or legend items to filter trend</span>
        </div>
        <div className="p-4 grid gap-6 grid-cols-2">
          <div className="h-[280px]">
            {latest && (
              <Doughnut
                data={{ labels: sortedDiseases.map((d) => d[0]), datasets: [{ data: sortedDiseases.map((d) => d[1]), backgroundColor: chartColors.diseasePalette, borderWidth: 0, hoverOffset: 6 }] }}
                options={donutOptionsConfig}
              />
            )}
          </div>
          <div className="flex flex-col gap-2 justify-center">
            {sortedDiseases.map(([d, v], i) => {
              const isSelected = selectedDisease === d;
              return (
                <div
                  key={d}
                  onClick={() => {
                    setSelectedDisease((prev) => (prev === d ? null : d));
                    setShowAllDiseases(false);
                  }}
                  className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer border transition-all ${
                    isSelected
                      ? 'border-accent bg-accent/5 font-semibold text-text-primary'
                      : 'border-transparent hover:bg-bg-secondary hover:text-text-primary text-text-secondary'
                  }`}
                >
                  <div className="w-3.5 h-3.5 min-w-3.5 rounded-sm" style={{ background: chartColors.diseasePalette[i] }} />
                  <span className="text-[13px] flex-1">{d}</span>
                  <span className="text-[13px] font-bold">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
