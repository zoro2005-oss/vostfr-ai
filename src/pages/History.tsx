import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Download, Play } from 'lucide-react';
import type { Project } from '../types';
import { api, endpoints, getApiError } from '../services/api';
import { projectName } from '../utils/slug';

type Filter = 'all' | 'done' | 'progress';

function statusClass(status: Project['status']) {
  if (status === 'Terminé' || status === 'completed') return 'done';
  if (status === 'En cours' || status === 'processing') return 'progressing';
  if (status === 'Erreur' || status === 'error') return 'error';
  return 'waiting';
}

export default function History() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get(endpoints.projects).then(({ data }) => {
      if (active) setProjects(data);
    }).catch((err) => {
      if (active) setError(getApiError(err));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const filtered = projects.filter((project) => {
    const search = query.trim().toLowerCase();
    const matchesQuery = !search || project.title.toLowerCase().includes(search) || project.filename.toLowerCase().includes(search);
    const isDone = project.status === 'Terminé' || project.status === 'completed';
    const isProgress = project.status === 'En cours' || project.status === 'processing';
    const matchesFilter = filter === 'all' || (filter === 'done' && isDone) || (filter === 'progress' && isProgress);
    return matchesQuery && matchesFilter;
  });

  async function download(project: Project) {
    try {
      const response = await api.get(endpoints.download(project.id), {
        params: { format: 'srt' },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${project.title}.srt`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiError(err));
    }
  }

  return <>
    <div className="page-intro compact"><p className="kicker">VOTRE BIBLIOTHÈQUE</p><h2>Historique des traductions</h2><p>Retrouvez et gérez tous vos projets au même endroit.</p></div>
    <section className="panel library-panel">
      <div className="library-toolbar">
        <div className="search ios-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un film..." aria-label="Rechercher un film" /></div>
      </div>
      <div className="filter-pills" role="group" aria-label="Filtrer les traductions">
        <button className={filter === 'all' ? 'filter-pill active' : 'filter-pill'} onClick={() => setFilter('all')}>Tous</button>
        <button className={filter === 'done' ? 'filter-pill active' : 'filter-pill'} onClick={() => setFilter('done')}>Terminés</button>
        <button className={filter === 'progress' ? 'filter-pill active' : 'filter-pill'} onClick={() => setFilter('progress')}>En cours</button>
      </div>
      {error && <p style={{ color: '#ff8298', fontSize: 12, margin: 0 }}>{error}</p>}
      <div className="translation-list">
        {filtered.map((project) => {
          const isDone = project.status === 'Terminé' || project.status === 'completed';
          const isProgress = project.status === 'En cours' || project.status === 'processing';
          return <div className="translation-row" key={project.id}>
            <Link to={`/result/${projectName(project.title)}`} className="translation-poster" aria-label={`Ouvrir ${project.title}`}><Play size={16} fill="currentColor"/></Link>
            <div className="translation-info">
              <Link to={`/result/${projectName(project.title)}`}><strong>{project.title}</strong></Link>
              <small>{project.filename}</small>
              <span className="translation-langs">{project.source} → {project.target}</span>
            </div>
            <div className="translation-status">
              <span className={`status ${statusClass(project.status)}`}><i/>{project.status}</span>
              {isProgress && <div className="progress-track"><span className="progress-fill" style={{ width: `${project.progress}%` }}/></div>}
              {isProgress && <span className="percent">{project.progress}%</span>}
            </div>
            <button className="round-download" onClick={() => download(project)} disabled={!isDone} aria-label={`Télécharger le SRT de ${project.title}`}><Download size={17}/></button>
          </div>;
        })}
        {!loading && filtered.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 30 }}>{query ? 'Aucun projet ne correspond à cette recherche.' : 'Aucun projet pour le moment.'}</p>}
        {loading && <p className="muted" style={{ textAlign: 'center', padding: 30 }}>Chargement...</p>}
      </div>
    </section>
  </>;
}
