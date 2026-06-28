import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Candidate, Requirement, SalesForecast } from '../types';
import { peso } from '../utils/format';

export function ExecutiveDashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [forecasts, setForecasts] = useState<SalesForecast[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const [candidateRes, reqRes, forecastRes] = await Promise.all([
      supabase.from('candidates').select('*, clients(name), requirements(title), profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('requirements').select('*, clients(name)').order('created_at', { ascending: false }),
      supabase.from('sales_forecasts').select('*, clients(name), requirements(title)').order('forecast_month', { ascending: false }),
    ]);
    setCandidates((candidateRes.data || []) as unknown as Candidate[]);
    setRequirements((reqRes.data || []) as unknown as Requirement[]);
    setForecasts((forecastRes.data || []) as unknown as SalesForecast[]);
  }

  const stats = useMemo(() => {
    const openReqs = requirements.filter((r) => r.status === 'Open');
    const hires = candidates.filter((c) => c.stage === 'Hired');
    const rejected = candidates.filter((c) => c.stage === 'Rejected');
    const interviews = candidates.filter((c) => ['L1 Interview', 'L2 Interview', 'Final Interview'].includes(c.stage));
    const expected = forecasts.reduce((sum, f) => sum + Number(f.expected_revenue || 0), 0);
    const weighted = forecasts.reduce((sum, f) => sum + Number(f.expected_revenue || 0) * Number(f.probability_pct || 0) / 100, 0);
    const actual = forecasts.reduce((sum, f) => sum + Number(f.actual_revenue || 0), 0);
    const fillRate = candidates.length ? (hires.length / candidates.length) * 100 : 0;
    const rejectionRate = candidates.length ? (rejected.length / candidates.length) * 100 : 0;
    return { openReqs, hires, interviews, expected, weighted, actual, fillRate, rejectionRate };
  }, [candidates, requirements, forecasts]);

  const topClients = useMemo(() => {
    const map = new Map<string, { client: string; candidates: number; hires: number }>();
    for (const c of candidates) {
      const client = c.clients?.name || 'No Client';
      const current = map.get(client) || { client, candidates: 0, hires: 0 };
      current.candidates += 1;
      if (c.stage === 'Hired') current.hires += 1;
      map.set(client, current);
    }
    return Array.from(map.values()).sort((a, b) => b.candidates - a.candidates).slice(0, 10);
  }, [candidates]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Executive Dashboard</p>
          <h1>Business Overview</h1>
          <p className="muted">Company-wide visibility for candidate pipeline, open roles, sales forecast, and actual revenue.</p>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><p className="muted small">Candidates</p><h2>{candidates.length}</h2></div>
        <div className="stat-card"><p className="muted small">Open Requirements</p><h2>{stats.openReqs.length}</h2></div>
        <div className="stat-card"><p className="muted small">Interviews</p><h2>{stats.interviews.length}</h2></div>
        <div className="stat-card"><p className="muted small">Hires</p><h2>{stats.hires.length}</h2></div>
        <div className="stat-card"><p className="muted small">Fill Rate</p><h2>{stats.fillRate.toFixed(1)}%</h2></div>
        <div className="stat-card"><p className="muted small">Rejection Rate</p><h2>{stats.rejectionRate.toFixed(1)}%</h2></div>
        <div className="stat-card"><p className="muted small">Expected Forecast</p><h2>{peso(stats.expected)}</h2></div>
        <div className="stat-card"><p className="muted small">Weighted Forecast</p><h2>{peso(stats.weighted)}</h2></div>
        <div className="stat-card"><p className="muted small">Actual Revenue</p><h2>{peso(stats.actual)}</h2></div>
      </div>

      <section className="panel">
        <div className="panel-header"><h2>Top Clients by Candidate Pipeline</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Candidates</th><th>Hires</th></tr></thead>
            <tbody>{topClients.map((c) => <tr key={c.client}><td>{c.client}</td><td>{c.candidates}</td><td>{c.hires}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
