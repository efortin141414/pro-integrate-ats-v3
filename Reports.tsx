import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../supabaseClient';
import type { Candidate, Profile, SalesForecast } from '../types';
import { csvDownload, peso } from '../utils/format';

type Period = 'monthly' | 'quarterly' | 'yearly';

type ReportRow = {
  recruiter: string;
  period: string;
  candidates: number;
  screening: number;
  endorsed: number;
  interviews: number;
  offered: number;
  hired: number;
  rejected: number;
  expected_revenue: string;
  actual_revenue: string;
  generated_at: string;
};

export function Reports() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<Period>('monthly');
  const [periodValue, setPeriodValue] = useState(new Date().toISOString().slice(0, 7));
  const [recruiterId, setRecruiterId] = useState('all');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [forecasts, setForecasts] = useState<SalesForecast[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [profileRes, candidateRes, forecastRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('candidates').select('*, profiles(full_name), clients(name), requirements(title)').order('created_at', { ascending: false }),
      supabase.from('sales_forecasts').select('*, clients(name), requirements(title)').order('forecast_month', { ascending: false }),
    ]);
    setProfiles((profileRes.data || []) as Profile[]);
    setCandidates((candidateRes.data || []) as unknown as Candidate[]);
    setForecasts((forecastRes.data || []) as unknown as SalesForecast[]);
  }

  function getRange() {
    let start: Date;
    let end: Date;
    let label = periodValue;

    if (period === 'monthly') {
      const [y, m] = periodValue.split('-').map(Number);
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 1);
      label = start.toLocaleString('en-PH', { month: 'long', year: 'numeric' });
    } else if (period === 'quarterly') {
      const [y, q] = periodValue.split('-Q').map(Number);
      const startMonth = (q - 1) * 3;
      start = new Date(y, startMonth, 1);
      end = new Date(y, startMonth + 3, 1);
      label = `Q${q} ${y}`;
    } else {
      const y = Number(periodValue);
      start = new Date(y, 0, 1);
      end = new Date(y + 1, 0, 1);
      label = `${y}`;
    }

    return { start, end, label };
  }

  const rows = useMemo<ReportRow[]>(() => {
    const { start, end, label } = getRange();
    const selectedProfiles = profiles.filter((p) => recruiterId === 'all' || p.id === recruiterId);
    const generatedAt = new Date().toLocaleString();
    const monthKey = start.toISOString().slice(0, 7);
    const filteredForecasts = forecasts.filter((f) => f.forecast_month?.slice(0, 7) === monthKey || period !== 'monthly');

    return selectedProfiles.map((p) => {
      const owned = candidates.filter((c) =>
        (c.recruiter_id === p.id || c.created_by === p.id) &&
        new Date(c.created_at) >= start &&
        new Date(c.created_at) < end
      );
      const interviews = owned.filter((c) => ['L1 Interview', 'L2 Interview', 'Final Interview'].includes(c.stage)).length;
      const expected = filteredForecasts.reduce((sum, f) => sum + Number(f.expected_revenue || 0) * Number(f.probability_pct || 0) / 100, 0);
      const actual = filteredForecasts.reduce((sum, f) => sum + Number(f.actual_revenue || 0), 0);

      return {
        recruiter: p.full_name || p.email,
        period: label,
        candidates: owned.length,
        screening: owned.filter((c) => c.stage === 'Screening').length,
        endorsed: owned.filter((c) => c.stage === 'Endorsed').length,
        interviews,
        offered: owned.filter((c) => c.stage === 'Offered').length,
        hired: owned.filter((c) => c.stage === 'Hired').length,
        rejected: owned.filter((c) => c.stage === 'Rejected').length,
        expected_revenue: peso(expected),
        actual_revenue: peso(actual),
        generated_at: generatedAt,
      };
    });
  }, [period, periodValue, profiles, recruiterId, candidates, forecasts]);

  async function logAndExport() {
    if (!profile) return;
    await supabase.from('report_logs').insert({
      report_type: period,
      filters: { periodValue, recruiterId },
      generated_by: profile.id,
    });
    csvDownload(`pro-integrate-${period}-report-${Date.now()}.csv`, rows);
    setMessage('Report generated, timestamp logged, and CSV exported.');
  }

  function changePeriod(next: Period) {
    setPeriod(next);
    const now = new Date();
    if (next === 'monthly') setPeriodValue(now.toISOString().slice(0, 7));
    if (next === 'quarterly') setPeriodValue(`${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`);
    if (next === 'yearly') setPeriodValue(`${now.getFullYear()}`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reports Module</p>
          <h1>Monthly, Quarterly, and Yearly Reports</h1>
          <p className="muted">Generate timestamped CSV reports by recruiter or for the full team.</p>
        </div>
        <button onClick={logAndExport}>Export CSV</button>
      </div>

      {message && <p className="notice">{message}</p>}

      <section className="panel">
        <div className="grid-form reports-filter">
          <label>Report Type<select value={period} onChange={(e) => changePeriod(e.target.value as Period)}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label>
          <label>Period Value<input value={periodValue} onChange={(e) => setPeriodValue(e.target.value)} placeholder={period === 'quarterly' ? '2026-Q1' : period === 'yearly' ? '2026' : '2026-06'} /></label>
          <label>Recruiter<select value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)}><option value="all">All</option>{profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>Report Preview</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Recruiter</th><th>Period</th><th>Candidates</th><th>Screening</th><th>Endorsed</th><th>Interviews</th><th>Offered</th><th>Hired</th><th>Rejected</th><th>Expected Rev.</th><th>Actual Rev.</th><th>Generated At</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={`${r.recruiter}-${r.period}`}><td>{r.recruiter}</td><td>{r.period}</td><td>{r.candidates}</td><td>{r.screening}</td><td>{r.endorsed}</td><td>{r.interviews}</td><td>{r.offered}</td><td>{r.hired}</td><td>{r.rejected}</td><td>{r.expected_revenue}</td><td>{r.actual_revenue}</td><td>{r.generated_at}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
