import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, LoaderCircle, Film, AudioLines, Languages, AlignLeft, Clock3, FileText, AlertCircle, CheckCircle2, Download, X } from 'lucide-react';
import { api, endpoints, getApiError } from '../services/api';
import { projectName, slugify } from '../utils/slug';
import type { Project } from '../types';

const steps = [
  ['Importation de la vidéo', Film],
  ['Extraction de l’audio', AudioLines],
  ['Reconnaissance vocale en ligne', Languages],
  ['Transcription des dialogues', AlignLeft],
  ['Traduction par intelligence artificielle', Languages],
  ['Synchronisation des sous-titres', Clock3],
  ['Génération du fichier SRT', FileText]
] as const;

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':');
}

export default function Processing() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [projectTitle, setProjectTitle] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [downloading, setDownloading] = useState('');
  const started = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    (async () => {
      try {
        const wanted = decodeURIComponent(slug);
        let id: number | null = null;
        let title = '';
        if (/^\d+$/.test(wanted)) {
          const { data: project } = await api.get(endpoints.project(Number(wanted)));
          id = project.id;
          title = project.title;
        } else {
          const { data: projects } = await api.get<Project[]>(endpoints.projects);
          const matches = projects
            .filter((item) => projectName(item.title) === wanted || slugify(item.title) === wanted)
            .sort((a, b) => b.id - a.id);
          if (!matches.length) {
            if (active) setError('Projet introuvable');
            return;
          }
          id = matches[0].id;
          title = matches[0].title;
        }
        if (!active) return;
        setProjectId(id);
        const canonical = projectName(title);
        if (wanted !== canonical) {
          navigate(`/processing/${canonical}`, { replace: true });
        }
      } catch (err) {
        if (active) setError(getApiError(err));
      }
    })();
    return () => { active = false; };
  }, [slug, navigate]);

  useEffect(() => {
    if (!projectId) return;
    let finished = false;

    const load = async () => {
      try {
        const { data } = await api.get(endpoints.progress(projectId));
        setProgress(data.progress ?? 0);
        setStatus(data.status);
        if (data.status === 'completed') {
          finished = true;
          try {
            const { data: project } = await api.get(endpoints.project(projectId));
            setProjectTitle(project.title);
          } catch {
            setProjectTitle('sous-titres');
          }
          setShowSuccess(true);
        }
        if (data.status === 'error') {
          finished = true;
          setError('Le traitement a échoué. Vérifiez le format de la vidéo puis réessayez.');
        }
      } catch (err) {
        setError(getApiError(err));
      }
    };

    load();
    const interval = setInterval(() => {
      if (!finished) load();
    }, 2000);
    return () => clearInterval(interval);
  }, [projectId, navigate]);

  const current = Math.min(Math.floor(progress / 15), 6);
  const statusLabel = status === 'completed' ? 'Traitement terminé' : status === 'error' ? 'Échec du traitement' : status === 'processing' ? 'Traitement en cours' : 'En attente';
  const remaining = status === 'processing' && progress > 0 && progress < 100
    ? Math.max(0, Math.round(elapsed * (100 - progress) / progress))
    : null;
  const estimatedEnd = remaining !== null
    ? new Date(started.current + (elapsed + remaining) * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';
  const resultPath = `/result/${projectTitle ? projectName(projectTitle) : projectId}`;

  async function download(format: 'srt' | 'vtt') {
    if (!projectId) return;
    setDownloading(format);
    setError('');
    try {
      const response = await api.get(endpoints.download(projectId), {
        params: { format },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${projectTitle || 'sous-titres'}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setDownloading('');
    }
  }

  return <div className="processing-page">
    <div className="processing-card">
      <div className="processing-orb"><div className="orb-core">{error ? <AlertCircle size={30}/> : <Film size={30}/>}</div></div>
      <p className="kicker centered"><span className={error ? 'pulse' : 'pulse'} style={error ? { background: '#ff657d', boxShadow: '0 0 12px #ff657d' } : undefined}/> {statusLabel.toUpperCase()}</p>
      <h2>{error ? 'La traduction n’a pas pu aboutir.' : 'Votre film prend vie dans une nouvelle langue.'}</h2>
      <p className="processing-copy">{error || 'VOSTFR AI analyse chaque dialogue pour créer des sous-titres naturels et parfaitement synchronisés.'}</p>
      <div className="progress-header"><span>Avancement</span><strong>{progress}%</strong></div>
      <div className="progress-bar"><i style={{ width: `${progress}%` }} /></div>
      <div className="steps">{steps.map(([name, Icon], index) => <div className={index < current ? 'process-step done' : index === current ? 'process-step current' : 'process-step'} key={name}>
        <span className="step-status">{index < current ? <Check size={14}/> : index === current ? <LoaderCircle size={14} className="spin"/> : <Icon size={14}/>}</span>
        <span>{name}</span>{index === current && <small>{error ? 'Erreur' : 'En cours...'}</small>}
      </div>)}</div>
      <div className="processing-footer">
        <div className="processing-timer">
          <span>Temps écoulé : {formatElapsed(elapsed)}</span>
          {remaining !== null && <small>Temps restant estimé : {formatElapsed(remaining)} · fin vers {estimatedEnd}</small>}
        </div>
        <span>{error ? <Link to="/new" className="text-link">Réessayer</Link> : 'Vous pouvez fermer cette page, le traitement continue en arrière-plan.'}</span>
      </div>
    </div>

    {showSuccess && <div
      className="confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) navigate(resultPath);
      }}
    >
      <div className="confirm-dialog success-dialog" role="dialog" aria-modal="true" aria-labelledby="success-title" aria-describedby="success-desc">
        <button type="button" className="auth-modal-close success-close" onClick={() => navigate(resultPath)} aria-label="Fermer">
          <X size={18}/>
        </button>
        <span className="success-icon"><CheckCircle2 size={26}/></span>
        <h3 id="success-title">Traduction terminée !</h3>
        <p id="success-desc">Votre fichier est prêt. Veuillez le télécharger en cliquant sur le bouton ci-dessous.</p>
        <div className="success-warning">
          <Clock3 size={16}/>
          <span>Votre fichier sera automatiquement supprimé dans <strong>24 heures</strong> de votre historique. Pensez à le télécharger dès maintenant.</span>
        </div>
        <div className="success-actions">
          <button type="button" className="button primary" onClick={() => download('srt')} disabled={downloading !== ''}>
            <Download size={17}/><span>{downloading === 'srt' ? 'Téléchargement...' : 'Télécharger le SRT'}</span>
          </button>
          <button type="button" className="button secondary" onClick={() => download('vtt')} disabled={downloading !== ''}>
            <Download size={17}/><span>{downloading === 'vtt' ? 'Téléchargement...' : 'Télécharger le VTT'}</span>
          </button>
        </div>
        <button type="button" className="success-result-link" onClick={() => navigate(resultPath)}>Voir le résultat</button>
      </div>
    </div>}
  </div>;
}
