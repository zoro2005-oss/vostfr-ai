import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Play, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, CartesianGrid } from 'recharts';
import StatCard from '../components/StatCard';
import ProjectTable from '../components/ProjectTable';
import type { Project } from '../types';
import { api, endpoints, getApiError, getStoredUser } from '../services/api';

function durationInMinutes(duration?: string) {
  if (!duration || !/^\d{2}:\d{2}:\d{2}$/.test(duration)) return 0;
  const [hours, minutes, seconds] = duration.split(':').map(Number);
  return hours * 60 + minutes + seconds / 60;
}

function lastSevenMonths() {
  const now = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (6 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      name: date.toLocaleDateString('fr-FR', { month: 'short' })
    };
  });
}

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

  const completed = projects.filter((project) => project.status === 'Terminé');
  const totalMinutes = Math.round(completed.reduce((total, project) => total + durationInMinutes(project.duration), 0));

  const chart = useMemo(() => {
    const months = lastSevenMonths();
    const values = new Map(months.map((month) => [month.key, { ...month, v: 0 }]));
    for (const project of projects) {
      if (!project.created_at) continue;
      const date = new Date(project.created_at);
      const item = values.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (item) item.v += Math.round(durationInMinutes(project.duration));
    }
    return Array.from(values.values());
  }, [projects]);

  const chartTotal = chart.reduce((total, item) => total + item.v, 0);

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
      <StatCard icon="film" label="Vidéos traitées" value={String(projects.length)} delta="0%"/>
      <StatCard icon="languages" label="Traductions réalisées" value={String(completed.length)} delta="0%"/>
      <StatCard icon="file" label="Fichiers SRT générés" value={String(completed.length)} delta="0%"/>
      <StatCard icon="clock" label="Minutes traitées" value={String(totalMinutes)} delta="0%"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel chart-panel">
        <div className="panel-heading"><div><h3>Activité de traduction</h3><p>Nombre de minutes traduites sur les 7 derniers mois</p></div><div className="chart-total"><strong>{chartTotal}</strong><span><TrendingUp size={12}/> 0%</span></div></div>
        <div className="chart"><ResponsiveContainer width="100%" height={220}><AreaChart data={chart}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8a4df0" stopOpacity={.4}/><stop offset="100%" stopColor="#ff5aa5" stopOpacity={0}/></linearGradient><linearGradient id="stroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#a79bff"/><stop offset="100%" stopColor="#ff5aa5"/></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'rgba(235,235,245,.5)',fontSize:12}}/><Tooltip cursor={{stroke:'rgba(255,255,255,.16)'}} contentStyle={{background:'rgba(20,20,38,.92)',border:'1px solid rgba(255,255,255,.12)',borderRadius:14,color:'#fff',backdropFilter:'blur(20px)'}}/><Area type="monotone" dataKey="v" stroke="url(#stroke)" strokeWidth={3} fill="url(#fill)"/></AreaChart></ResponsiveContainer></div>
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
