import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clapperboard,
  Clock,
  FileText,
  Film,
  History,
  Languages,
  LayoutDashboard,
  Moon,
  Play,
  Search,
  Settings,
  Sparkles,
  Sun,
  UploadCloud
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

const chartData = [
  { month: 'juin', minutes: 8 },
  { month: 'juil.', minutes: 12 },
  { month: 'août', minutes: 24 },
  { month: 'sept.', minutes: 20 },
  { month: 'oct.', minutes: 28 },
  { month: 'nov.', minutes: 20 }
];

const recentProjects = [
  { title: 'Une saison à Kyoto', file: 'kyoto_episode_04.mp4', langs: 'Japonais → Français', status: 'Terminé', thumb: 'kyoto' },
  { title: 'Les heures bleues', file: 'les_heures_bleues.mov', langs: 'Anglais → Français', status: 'En cours', thumb: 'heures', progress: 62 },
  { title: 'Dernier arrêt', file: 'dernier_arret_final.mkv', langs: 'Coréen → Français', status: 'Terminé', thumb: 'arret' },
  { title: 'Fragments de lumière', file: 'fragments_trailer.mp4', langs: 'Espagnol → Français', status: 'Terminé', thumb: 'fragments' }
];

const navItems = [
  ['/', 'Tableau de bord', LayoutDashboard, true],
  ['/new', 'Nouvelle traduction', UploadCloud, false],
  ['/translations', 'Mes traductions', Film, false],
  ['/history', 'Historique', History, false],
  ['/settings', 'Paramètres', Settings, false]
] as const;

const mobileNav = [
  ['/', 'Accueil', LayoutDashboard],
  ['/new', 'Traduire', UploadCloud],
  ['/translations', 'Mes films', Film]
] as const;

