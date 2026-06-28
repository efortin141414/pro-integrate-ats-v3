import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Candidate, Placement, Profile } from '../types';
import { peso } from '../utils/format';

export function RecruitmentManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [profileRes, candidateRes, placementRes] = await Promise.all([
      supabase.from('profiles').select('*').in('role', ['recruiter', 'recruitment_manager']).order('full_name'),
      supabase.from('candidates').select('*, clients(name), requirements(title), profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('placements').select('*').order('placement_date', { ascending: false }),
    ]);
    if (profileRes.error || candidateRes.error || placementRes.error) setMessage(profileRes.error?.message || candidateRes.error?.message || placementRes.error?.message || 'Unable to load manager data.');
    setProfiles((profileRes.data || []) as Profile[]);
    setCandidates((candidateRes.data || []) as unknown as Candidate[]);
    setPlacements((placementRes.data || []) as Placement[]);
  }

  const rows = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return profiles.map((p) => {
      const owned = candidates.filter((c) => c.recruiter_id === p.id || c.created_by === p.id);
      const byDate = (from: Date) => owned.filter((c) => new Date(c.created_at) >= from);
      const hired = owned.filter((c) => c.stage === 'Hired');
      const revenue = placements
        .filter((pl) => owned.some((c) => c.id === pl.candidate_id))
        .reduce((sum, pl) => sum + Number(pl.actual_revenue || 0), 0);

      return {
        recruiter: p.full_name || p.email,
        total: owned.length,
        monthly: byDate(monthStart).length,
        quarterly: byDate(quarterStart).length,
        yearly: byDate(yearStart).length,
        endorsed: owned.filter((c) => c.stage === 'Endorsed').length,
        interviews: owned.filter((c) => ['L1 Interview', 'L2 Interview', 'Final Interview'].includes(c.stage)).length,
        hired: hired.length,
        revenue,
      };
    });
  }, [profiles, candidates, placements]);

  const totals = rows.reduce((acc, r) => ({
    total: acc.total + r.total,
    monthly: acc.monthly + r.monthly,
    quarterly: acc.quarterly + r.quarterly,
    yearly: acc.yearly + r.yearly,
    hired: acc.hired + r.hired,
    revenue: acc.revenue + r.revenue,
  }), { total: 0, monthly: 0, quarterly: 0, yearly: 0, hired: 0, revenue: 0 });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Recruitment Manager Module</p>
          <h1>Team Productivity</h1>
          <p className="muted">Monitor individual performance, monthly/quarterly/yearly production, hires, and revenue.</p>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      {message && <p className="notice">{message}</p>}

      <div className="stat-grid">
        <div className="stat-card"><p className="muted small">Total Candidates</p><h2>{totals.total}</h2></div>
        <div className="stat-card"><p className="muted small">This Month</p><h2>{totals.monthly}</h2></div>
        <div className="stat-card"><p className="muted small">This Quarter</p><h2>{totals.quarterly}</h2></div>
        <div className="stat-card"><p className="muted small">This Year</p><h2>{totals.yearly}</h2></div>
        <div className="stat-card"><p className="muted small">Hires</p><h2>{totals.hired}</h2></div>
        <div className="stat-card"><p className="muted small">Revenue</p><h2>{peso(totals.revenue)}</h2></div>
      </div>

      <section className="panel">
        <div className="panel-header"><h2>Individual Recruiter Performance</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Recruiter</th><th>Total</th><th>Monthly</th><th>Quarterly</th><th>Yearly</th><th>Endorsed</th><th>Interviews</th><th>Hired</th><th>Revenue</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.recruiter}><td>{r.recruiter}</td><td>{r.total}</td><td>{r.monthly}</td><td>{r.quarterly}</td><td>{r.yearly}</td><td>{r.endorsed}</td><td>{r.interviews}</td><td>{r.hired}</td><td>{peso(r.revenue)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
