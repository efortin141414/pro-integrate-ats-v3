import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../supabaseClient';
import type { Client, Requirement } from '../types';
import { dateTime, peso } from '../utils/format';

type ClientForm = {
  name: string;
  industry: string;
  contact_person: string;
  contact_email: string;
};

type RequirementForm = {
  client_id: string;
  title: string;
  headcount: string;
  priority: string;
  status: 'Open' | 'On Hold' | 'Closed' | 'Cancelled';
  budget_min: string;
  budget_max: string;
  placement_fee_pct: string;
  admin_fee_pct: string;
  expected_start_date: string;
};

const blankClient: ClientForm = { name: '', industry: '', contact_person: '', contact_email: '' };
const blankReq: RequirementForm = {
  client_id: '', title: '', headcount: '1', priority: 'Medium', status: 'Open', budget_min: '', budget_max: '', placement_fee_pct: '8.33', admin_fee_pct: '0', expected_start_date: ''
};

export function Requirements() {
  const { profile, hasRole } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [clientForm, setClientForm] = useState<ClientForm>(blankClient);
  const [reqForm, setReqForm] = useState<RequirementForm>(blankReq);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [clientRes, reqRes] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('requirements').select('*, clients(name)').order('created_at', { ascending: false }),
    ]);
    setClients((clientRes.data || []) as Client[]);
    setRequirements((reqRes.data || []) as unknown as Requirement[]);
  }

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const { error } = await supabase.from('clients').insert({ ...clientForm, owner_id: profile.id });
    if (error) setMessage(error.message);
    else {
      setClientForm(blankClient);
      setMessage('Client saved.');
      await load();
    }
  }

  async function createRequirement(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    let jd_storage_path: string | null = null;
    if (jdFile) {
      const safeName = jdFile.name.replace(/[^a-z0-9._-]/gi, '_');
      jd_storage_path = `${profile.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('jds').upload(jd_storage_path, jdFile);
      if (uploadError) {
        setMessage(uploadError.message);
        return;
      }
    }

    const payload = {
      client_id: reqForm.client_id || null,
      title: reqForm.title,
      headcount: Number(reqForm.headcount || 1),
      priority: reqForm.priority,
      status: reqForm.status,
      budget_min: reqForm.budget_min ? Number(reqForm.budget_min) : null,
      budget_max: reqForm.budget_max ? Number(reqForm.budget_max) : null,
      placement_fee_pct: Number(reqForm.placement_fee_pct || 0),
      admin_fee_pct: Number(reqForm.admin_fee_pct || 0),
      expected_start_date: reqForm.expected_start_date || null,
      jd_storage_path,
      created_by: profile.id,
    };

    const { error } = await supabase.from('requirements').insert(payload);
    if (error) setMessage(error.message);
    else {
      setReqForm(blankReq);
      setJdFile(null);
      setMessage('Requirement/JD saved.');
      await load();
    }
  }

  async function deleteRequirement(id: string) {
    if (!confirm('Delete this requirement?')) return;
    const { error } = await supabase.from('requirements').delete().eq('id', id);
    if (error) setMessage(error.message);
    else await load();
  }

  async function deleteClient(id: string) {
    if (!confirm('Delete this client?')) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) setMessage(error.message);
    else await load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Recruitment Manager / Sales Module</p>
          <h1>Clients and Requirements</h1>
          <p className="muted">Create clients, upload JD files, add salary budget, fees, and expected start dates.</p>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      {message && <p className="notice">{message}</p>}

      <div className="two-col">
        <section className="panel">
          <div className="panel-header"><h2>Add Client</h2></div>
          <form className="form-stack" onSubmit={createClient}>
            <label>Client Name<input required value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} /></label>
            <label>Industry<input value={clientForm.industry} onChange={(e) => setClientForm({ ...clientForm, industry: e.target.value })} /></label>
            <label>Contact Person<input value={clientForm.contact_person} onChange={(e) => setClientForm({ ...clientForm, contact_person: e.target.value })} /></label>
            <label>Contact Email<input type="email" value={clientForm.contact_email} onChange={(e) => setClientForm({ ...clientForm, contact_email: e.target.value })} /></label>
            <button type="submit">Save Client</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header"><h2>Add Requirement / JD</h2></div>
          <form className="grid-form" onSubmit={createRequirement}>
            <label>Client<select required value={reqForm.client_id} onChange={(e) => setReqForm({ ...reqForm, client_id: e.target.value })}><option value="">Select client</option>{clients.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
            <label>Position Title<input required value={reqForm.title} onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })} /></label>
            <label>Headcount<input type="number" min="1" value={reqForm.headcount} onChange={(e) => setReqForm({ ...reqForm, headcount: e.target.value })} /></label>
            <label>Priority<select value={reqForm.priority} onChange={(e) => setReqForm({ ...reqForm, priority: e.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
            <label>Status<select value={reqForm.status} onChange={(e) => setReqForm({ ...reqForm, status: e.target.value as RequirementForm['status'] })}><option>Open</option><option>On Hold</option><option>Closed</option><option>Cancelled</option></select></label>
            <label>Budget Min<input type="number" value={reqForm.budget_min} onChange={(e) => setReqForm({ ...reqForm, budget_min: e.target.value })} /></label>
            <label>Budget Max<input type="number" value={reqForm.budget_max} onChange={(e) => setReqForm({ ...reqForm, budget_max: e.target.value })} /></label>
            <label>Placement Fee %<input type="number" step="0.01" value={reqForm.placement_fee_pct} onChange={(e) => setReqForm({ ...reqForm, placement_fee_pct: e.target.value })} /></label>
            <label>Admin Fee %<input type="number" step="0.01" value={reqForm.admin_fee_pct} onChange={(e) => setReqForm({ ...reqForm, admin_fee_pct: e.target.value })} /></label>
            <label>Expected Start Date<input type="date" value={reqForm.expected_start_date} onChange={(e) => setReqForm({ ...reqForm, expected_start_date: e.target.value })} /></label>
            <label>JD Upload<input type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => setJdFile(e.target.files?.[0] || null)} /></label>
            <div className="form-actions"><button type="submit">Save Requirement</button></div>
          </form>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header"><h2>Requirements List</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Title</th><th>HC</th><th>Status</th><th>Budget</th><th>Fee %</th><th>Expected Date</th><th>Timestamp</th><th>Action</th></tr></thead>
            <tbody>{requirements.map((r) => (
              <tr key={r.id}>
                <td>{r.clients?.name || '-'}</td><td>{r.title}</td><td>{r.headcount}</td><td><span className="pill">{r.status}</span></td>
                <td>{peso(r.budget_min)} - {peso(r.budget_max)}</td><td>{r.placement_fee_pct}% + {r.admin_fee_pct}%</td><td>{r.expected_start_date || '-'}</td><td>{dateTime(r.created_at)}</td>
                <td>{hasRole(['admin']) && <button className="danger" onClick={() => deleteRequirement(r.id)}>Delete</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>Clients List</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Industry</th><th>Contact</th><th>Status</th><th>Timestamp</th><th>Action</th></tr></thead>
            <tbody>{clients.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.industry || '-'}</td><td>{c.contact_person || '-'}<br /><span className="small muted">{c.contact_email || ''}</span></td><td>{c.status}</td><td>{dateTime(c.created_at)}</td>
                <td>{hasRole(['admin']) && <button className="danger" onClick={() => deleteClient(c.id)}>Delete</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
