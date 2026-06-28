import { useState } from 'react';
import { supabase } from '../supabaseClient';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage(error.message);
    else setMessage('Password updated. You can now sign in.');
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <img src="/pro-integrate-logo.png" alt="Pro Integrate" className="auth-logo" />
        <h1>Reset password</h1>
        <form onSubmit={submit} className="form-stack">
          <label>
            New password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          </label>
          <button disabled={busy}>{busy ? 'Saving...' : 'Update password'}</button>
        </form>
        {message && <p className="notice">{message}</p>}
      </section>
    </main>
  );
}
