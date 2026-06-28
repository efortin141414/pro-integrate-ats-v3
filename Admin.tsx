import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { AppRole, Profile } from '../types';
import { dateTime } from '../utils/format';

const roles: AppRole[] = ['recruiter', 'recruitment_manager', 'sales', 'executive', 'admin'];

export function Admin() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) setMessage(error.message);
    setProfiles((data || []) as Profile[]);
  }

  async function updateProfile(id: string, changes: Partial<Profile>) {
    const { error } = await supabase.from('profiles').update(changes).eq('id', id);
    if (error) setMessage(error.message);
    else {
      setMessage('User access updated.');
      await load();
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin Module</p>
          <h1>Admin Control Center</h1>
          <p className="muted">Admin can control user roles, account activity, and access across all modules.</p>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      {message && <p className="notice">{message}</p>}

      <section className="panel">
        <div className="panel-header"><h2>User Role Assignment</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Updated</th></tr></thead>
            <tbody>{profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.full_name || '-'}</td>
                <td>{p.email}</td>
                <td><select value={p.role} onChange={(e) => updateProfile(p.id, { role: e.target.value as AppRole })}>{roles.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}</select></td>
                <td><button className={p.is_active ? 'secondary' : 'danger'} onClick={() => updateProfile(p.id, { is_active: !p.is_active })}>{p.is_active ? 'Active' : 'Inactive'}</button></td>
                <td>{dateTime(p.created_at)}</td><td>{dateTime(p.updated_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>Module Access Map</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Role</th><th>Main Access</th></tr></thead>
            <tbody>
              <tr><td>Recruiter</td><td>Recruiter dashboard, candidate database, CV parser, stage updates, reports.</td></tr>
              <tr><td>Recruitment Manager</td><td>Team productivity, all candidates, requirements/JD, sales forecast, reports, executive view.</td></tr>
              <tr><td>Sales</td><td>Sales forecast, requirements/JD, candidate visibility, reports.</td></tr>
              <tr><td>Executive</td><td>Executive dashboard, sales forecast visibility, reports.</td></tr>
              <tr><td>Admin</td><td>Everything, including role assignment, activation/deactivation, and delete controls.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
