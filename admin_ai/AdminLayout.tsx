import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, Bell, CreditCard, Database, Gauge, Languages, LayoutDashboard,
  LifeBuoy, LogOut, Menu, Moon, Search, Settings, ShieldCheck, Sun, Tag,
  Users, Video, X,
} from 'lucide-react';
import Logo from '../src/components/Logo';
import { useTheme } from '../src/contexts/ThemeContext';
import { clearSession, getStoredUser } from '../src/services/api';
import { ConfirmDialog } from './ui';
import type { AdminMe } from './types';
import './admin.css';

const navGroups: { label: string; items: { to: string; label: string; icon: typeof LayoutDashboard; permission?: string }[] }[] = [
  {
    label: 'Pilotage',
    items: [
      { to: '', label: 'Tableau de bord', icon: LayoutDashboard },
      { to: 'analytics', label: 'Chiffres clés', icon: Activity, permission: 'analytics' },
      { to: 'activity', label: 'Journal des actions', icon: Gauge, permission: 'activity' },
      { to: 'monitoring', label: 'État du service', icon: Database, permission: 'analytics' },
    ],
  },
  {
    label: 'Utilisateurs',
    items: [
      { to: 'users', label: 'Utilisateurs', icon: Users, permission: 'users' },
      { to: 'generations', label: 'Vidéos et générations IA', icon: Video, permission: 'generations' },
      { to: 'languages', label: 'Traductions et langues', icon: Languages, permission: 'languages' },
      { to: 'support', label: 'Support et assistance', icon: LifeBuoy, permission: 'support' },
      { to: 'notifications', label: 'Notifications', icon: Bell, permission: 'notifications' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { to: 'plans', label: 'Abonnements et forfaits', icon: CreditCard, permission: 'plans' },
      { to: 'payments', label: 'Paiements et transactions', icon: CreditCard, permission: 'payments' },
      { to: 'credits', label: 'Gestion des crédits', icon: Database, permission: 'credits' },
      { to: 'promotions', label: 'Promotions et parrainage', icon: Tag, permission: 'promotions' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: 'settings', label: 'Paramètres de la plateforme', icon: Settings, permission: 'settings' },
      { to: 'security', label: 'Sécurité et administrateurs', icon: ShieldCheck, permission: 'security' },
    ],
  },
];

export default function AdminLayout({ children, admin }: { children: ReactNode; admin: AdminMe }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const can = (permission?: string) => !permission || admin.permissions.includes('*') || admin.permissions.includes(permission);
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) }))
    .filter((group) => group.items.length > 0);
  const visibleItems = visibleGroups.flatMap((group) => group.items);
  const current = visibleItems.find((item) => item.to === location.pathname.replace('/admin_ai', '').replace(/^\//, ''));
  const title = current?.label || 'Administration';
  const stored = getStoredUser();
  const initials = (admin.full_name || admin.email || 'A').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'A';

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const logout = () => {
    clearSession();
    navigate('/', { replace: true });
  };

  const nav = (compact = false) => visibleGroups.map((group) => <div key={group.label}>
    {!compact && <p className="admin-nav-label">{group.label}</p>}
    <div className="admin-nav">
      {group.items.map(({ to, label, icon: Icon }) => <NavLink
        key={to}
        to={`/admin_ai${to ? `/${to}` : ''}`}
        end={to === ''}
        className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
      >
        <Icon size={18}/><span>{label}</span>
      </NavLink>)}
    </div>
  </div>);

  return <div className="app-shell admin-shell">
    <aside className="sidebar admin-sidebar">
      <div className="sidebar-top">
        <Logo/>
      </div>
      <div className="workspace admin-workspace">
        <span className="avatar tiny">{initials}</span>
        <div><strong>{admin.full_name || 'Administrateur'}</strong><small>{admin.role.replace('_', ' ')}</small></div>
        <span className="dot online"/>
      </div>
      <Link to="/dashboard" className="nav-item admin-back"><LayoutDashboard size={17}/> Retour à l’espace utilisateur</Link>
      <nav aria-label="Navigation administration">{nav()}</nav>
      <div className="sidebar-bottom">
        <button type="button" className="nav-item logout" onClick={() => setConfirmLogout(true)}><LogOut size={18}/>Déconnexion</button>
      </div>
    </aside>

    <main className="main admin-main">
      <header className="topbar">
        <div>
          <p className="eyebrow">VOSTFR AI / ADMIN</p>
          <h1>{title}</h1>
        </div>
        <div className="top-actions">
          <button type="button" className="icon-btn admin-mobile-toggle" aria-label="Ouvrir le menu" onClick={() => setMobileOpen(true)}><Menu size={18}/></button>
          <form className="search" onSubmit={(event) => {
            event.preventDefault();
            navigate(`/admin_ai/users?q=${encodeURIComponent(search)}`);
          }}>
            <Search size={17}/>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un utilisateur…" aria-label="Rechercher"/>
          </form>
          <Link to="/admin_ai/notifications" className="icon-btn" aria-label="Notifications"><Bell size={18}/></Link>
          <span className="avatar" title={stored?.email || admin.email}>{initials}</span>
        </div>
      </header>
      <div className="content">{children}</div>
    </main>

    <button type="button" className="theme-fab" onClick={(event) => toggleTheme({ x: event.clientX, y: event.clientY })} aria-label="Changer de thème">
      {theme === 'dark' ? <Sun size={22}/> : <Moon size={22}/>}
    </button>

    {mobileOpen && <div className="admin-mobile-nav" role="dialog" aria-label="Menu administration">
      <div className="admin-mobile-nav-head">
        <strong>Menu administration</strong>
        <button type="button" className="icon-btn" aria-label="Fermer" onClick={() => setMobileOpen(false)}><X size={18}/></button>
      </div>
      {nav(true)}
      <Link to="/dashboard" className="nav-item"><LayoutDashboard size={18}/> Retour utilisateur</Link>
      <button type="button" className="nav-item" onClick={() => { setMobileOpen(false); setConfirmLogout(true); }}><LogOut size={18}/> Déconnexion</button>
    </div>}

    <ConfirmDialog
      open={confirmLogout}
      title="Se déconnecter ?"
      message="Vous allez quitter l’espace administrateur. Voulez-vous vraiment continuer ?"
      onCancel={() => setConfirmLogout(false)}
      onConfirm={logout}
    />
  </div>;
}
