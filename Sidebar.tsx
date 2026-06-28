import { useAuth } from '../auth/AuthContext';
import type { AppRole } from '../types';

type NavItem = {
  id: string;
  label: string;
  roles: AppRole[];
};

const items: NavItem[] = [
  { id: 'dashboard', label: 'Recruiter Dashboard', roles: ['recruiter', 'recruitment_manager', 'sales', 'admin'] },
  { id: 'candidates', label: 'Candidates', roles: ['recruiter', 'recruitment_manager', 'sales', 'admin'] },
  { id: 'requirements', label: 'Requirements / JDs', roles: ['recruitment_manager', 'sales', 'admin'] },
  { id: 'manager', label: 'Recruitment Manager', roles: ['recruitment_manager', 'admin'] },
  { id: 'sales', label: 'Sales Forecast', roles: ['sales', 'recruitment_manager', 'executive', 'admin'] },
  { id: 'executive', label: 'Executive Dashboard', roles: ['executive', 'recruitment_manager', 'admin'] },
  { id: 'reports', label: 'Reports', roles: ['recruiter', 'recruitment_manager', 'sales', 'executive', 'admin'] },
  { id: 'admin', label: 'Admin Control', roles: ['admin'] },
];

export function Sidebar({ page, setPage }: { page: string; setPage: (page: string) => void }) {
  const { profile, signOut } = useAuth();
  const nav = items.filter((item) => profile && item.roles.includes(profile.role));

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/pro-integrate-logo.png" alt="Pro Integrate" />
        <div>
          <strong>Pro Integrate ATS</strong>
          <p>{profile?.role.replace('_', ' ')}</p>
        </div>
      </div>

      <nav>
        {nav.map((item) => (
          <button key={item.id} onClick={() => setPage(item.id)} className={page === item.id ? 'active' : ''}>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p className="small muted">Signed in as</p>
        <strong>{profile?.full_name || profile?.email}</strong>
        <button className="secondary full" onClick={signOut}>Sign out</button>
      </div>
    </aside>
  );
}
