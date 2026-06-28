import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../supabaseClient';
import type { Candidate, CandidateStage, Client, Requirement } from '../types';
import { STAGES } from '../types';
import { parseCV } from '../utils/cvParser';
import { dateTime } from '../utils/format';

type CandidateForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  location: string;
  current_salary: string;
  expected_salary: string;
  source: string;
  stage: CandidateStage;
  client_id: string;
  requirement_id: string;
};

const blankForm: CandidateForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  location: '',
  current_salary: '',
  expected_salary: '',
  source: 'Job Portal',
  stage: 'New',
  client_id: '',
  requirement_id: '',
};

export function Candidates() {
  const { profile, hasRole } = useAuth();
  const [form, setForm] = useState<CandidateForm>(blankForm);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [parsedText, setParsedText] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [message, setMessage] = useState('');
  const [duplicates, setDuplicates] = useState<Candidate[]>([]);
  const [pendingDuplicateSave, setPendingDuplicateSave] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [candidateRes, clientRes, reqRes] = await Promise.all([
      supabase.from('candidates').select('*, clients(name), requirements(title), profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('requirements').select('*, clients(name)').order('title'),
    ]);
    setCandidates((candidateRes.data || []) as unknown as Candidate[]);
    setClients((clientRes.data || []) as Client[]);
    setRequirements((reqRes.data || []) as unknown as Requirement[]);
  }

  function setValue<K extends keyof CandidateForm>(key: K, value: CandidateForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCV(file: File | null) {
    setCvFile(file);
    setMessage('');
    if (!file) return;
    try {
      setMessage('Parsing CV...');
      const parsed = await parseCV(file);
      setParsedText(parsed.rawText);
      setForm((prev) => ({
        ...prev,
        first_name: prev.first_name || parsed.first_name || '',
        last_name: prev.last_name || parsed.last_name || '',
        email: prev.email || parsed.email || '',
        phone: prev.phone || parsed.phone || '',
        location: prev.location || parsed.location || '',
      }));
      setMessage('CV parsed. Please review the extracted details before saving.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to parse CV.');
    }
  }

  async function findDuplicates() {
    const found: Candidate[] = [];
    const normalizedEmail = form.email.trim().toLowerCase();
    const normalizedPhone = form.phone.trim();

    if (normalizedEmail) {
      const { data } = await supabase.from('candidates').select('*, clients(name), requirements(title), profiles(full_name)').ilike('email', normalizedEmail).limit(10);
      found.push(...((data || []) as unknown as Candidate[]));
    }

    if (normalizedPhone) {
      const { data } = await supabase.from('candidates').select('*, clients(name), requirements(title), profiles(full_name)').eq('phone', normalizedPhone).limit(10);
      for (const item of (data || []) as unknown as Candidate[]) {
        if (!found.some((candidate) => candidate.id === item.id)) found.push(item);
      }
    }

    return found;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const duplicateRows = await findDuplicates();

    if (duplicateRows.length > 0 && !pendingDuplicateSave) {
      setDuplicates(duplicateRows);
      setMessage('Duplicate candidate detected. Review the prompt below before continuing.');
      return;
    }

    await saveCandidate(duplicates[0]?.id || null);
  }

  async function saveCandidate(duplicateOf: string | null) {
    if (!profile) return;
    let cv_storage_path: string | null = null;

    if (cvFile) {
      const safeName = cvFile.name.replace(/[^a-z0-9._-]/gi, '_');
      cv_storage_path = `${profile.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('cvs').upload(cv_storage_path, cvFile);
      if (uploadError) {
        setMessage(uploadError.message);
        return;
      }
    }

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase() || null,
      phone: form.phone.trim() || null,
      location: form.location.trim() || null,
      current_salary: form.current_salary ? Number(form.current_salary) : null,
      expected_salary: form.expected_salary ? Number(form.expected_salary) : null,
      source: form.source || null,
      stage: form.stage,
      client_id: form.client_id || null,
      requirement_id: form.requirement_id || null,
      recruiter_id: profile.id,
      created_by: profile.id,
      cv_storage_path,
      parsed_cv_text: parsedText || null,
      duplicate_of: duplicateOf,
    };

    const { data, error } = await supabase.from('candidates').insert(payload).select().single();
    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from('candidate_stage_history').insert({
      candidate_id: data.id,
      new_stage: form.stage,
      changed_by: profile.id,
      note: duplicateOf ? 'Created after duplicate prompt override.' : 'Candidate created.',
    });

    setForm(blankForm);
    setCvFile(null);
    setParsedText('');
    setDuplicates([]);
    setPendingDuplicateSave(false);
    setMessage('Candidate saved successfully with timestamp.');
    await load();
  }

  async function updateStage(candidate: Candidate, stage: CandidateStage) {
    if (!profile) return;
    const oldStage = candidate.stage;
    const { error } = await supabase.from('candidates').update({ stage }).eq('id', candidate.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await supabase.from('candidate_stage_history').insert({
      candidate_id: candidate.id,
      old_stage: oldStage,
      new_stage: stage,
      changed_by: profile.id,
      note: 'Stage changed from candidate list.',
    });
    await load();
  }

  async function deleteCandidate(id: string) {
    if (!confirm('Delete this candidate? This is only allowed for Admin.')) return;
    const { error } = await supabase.from('candidates').delete().eq('id', id);
    if (error) setMessage(error.message);
    else await load();
  }

  const filtered = useMemo(() => candidates.filter((c) => {
    const text = `${c.first_name} ${c.last_name} ${c.email || ''} ${c.phone || ''} ${c.stage} ${c.clients?.name || ''} ${c.requirements?.title || ''}`.toLowerCase();
    return text.includes(search.toLowerCase());
  }), [candidates, search]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Recruiter Module</p>
          <h1>Candidate Database</h1>
          <p className="muted">Upload CV, parse candidate details, detect duplicates, and move candidates across stages.</p>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      <section className="panel">
        <div className="panel-header"><h2>Candidate Form with CV Parser</h2></div>
        <form onSubmit={submit} className="grid-form">
          <label>CV Upload PDF/DOCX/TXT
            <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => handleCV(e.target.files?.[0] || null)} />
          </label>
          <label>First Name<input required value={form.first_name} onChange={(e) => setValue('first_name', e.target.value)} /></label>
          <label>Last Name<input required value={form.last_name} onChange={(e) => setValue('last_name', e.target.value)} /></label>
          <label>Email<input type="email" value={form.email} onChange={(e) => setValue('email', e.target.value)} /></label>
          <label>Phone<input value={form.phone} onChange={(e) => setValue('phone', e.target.value)} /></label>
          <label>Location<input value={form.location} onChange={(e) => setValue('location', e.target.value)} /></label>
          <label>Current Salary<input type="number" value={form.current_salary} onChange={(e) => setValue('current_salary', e.target.value)} /></label>
          <label>Expected Salary<input type="number" value={form.expected_salary} onChange={(e) => setValue('expected_salary', e.target.value)} /></label>
          <label>Source
            <select value={form.source} onChange={(e) => setValue('source', e.target.value)}>
              <option>Referral</option><option>Job Portal</option><option>Agency</option><option>Direct</option><option>LinkedIn</option><option>Facebook</option>
            </select>
          </label>
          <label>Stage
            <select value={form.stage} onChange={(e) => setValue('stage', e.target.value as CandidateStage)}>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>Client
            <select value={form.client_id} onChange={(e) => setValue('client_id', e.target.value)}>
              <option value="">No client yet</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Requirement
            <select value={form.requirement_id} onChange={(e) => setValue('requirement_id', e.target.value)}>
              <option value="">No requirement yet</option>
              {requirements.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </label>
          <div className="form-actions"><button type="submit">Save Candidate</button></div>
        </form>
        {message && <p className="notice">{message}</p>}

        {duplicates.length > 0 && (
          <div className="duplicate-box">
            <h3>Duplicate candidate prompt</h3>
            <p>This candidate appears to already exist. You may cancel or continue and link the new record to the duplicate.</p>
            <ul>
              {duplicates.map((d) => <li key={d.id}>{d.first_name} {d.last_name} — {d.email || d.phone || 'No contact'} — {d.stage}</li>)}
            </ul>
            <button className="secondary" onClick={() => { setDuplicates([]); setPendingDuplicateSave(false); }}>Cancel Save</button>
            <button onClick={() => { setPendingDuplicateSave(true); saveCandidate(duplicates[0].id); }}>Continue and Link Duplicate</button>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>All Candidates</h2>
          <input className="search" placeholder="Search candidates..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Contact</th><th>Stage</th><th>Client</th><th>Requirement</th><th>Recruiter</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className={c.duplicate_of ? 'duplicate-row' : ''}>
                  <td>{c.first_name} {c.last_name}{c.duplicate_of && <span className="warning"> duplicate-linked</span>}</td>
                  <td>{c.email || '-'}<br /><span className="muted small">{c.phone || '-'}</span></td>
                  <td><select value={c.stage} onChange={(e) => updateStage(c, e.target.value as CandidateStage)}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></td>
                  <td>{c.clients?.name || '-'}</td>
                  <td>{c.requirements?.title || '-'}</td>
                  <td>{c.profiles?.full_name || '-'}</td>
                  <td>{dateTime(c.created_at)}</td>
                  <td>{hasRole(['admin']) && <button className="danger" onClick={() => deleteCandidate(c.id)}>Delete</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