export default function Maquette() {
  const { theme, setTheme } = useTheme();
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const rippleId = useRef(0);

  function handleTheme(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const id = rippleId.current + 1;
    rippleId.current = id;
    setRipples((current) => [...current, {
      id,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }]);
    window.setTimeout(() => {
      setRipples((current) => current.filter((ripple) => ripple.id !== id));
    }, 520);
    setTheme(theme === 'dark' ? 'light' : 'dark', { instant: true });
  }

  return <div className="demo-page">
    <div className="demo-shell">
      <aside className="demo-sidebar">
        <div className="demo-brand">
          <span className="demo-brand-mark"><Clapperboard size={21}/></span>
          <span>VOSTFR <b>AI</b></span>
        </div>

        <div className="demo-profile">
          <span className="demo-avatar">VA</span>
          <div>
            <strong>Espace aperçu</strong>
            <small>Mode démonstration</small>
          </div>
          <span className="demo-online" aria-hidden="true"/>
        </div>

        <nav className="demo-nav" aria-label="Navigation de la maquette">
          {navItems.map(([to, label, Icon, active]) => <Link key={to} to={to} className={active ? 'demo-nav-item active' : 'demo-nav-item'}>
            <Icon size={18}/><span>{label}</span>
          </Link>)}
        </nav>

        <div className="demo-sidebar-bottom">
          <div className="demo-promo">
            <Sparkles size={17}/>
            <strong>Un studio, tout simplement.</strong>
            <p>Importez, traduisez, exportez. Votre workflow reste au même endroit.</p>
            <Link to="/new">Essayer VOSTFR AI <ArrowRight size={14}/></Link>
          </div>
          <Link to="/login" className="demo-login">Connexion</Link>
        </div>
      </aside>

      <main className="demo-main">
        <header className="demo-topbar">
          <div className="demo-title">
            <p className="demo-eyebrow">VOSTFR AI / APERÇU</p>
            <h1>Maquette du studio</h1>
          </div>
          <div className="demo-top-actions">
            <button
              className="demo-theme"
              onClick={handleTheme}
              aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
              title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
              {ripples.map((ripple) => <span key={ripple.id} className="demo-theme-ripple" style={{ left: ripple.x, top: ripple.y }}/>) }
            </button>
            <label className="demo-search">
              <Search size={17}/>
              <input placeholder="Rechercher…" aria-label="Rechercher"/>
            </label>
            <span className="demo-avatar">VA</span>
          </div>
        </header>

        <div className="demo-ribbon">
          <span>Maquette interactive · données fictives</span>
          <Link to="/">Accéder à mon espace <ArrowRight size={14}/></Link>
        </div>

        <div className="demo-content">
          <section className="demo-hero">
            <div className="demo-hero-copy">
              <p className="demo-kicker"><Sparkles size={15}/> VOTRE STUDIO DE SOUS-TITRAGE</p>
              <h2><span>Bonjour Camille.</span><em>On donne vie à votre prochain film ?</em></h2>
              <p className="demo-hero-text">De la vidéo aux sous-titres synchronisés, gardez le rythme de votre histoire dans chaque langue.</p>
              <div className="demo-hero-actions">
                <Link to="/new" className="demo-cta"><Play size={16} fill="currentColor"/> Nouvelle traduction <ArrowRight size={15}/></Link>
                <span className="demo-hero-note"><i/> Vidéos et sous-titres, au même endroit</span>
              </div>
            </div>

            <div className="demo-player-wrap" aria-hidden="true">
              <div className="demo-player">
                <div className="demo-player-scene">
                  <svg viewBox="0 0 420 220" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="demoSky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#39265f"/>
                        <stop offset="52%" stopColor="#a8578b"/>
                        <stop offset="100%" stopColor="#f0a06c"/>
                      </linearGradient>
                      <linearGradient id="demoHillFar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3d2a5d"/>
                        <stop offset="100%" stopColor="#241a3d"/>
                      </linearGradient>
                    </defs>
                    <rect width="420" height="220" fill="url(#demoSky)"/>
                    <circle cx="215" cy="128" r="44" fill="#ffd8a8" opacity=".9"/>
                    <ellipse cx="104" cy="70" rx="42" ry="9" fill="#fff" opacity=".08"/>
                    <ellipse cx="320" cy="52" rx="54" ry="11" fill="#fff" opacity=".07"/>
                    <path d="M0 158 L58 121 L108 150 L168 108 L226 151 L282 121 L342 156 L420 123 L420 220 L0 220 Z" fill="url(#demoHillFar)"/>
                    <path d="M0 191 L70 156 L132 186 L200 151 L262 191 L332 161 L420 187 L420 220 L0 220 Z" fill="#191128"/>
                  </svg>
                  <span className="demo-player-play"><Play size={16} fill="currentColor"/></span>
                  <p className="demo-player-subtitle">Chaque histoire mérite d’être comprise.</p>
                </div>
                <div className="demo-player-controls">
                  <div className="demo-player-timeline">
                    <span style={{ flex: 3 }}/><span style={{ flex: 2 }}/><span style={{ flex: 1.4 }}/><span style={{ flex: 1.8 }}/><span style={{ flex: 1 }}/>
                  </div>
                  <div className="demo-player-meta">
                    <span className="demo-player-live"><i/> Audio détecté</span>
                    <span>FRANÇAIS</span>
                  </div>
                </div>
              </div>
              <div className="demo-player-pill">
                <span className="demo-pill-icon"><Languages size={17}/></span>
                <div><strong>Traduction prête</strong><small>FR · synchronisée</small></div>
              </div>
            </div>
          </section>

          <section className="demo-stats" aria-label="Statistiques fictives">
            <article className="demo-stat">
              <div className="demo-stat-head"><span className="demo-stat-icon violet"><Clapperboard size={19}/></span><small>TOTAL</small></div>
              <p>Vidéos importées</p>
              <strong>4</strong>
              <span className="demo-stat-note">Exemple de votre activité</span>
            </article>
            <article className="demo-stat">
              <div className="demo-stat-head"><span className="demo-stat-icon blue"><Languages size={19}/></span><small>TOTAL</small></div>
              <p>Traductions terminées</p>
              <strong>3</strong>
              <span className="demo-stat-note">Exemple de votre activité</span>
            </article>
            <article className="demo-stat">
              <div className="demo-stat-head"><span className="demo-stat-icon green"><FileText size={19}/></span><small>TOTAL</small></div>
              <p>Fichiers sous-titres</p>
              <strong>6</strong>
              <span className="demo-stat-note">SRT et VTT générés</span>
            </article>
            <article className="demo-stat">
              <div className="demo-stat-head"><span className="demo-stat-icon amber"><Clock size={19}/></span><small>TOTAL</small></div>
              <p>Minutes traitées</p>
              <strong>112</strong>
              <span className="demo-stat-note">Sur les vidéos terminées</span>
            </article>
          </section>

          <div className="demo-mid">
            <section className="demo-panel demo-chart">
              <div className="demo-panel-head">
                <div>
                  <p className="demo-eyebrow violet">VOTRE RYTHME</p>
                  <h3>Activité de traduction</h3>
                  <p>Minutes de vidéo traitées sur les 7 derniers mois</p>
                </div>
                <div className="demo-chart-total"><strong>112 min</strong><span>Temps traité</span></div>
              </div>
              <div className="demo-chart-body">
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="demoChartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9278ff" stopOpacity={.42}/>
                        <stop offset="100%" stopColor="#9278ff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--demo-grid)"/>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--demo-muted)', fontSize: 12 }} dy={8}/>
                    <Tooltip
                      cursor={{ stroke: 'var(--demo-border-strong)' }}
                      contentStyle={{ background: 'var(--demo-surface-strong)', border: '1px solid var(--demo-border)', borderRadius: 12, color: 'var(--demo-text)', fontSize: 12 }}
                      labelStyle={{ color: 'var(--demo-muted)' }}
                    />
                    <Area type="monotone" dataKey="minutes" stroke="#9278ff" strokeWidth={3} fill="url(#demoChartFill)" activeDot={{ r: 4 }}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="demo-panel demo-quick">
              <div className="demo-panel-head">
                <div>
                  <p className="demo-eyebrow violet">ACCÈS RAPIDE</p>
                  <h3>Votre prochain projet</h3>
                  <p>Tout commence par une vidéo.</p>
                </div>
                <span className="demo-quick-spark"><Sparkles size={17}/></span>
              </div>
              <div className="demo-quick-list">
                <Link to="/new" className="demo-quick-item">
                  <span className="demo-quick-icon violet"><Film size={17}/></span>
                  <span><strong>Importer une vidéo</strong><small>MP4, MKV, AVI, MOV ou WEBM</small></span>
                  <ArrowRight size={16}/>
                </Link>
                <Link to="/history" className="demo-quick-item">
                  <span className="demo-quick-icon blue"><FileText size={17}/></span>
                  <span><strong>Retrouver un sous-titre</strong><small>Parcourir vos projets terminés</small></span>
                  <ArrowRight size={16}/>
                </Link>
              </div>
              <p className="demo-quick-foot">Traitement suivi en direct, sans perdre le fil.</p>
            </section>
          </div>

          <section className="demo-panel demo-recent">
            <div className="demo-panel-head">
              <div>
                <p className="demo-eyebrow violet">VOTRE BIBLIOTHÈQUE</p>
                <h3>Projets récents</h3>
                <p>Reprenez là où votre histoire vous attend.</p>
              </div>
              <Link to="/history" className="demo-see-all">Tout voir <ArrowRight size={14}/></Link>
            </div>
            <div className="demo-project-grid">
              {recentProjects.map((project) => <article className="demo-project" key={project.title}>
                <div className={`demo-thumb demo-thumb-${project.thumb}`}>
                  <span className="demo-thumb-play"><Play size={16} fill="currentColor"/></span>
                </div>
                <div className="demo-project-body">
                  <strong>{project.title}</strong>
                  <small>{project.file}</small>
                  <div className="demo-project-meta">
                    <span>{project.langs}</span>
                    <span className={project.status === 'En cours' ? 'demo-badge amber' : 'demo-badge green'}>{project.status}</span>
                  </div>
                  {project.progress !== undefined && <div className="demo-progress"><span style={{ width: `${project.progress}%` }}/></div>}
                </div>
              </article>)}
            </div>
          </section>
        </div>
      </main>
    </div>

    <nav className="demo-mobile-nav" aria-label="Navigation mobile de la maquette">
      {mobileNav.map(([to, label, Icon]) => <Link key={to} to={to} className="demo-mobile-item" aria-label={label}>
        <Icon size={21}/><span>{label}</span>
      </Link>)}
    </nav>
  </div>;
}
