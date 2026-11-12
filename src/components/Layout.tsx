import { ReactNode } from 'react';
import { NavLink, Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, UploadCloud, Film, History, Settings, LogOut, Search, Bell, Sun, Moon } from 'lucide-react';
import Logo from './Logo';
import { useTheme } from '../contexts/ThemeContext';
import { clearSession, getStoredUser } from '../services/api';

const items = [
  ['/', 'Tableau de bord', LayoutDashboard],
  ['/new', 'Nouvelle traduction', UploadCloud],
  ['/translations', 'Mes traductions', Film],
  ['/history', 'Historique', History],
  ['/settings', 'Paramètres', Settings]
] as const;

const mobileTabs = [
  ['/', 'Accueil', LayoutDashboard],
  ['/new', 'Traduire', UploadCloud],
  ['/translations', 'Mes films', Film]
] as const;

export default function Layout({ children }: { children?: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const title = items.find(([path]) => path === loc.pathname)?.[1] || 'Résultat';
  const { theme, toggleTheme } = useTheme();
  const user = getStoredUser();
  const displayName = user?.full_name || user?.email || 'Mon espace';
  const initials = (user?.full_name || user?.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

  const logout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-top">
        <Logo />
      </div>
      <div className="workspace">
        <span className="avatar tiny">{initials}</span>
        <div><strong>{displayName}</strong><small>Plan gratuit</small></div>
        <span className="dot online" />
      </div>
      <nav aria-label="Navigation principale">
        {items.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Icon size={18}/><span>{label}</span>{label === 'Nouvelle traduction' && <span className="shortcut">⌘ K</span>}
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="storage">
          <div className="storage-line"><span>Stockage utilisé</span><span>0 / 10 Go</span></div>
          <div className="meter"><i style={{ width: '0%' }}/></div>
          <small>Aucun fichier stocké</small>
        </div>
        <button className="nav-item logout" onClick={logout}><LogOut size={18}/>Déconnexion</button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><p className="eyebrow">VOSTFR AI / WORKSPACE</p><h1>{title}</h1></div>
        <div className="top-actions">
          <button className="icon-btn" onClick={(event) => toggleTheme({ x: event.clientX, y: event.clientY })} aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'} title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <div className="search"><Search size={17}/><input placeholder="Rechercher..." aria-label="Rechercher" /></div>
          <button className="icon-btn" aria-label="Notifications"><Bell size={18}/><span className="notif" /></button>
          <Link to="/settings" className="avatar" aria-label="Profil et paramètres">{initials}</Link>
        </div>
      </header>
      <div className="content">{children || <Outlet />}</div>
    </main>
    <nav className="mobile-tabs" aria-label="Navigation mobile">
      {mobileTabs.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'mobile-tab active' : 'mobile-tab'}>
        <Icon size={22}/><span>{label}</span>
      </NavLink>)}
    </nav>
  </div>;
}
