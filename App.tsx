import { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Admin } from './pages/Admin';
import { AuthPage } from './pages/AuthPage';
import { Candidates } from './pages/Candidates';
import { Dashboard } from './pages/Dashboard';
import { ExecutiveDashboard } from './pages/ExecutiveDashboard';
import { RecruitmentManager } from './pages/RecruitmentManager';
import { Reports } from './pages/Reports';
import { Requirements } from './pages/Requirements';
import { ResetPassword } from './pages/ResetPassword';
import { Sales } from './pages/Sales';
import type { AppRole } from './types';

const pageRoles: Record<string, AppRole[]> = {
  dashboard: ['recruiter', 'recruitment_manager', 'sales', 'admin'],
  candidates: ['recruiter', 'recruitment_manager', 'sales', 'admin'],
  requirements: ['recruitment_manager', 'sales', 'admin'],
  manager: ['recruitment_manager', 'admin'],
  sales: ['sales', 'recruitment_manager', 'executive', 'admin'],
  executive: ['executive', 'recruitment_manager', 'admin'],
  reports: ['recruiter', 'recruitment_manager', 'sales', 'executive', 'admin'],
  admin: ['admin'],
};

function defaultPageForRole(role: AppRole) {
  if (role === 'executive') return 'executive';
  if (role === 'admin') return 'admin';
  if (role === 'recruitment_manager') return 'manager';
  if (role === 'sales') return 'sales';
  return 'dashboard';
}

function Shell() {
  const { session, profile, loading, signOut } = useAuth();
  const [page, setPage] = useState('dashboard');
  const path = window.location.pathname;

  useEffect(() => {
    if (profile) setPage(defaultPageForRole(profile.role));
  }, [profile?.role]);

  const allowed = useMemo(() => Boolean(profile && pageRoles[page]?.includes(profile.role)), [page, profile]);

  if (path === '/reset-password') return <ResetPassword />;
  if (loading) return <div className="loading">Loading Pro Integrate ATS...</div>;
  if (!session || !profile) return <AuthPage />;

  if (!profile.is_active) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <img src="/pro-integrate-logo.png" alt="Pro Integrate" className="auth-logo" />
          <h1>Account inactive</h1>
          <p className="muted">Please contact the ATS Admin to activate your account.</p>
          <button onClick={signOut}>Sign out</button>
        </section>
      </main>
    );
  }

  const currentPage = allowed ? page : defaultPageForRole(profile.role);

  return (
    <div className="app-shell">
      <Sidebar page={currentPage} setPage={setPage} />
      <main className="content">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'candidates' && <Candidates />}
        {currentPage === 'requirements' && <Requirements />}
        {currentPage === 'manager' && <RecruitmentManager />}
        {currentPage === 'sales' && <Sales />}
        {currentPage === 'executive' && <ExecutiveDashboard />}
        {currentPage === 'reports' && <Reports />}
        {currentPage === 'admin' && <Admin />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
