import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { StatCard } from '../components/StatCard';
import { supabase } from '../supabaseClient';
import type { Candidate, Requirement, SalesForecast } from '../types';
import { peso } from '../utils/format';

export function Dashboard() {
  const { profile } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [forecasts, setForecasts] = useState<SalesForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [candidateRes, reqRes, forecastRes] = await Promise.all([
      supabase.from('candidates').select('*, clients(name), requirements(title), profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('requirements').select('*, clients(name)').order('created_at', { ascending: false }),
      supabase.from('sales_forecasts').select('*, clients(name), requirements(title)').order('forecast_month', { ascending: false }),
    ]);
    setCandidates((candidateRes.data || []) as unknown as Candidate[]);
    setRequirements((reqRes.data || []) as unknown as Requirement[]);
    setForecasts((forecastRes.data || []) as unknown as SalesForecast[]);
    setLoading(false);
  }

  const stats = useMemo(() => {
    const myCandidates = candidates.filter((c) => c.recruiter_id === profile?.id || c.created_by === profile?.id);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthCandidates = candidates.filter((c) => new Date(c.created_at) >= monthStart);
    const monthMine = myCandidates.filter((c) => new Date(c.created_at) >= monthStart);
    const openRequirements = requirements.filter((r) => r.status === 'Open');
    const weightedForecast = forecasts.reduce((sum, f) => sum + (Number(f.expected_revenue) * Number(f.probability_pct) / 100), 0);

    return { myCandidates, monthCandidates, monthMine, openRequirements, weightedForecast };
  }, [candidates, requirements, forecasts, profile?.id]);

  const stageCounts = candidates.reduce<Record<string, number>>((acc, candidate) => {
    acc[candidate.stage] = (acc[candidate.stage] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Recruiter Module</p>
          <h1>Dashboard</h1>
          <p className="muted">Live candidate pipeline, monthly activity, open requirements, and revenue forecast.</p>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      {loading ? <p>Loading...</p> : (
        <>
          <div className="stat-grid">
            <StatCard title="My Total Candidates" value={stats.myCandidates.length} subtitle="All-time assigned/sourced" />
            <StatCard title="My Candidates This Month" value={stats.monthMine.length} subtitle="Timestamp-based" />
            <StatCard title="Company Candidates This Month" value={stats.monthCandidates.length} subtitle="All recruiters" />
            <StatCard title="Open Requirements" value={stats.openRequirements.length} subtitle={`${requirements.length} total requirements`} />
            <StatCard title="Weighted Revenue Forecast" value={peso(stats.weightedForecast)} subtitle="Expected revenue x probability" />
          </div>

          <section className="panel">
            <div className="panel-header">
              <h2>Pipeline by Stage</h2>
            </div>
            <div className="stage-grid">
              {Object.entries(stageCounts).map(([stage, count]) => (
                <div className="stage-card" key={stage}>
                  <span>{stage}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Latest Candidates</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Stage</th><th>Client</th><th>Requirement</th><th>Timestamp</th></tr>
                </thead>
                <tbody>
                  {candidates.slice(0, 8).map((c) => (
                    <tr key={c.id}>
                      <td>{c.first_name} {c.last_name}</td>
                      <td><span className="pill">{c.stage}</span></td>
                      <td>{c.clients?.name || '-'}</td>
                      <td>{c.requirements?.title || '-'}</td>
                      <td>{new Date(c.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
