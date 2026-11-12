import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { Project } from '../types';
import { projectName } from '../utils/slug';

function statusClass(status: Project['status']) {
  if (status === 'Terminé' || status === 'completed') return 'done';
  if (status === 'En cours' || status === 'processing') return 'progressing';
  if (status === 'Erreur' || status === 'error') return 'error';
  return 'waiting';
}

export default function ProjectTable({ projects }: { projects: Project[] }) {
  return <div className="project-grid">
    {projects.map((project) => {
      const processing = project.status === 'En cours' || project.status === 'processing';
      return <Link to={`/result/${projectName(project.title)}`} className="project-card" key={project.id}>
        <div className="poster"><span className="poster-play"><Play size={18} fill="currentColor"/></span></div>
        <div className="project-card-body">
          <strong>{project.title}</strong>
          <small>{project.filename}</small>
          <div className="project-card-foot">
            <span className="project-langs">{project.source} → {project.target}</span>
            <span className={`status ${statusClass(project.status)}`}><i/>{project.status}</span>
          </div>
          {processing && <div className="progress-track"><span className="progress-fill" style={{ width: `${project.progress}%` }}/></div>}
        </div>
      </Link>;
    })}
    {projects.length === 0 && <p className="muted" style={{ padding: 28, textAlign: 'center', gridColumn: '1 / -1' }}>Aucune traduction pour le moment.</p>}
  </div>;
}
