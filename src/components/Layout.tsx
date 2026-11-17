import { ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, UploadCloud, Film, History, Settings, LogOut, Search, Bell, Sun, Moon, Home, CheckCircle2, LoaderCircle, AlertCircle, Clock3, BellOff } from 'lucide-react';
import Logo from './Logo';
import { useTheme } from '../contexts/ThemeContext';
import { usePreloader } from '../contexts/PreloaderContext';
import { api, clearSession, endpoints, getStoredUser } from '../services/api';
import type { Project } from '../types';
import { projectName } from '../utils/slug';

const items = [
  ['/dashboard', 'Tableau de bord', LayoutDashboard],
  ['/new', 'Nouvelle traduction', UploadCloud],
  ['/translations', 'Mes traductions', Film],
  ['/history', 'Historique', History],
  ['/settings', 'Paramètres', Settings]
] as const;

const mobileTabs = [
  ['/dashboard', 'Accueil', Home],
  ['/new', 'Traduire', UploadCloud],
  ['/translations', 'Mes films', Film]
] as const;

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  tone: 'done' | 'progress' | 'error' | 'waiting';
  to: string;
  icon: typeof Bell;
};

function toNotification(project: Project): NotificationItem {
  const status = String(project.status || '').toLowerCase();
  if (/termin|complet/.test(status)) {
    return {
      id: project.id,
      title: 'Traduction terminée',
      message: `${project.title} · sous-titres prêts, suppression dans 24 h`,
      tone: 'done',
      to: `/result/${projectName(project.title)}`,
      icon: CheckCircle2
    };
  }
  if (/cours|processing/.test(status)) {
    return {
      id: project.id,
      title: 'Traduction en cours',
      message: `${project.title} · ${Math.round(project.progress || 0)} %`,
      tone: 'progress',
      to: `/processing/${projectName(project.title)}`,
      icon: LoaderCircle
    };
  }
  if (/erreur|error/.test(status)) {
    return {
      id: project.id,
      title: 'Échec du traitement',
      message: `${project.title} · ouvrez l’historique pour réessayer`,
      tone: 'error',
      to: '/history',
      icon: AlertCircle
    };
  }
  return {
    id: project.id,
    title: 'Traduction en attente',
    message: `${project.title} · le traitement va démarrer`,
    tone: 'waiting',
    to: '/history',
    icon: Clock3
  };
}

export default function Layout({ children }: { children?: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const title = items.find(([path]) => path === loc.pathname)?.[1] || 'Résultat';
  const { theme, toggleTheme } = useTheme();
  const { show } = usePreloader();
  const user = getStoredUser();
  const displayName = user?.full_name || user?.email || 'Mon espace';
  const initials = (user?.full_name || user?.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifSeen, setNotifSeen] = useState(() => sessionStorage.getItem('vostfr_notif_seen') === '1');
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmLogout) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmLogout(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmLogout]);

  useEffect(() => {
    let active = true;
    setNotifLoading(true);
    api.get<Project[]>(endpoints.projects)
      .then(({ data }) => {
        if (active) setNotifications(data.slice(0, 8).map(toNotification));
      })
      .catch(() => {
        if (active) setNotifications([]);
      })
      .finally(() => {
        if (active) setNotifLoading(false);
      });
    return () => { active = false; };
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const onDown = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setNotifOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [notifOpen]);

  const toggleNotifications = () => {
    if (!notifOpen) {
      setNotifSeen(true);
      sessionStorage.setItem('vostfr_notif_seen', '1');
    }
    setNotifOpen((value) => !value);
  };

  const logout = () => {
    clearSession();
    show(1600);
    navigate('/', { replace: true });
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
        {items.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/dashboard'} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Icon size={18}/><span>{label}</span>{label === 'Nouvelle traduction' && <span className="shortcut">⌘ K</span>}
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="storage">
          <div className="storage-line"><span>Stockage utilisé</span><span>0 / 10 Go</span></div>
          <div className="meter"><i style={{ width: '0%' }}/></div>
          <small>Aucun fichier stocké</small>
        </div>
        <button className="nav-item logout" onClick={() => setConfirmLogout(true)}><LogOut size={18}/>Déconnexion</button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><p className="eyebrow">VOSTFR AI / WORKSPACE</p><h1>{title}</h1></div>
        <div className="top-actions">
          <Link to="/settings" className="icon-btn" aria-label="Paramètres" title="Paramètres"><Settings size={18}/></Link>
          <div className="search"><Search size={17}/><input placeholder="Rechercher..." aria-label="Rechercher" /></div>
          <div className="notif-wrap" ref={notifRef}>
            <button className="icon-btn" aria-label="Notifications" aria-haspopup="dialog" aria-expanded={notifOpen} onClick={toggleNotifications}><Bell size={18}/>{!notifSeen && <span className="notif" />}</button>
            {notifOpen && <div className="notif-popover" role="dialog" aria-label="Notifications">
              <div className="notif-head"><strong>Notifications</strong>{notifications.length > 0 && <span className="notif-count">{notifications.length}</span>}</div>
              <div className="notif-list">
                {notifLoading
                  ? <div className="notif-empty"><LoaderCircle size={18} className="spin"/>Chargement…</div>
                  : notifications.length === 0
                    ? <div className="notif-empty"><BellOff size={18}/>Aucune notification pour le moment.</div>
                    : notifications.map((notification) => {
                      const Icon = notification.icon;
                      return <button key={notification.id} type="button" className="notif-item" onClick={() => { setNotifOpen(false); navigate(notification.to); }}>
                        <span className={`notif-item-icon ${notification.tone}`}><Icon size={16}/></span>
                        <span className="notif-item-body"><strong>{notification.title}</strong><small>{notification.message}</small></span>
                      </button>;
                    })}
              </div>
              <button type="button" className="notif-footer" onClick={() => { setNotifOpen(false); navigate('/history'); }}>Voir tout l’historique</button>
            </div>}
          </div>
          <Link to="/settings" className="avatar" aria-label="Profil et paramètres">{initials}</Link>
        </div>
      </header>
      <div className="content">{children || <Outlet />}</div>
    </main>
    <button
      type="button"
      className="theme-fab"
      onClick={(event) => toggleTheme({ x: event.clientX, y: event.clientY })}
      aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
    >
      {theme === 'dark' ? <Sun size={22}/> : <Moon size={22}/>}
    </button>
    <nav className="mobile-tabs" aria-label="Navigation mobile">
      {mobileTabs.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/dashboard'} className={({ isActive }) => isActive ? 'mobile-tab active' : 'mobile-tab'}>
        <Icon size={22}/><span>{label}</span>
      </NavLink>)}
      <button type="button" className="mobile-tab" onClick={() => setConfirmLogout(true)}>
        <LogOut size={22}/><span>Quitter</span>
      </button>
    </nav>

    {confirmLogout && <div
      className="confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setConfirmLogout(false);
      }}
    >
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-title" aria-describedby="logout-desc">
        <span className="confirm-icon"><LogOut size={22}/></span>
        <h3 id="logout-title">Se déconnecter ?</h3>
        <p id="logout-desc">Vous allez être redirigé vers la page d’accueil. Voulez-vous vraiment vous déconnecter ?</p>
        <div className="confirm-actions">
          <button className="button secondary" onClick={() => setConfirmLogout(false)}>Annuler</button>
          <button className="button danger" onClick={logout}>Se déconnecter</button>
        </div>
      </div>
    </div>}
  </div>;
}
