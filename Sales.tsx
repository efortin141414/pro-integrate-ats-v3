import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../supabaseClient';
import type { Client, Requirement, SalesForecast } from '../types';
import { dateOnly, peso } from '../utils/format';

type ForecastForm = {
  client_id: string;
  requirement_id: string;
  forecast_month: string;
  probability_pct: string;
  expected_revenue: string;
  actual_revenue: string;
};

const blankForecast: ForecastForm = {
  client_id: '',
  requirement_id: '',
  forecast_month: new Date().toISOString().slice(0, 7),
  probability_pct: '50',
  expected_revenue: '',
  actual_revenue: '0',
};

export function Sales() {
  const { profile, hasRole } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [forecasts, setForecasts] = useState<SalesForecast[]>([]);
  const [form, setForm] = useState<ForecastForm>(blankForecast);
  const [message, setMessage] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [clientRes, reqRes, forecastRes] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('requirements').select('*, clients(name)').order('created_at', { ascending: false }),
      supabase.from('sales_forecasts').select('*, clients(name), requirements(title)').order('forecast_month', { ascending: false }),
    ]);
    setClients((clientRes.data || []) as Client[]);
    setRequirements((reqRes.data || []) as unknown as Requirement[]);
    setForecasts((forecastRes.data || []) as unknown as SalesForecast[]);
  }

  function calculateFromRequirement(requirementId: string) {
    const req = requirements.find((r) => r.id === requirementId);
    if (!req) return;
    const budget = Number(req.budget_max || req.budget_min || 0);
    const expected = budget * Number(req.headcount || 1) * ((Number(req.placement_fee_pct || 0) + Number(req.admin_fee_pct || 0)) / 100);
    setForm((prev) => ({ ...prev, requirement_id: requirementId, client_id: req.client_id || prev.client_id, expected_revenue: expected.toFixed(2) }));
  }

  async function createForecast(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const monthDate = `${form.forecast_month}-01`;
    const { error } = await supabase.from('sales_forecasts').insert({
      client_id: form.client_id || null,
      requirement_id: form.requirement_id || null,
      forecast_month: monthDate,
      probability_pct: Number(form.probability_pct || 0),
      expected_revenue: Number(form.expected_revenue || 0),
      actual_revenue: Number(form.actual_revenue || 0),
      owner_id: profile.id,
    });
    if (error) setMessage(error.message);
    else {
      setMessage('Sales forecast saved with timestamp.');
      setForm(blankForecast);
      await load();
    }
  }

  async function deleteForecast(id: string) {
    if (!confirm('Delete this forecast?')) return;
    const { error } = await supabase.from('sales_forecasts').delete().eq('id', id);
    if (error) setMessage(error.message);
    else await load();
  }

  const totals = useMemo(() => {
    const expected = forecasts.reduce((sum, f) => sum + Number(f.expected_revenue || 0), 0);
    const weighted = forecasts.reduce((sum, f) => sum + Number(f.expected_revenue || 0) * Number(f.probability_pct || 0) / 100, 0);
    const actual = forecasts.reduce((sum, f) => sum + Number(f.actual_revenue || 0), 0);
    return { expected, weighted, actual };
  }, [forecasts]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Sales Module</p>
          <h1>Revenue Forecast</h1>
          <p className="muted">Forecast sales revenue using requirements, salary budget, placement fee, admin fee, and probability.</p>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><p className="muted small">Total Expected Revenue</p><h2>{peso(totals.expected)}</h2></div>
        <div className="stat-card"><p className="muted small">Weighted Forecast</p><h2>{peso(totals.weighted)}</h2></div>
        <div className="stat-card"><p className="muted small">Actual Revenue</p><h2>{peso(totals.actual)}</h2></div>
      </div>

      {message && <p className="notice">{message}</p>}

      <section className="panel">
        <div className="panel-header"><h2>Add Forecast</h2></div>
        <form className="grid-form" onSubmit={createForecast}>
          <label>Client<select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}><option value="">Select client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Requirement<select value={form.requirement_id} onChange={(e) => calculateFromRequirement(e.target.value)}><option value="">Optional</option>{requirements.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
          <label>Forecast Month<input type="month" value={form.forecast_month} onChange={(e) => setForm({ ...form, forecast_month: e.target.value })} required /></label>
          <label>Probability %<input type="number" min="0" max="100" step="0.01" value={form.probability_pct} onChange={(e) => setForm({ ...form, probability_pct: e.target.value })} /></label>
          <label>Expected Revenue<input type="number" step="0.01" value={form.expected_revenue} onChange={(e) => setForm({ ...form, expected_revenue: e.target.value })} required /></label>
          <label>Actual Revenue<input type="number" step="0.01" value={form.actual_revenue} onChange={(e) => setForm({ ...form, actual_revenue: e.target.value })} /></label>
          <div className="form-actions"><button type="submit">Save Forecast</button></div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>Forecast Records</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Month</th><th>Client</th><th>Requirement</th><th>Probability</th><th>Expected</th><th>Weighted</th><th>Actual</th><th>Timestamp</th><th>Action</th></tr></thead>
            <tbody>{forecasts.map((f) => (
              <tr key={f.id}>
                <td>{dateOnly(f.forecast_month)}</td><td>{f.clients?.name || '-'}</td><td>{f.requirements?.title || '-'}</td><td>{f.probability_pct}%</td><td>{peso(f.expected_revenue)}</td><td>{peso(Number(f.expected_revenue) * Number(f.probability_pct) / 100)}</td><td>{peso(f.actual_revenue)}</td><td>{dateOnly(f.created_at)}</td>
                <td>{hasRole(['admin']) && <button className="danger" onClick={() => deleteForecast(f.id)}>Delete</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
