import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Download, Play, Sparkles, TrendingUp } from 'lucide-react';
import StatCard from '../components/StatCard';
import ProjectTable from '../components/ProjectTable';
import type { Project } from '../types';
import { api, endpoints, getApiError, getStoredUser } from '../services/api';

function durationInMinutes(duration?: string) {
  if (!duration || !/^\d{2}:\d{2}:\d{2}$/.test(duration)) return 0;
  const [hours, minutes, seconds] = duration.split(':').map(Number);
  return hours * 60 + minutes + seconds / 60;
}

const statusRows = (projects: Project[]) => [
  {
    key: 'done',
    label: 'Terminés',
    count: projects.filter((project) => ['Terminé', 'completed'].includes(project.status)).length
  },
  {
    key: 'processing',
    label: 'En cours',
    count: projects.filter((project) => ['En cours', 'processing'].includes(project.status)).length
  },
  {
    key: 'waiting',
    label: 'En attente',
    count: projects.filter((project) => ['En attente', 'pending'].includes(project.status)).length
  },
  {
    key: 'error',
    label: 'Erreurs',
    count: projects.filter((project) => ['Erreur', 'error'].includes(project.status)).length
  }
];

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');
  const user = getStoredUser();
  const firstName = user?.full_name?.split(' ')[0];

  useEffect(() => {
    let active = true;
    api.get(endpoints.projects).then(({ data }) => {
      if (active) setProjects(data);
    }).catch((err) => {
      if (active) setError(getApiError(err));
    });
    return () => { active = false; };
  }, []);

  const rows = statusRows(projects);
  const total = projects.length;
  const safeTotal = total || 1;
  const done = rows[0].count;
  const totalMinutes = Math.round(
    projects
      .filter((project) => ['Terminé', 'completed'].includes(project.status))
      .reduce((sum, project) => sum + durationInMinutes(project.duration), 0)
  );

  return <>
    <div className="hero-row">
      <div>
        <p className="kicker"><Sparkles size={15}/> L’intelligence au service de vos histoires</p>
        <h2>Bonjour{firstName ? ` ${firstName}` : ''}, <span>prêt à traduire ?</span></h2>
        <p className="hero-copy">Transformez vos films en expériences accessibles au monde entier.</p>
      </div>
      <Link to="/new" className="button hero-cta"><Play size={17} fill="currentColor"/> Nouvelle traduction</Link>
    </div>
    {error && <p style={{ color: '#ff8298', fontSize: 12, marginBottom: 18 }}>{error}</p>}
    <div className="stats-grid">
      <StatCard icon="film" label="Vidéos traitées" value={String(total)} delta="0%"/>
      <StatCard icon="languages" label="Traductions réalisées" value={String(done)} delta="0%"/>
      <StatCard icon="file" label="Fichiers SRT générés" value={String(done)} delta="0%"/>
      <StatCard icon="clock" label="Minutes traitées" value={String(totalMinutes)} delta="0%"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel pipeline-panel">
        <div className="panel-heading">
          <div><h3>Pipeline de production</h3><p>Répartition de vos projets par statut</p></div>
          <div className="pipeline-total"><strong>{total}</strong><span>projet{total > 1 ? 's' : ''}</span></div>
        </div>

        <div className="pipeline-bar" aria-hidden="true">
          {total === 0
            ? <span className="pipeline-seg empty" style={{ width: '100%' }}/>
            : rows.filter((row) => row.count > 0).map((row) => (
                <span
                  key={row.key}
                  className={`pipeline-seg ${row.key}`}
                  style={{ width: `${(row.count / safeTotal) * 100}%` }}
                />
              ))}
        </div>

        <div className="pipeline-legend">
          {rows.map((row) => (
            <div key={row.key} className="pipeline-legend-row">
              <span className={`pipeline-dot ${row.key}`}/>
              <strong>{row.label}</strong>
              <span className="pipeline-count">{row.count}</span>
              <span className="pipeline-percent">{Math.round((row.count / safeTotal) * 100)} %</span>
            </div>
          ))}
        </div>

        <div className="pipeline-footer">
          <span className="pipeline-ready">
            <CheckCircle2 size={15}/>
            {done > 0 ? `${done} prêt${done > 1 ? 's' : ''} à télécharger` : 'Aucun fichier prêt pour le moment'}
          </span>
          <Link to="/history" className="text-link">
            <Download size={14}/> Voir les fichiers
          </Link>
        </div>
      </section>

      <section className="panel quick-panel">
        <div className="panel-heading"><div><h3>Raccourcis</h3><p>Gagnez du temps sur vos actions</p></div></div>
        <Link to="/new" className="quick-link"><span className="quick-icon violet"><Play size={16} fill="currentColor"/></span><span><strong>Nouvelle traduction</strong><small>Importer une vidéo</small></span><ArrowRight size={16}/></Link>
        <Link to="/history" className="quick-link"><span className="quick-icon blue"><TrendingUp size={16}/></span><span><strong>Voir l’historique</strong><small>Retrouver un fichier SRT</small></span><ArrowRight size={16}/></Link>
      </section>
    </div>
    <section className="panel recent-panel">
      <div className="panel-heading"><div><h3>Traductions récentes</h3><p>Vos derniers projets, en un coup d’œil</p></div><Link to="/history" className="text-link">Voir tout <ArrowRight size={15}/></Link></div>
      <ProjectTable projects={projects.slice(0, 4)} />
    </section>
  </>;
}
