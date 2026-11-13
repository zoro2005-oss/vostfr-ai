import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, FileText, CheckCircle2, Languages, Film, ArrowLeft, WandSparkles, Copy, Check } from 'lucide-react';
import type { Project, SubtitleSegment } from '../types';
import { api, endpoints, getApiError } from '../services/api';
import { projectName, slugify } from '../utils/slug';

const languageLabels: Record<string, string> = {
  auto: 'Automatique',
  en: 'Anglais',
  fr: 'Français',
  es: 'Espagnol',
  de: 'Allemand',
  it: 'Italien',
  pt: 'Portugais',
  ru: 'Russe',
  ja: 'Japonais',
  ko: 'Coréen',
  zh: 'Chinois',
  ar: 'Arabe'
};

function statusLabel(status?: string) {
  if (status === 'completed' || status === 'Terminé') return 'Traduction terminée';
  if (status === 'processing' || status === 'En cours') return 'Traitement en cours';
  if (status === 'error' || status === 'Erreur') return 'Erreur';
  return 'En attente';
}

export default function Result() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const { data: projects } = await api.get<Project[]>(endpoints.projects);
        const wanted = decodeURIComponent(slug);
        const matches = projects
          .filter((item) => projectName(item.title) === wanted || slugify(item.title) === wanted)
          .sort((a, b) => b.id - a.id);
        const match = matches[0]
          || (/^\d+$/.test(wanted) ? projects.find((item) => item.id === Number(wanted)) : undefined);
        if (!match) {
          if (active) setError('Projet introuvable');
          return;
        }
        const [projectResponse, subtitlesResponse] = await Promise.all([
          api.get(endpoints.project(match.id)),
          api.get(endpoints.subtitles(match.id))
        ]);
        if (!active) return;
        setProject(projectResponse.data);
        setSegments(subtitlesResponse.data);
        setError('');
        const canonical = projectName(projectResponse.data.title);
        if (wanted !== canonical) {
          navigate(`/result/${canonical}`, { replace: true });
        }
      } catch (err) {
        if (active) setError(getApiError(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug, navigate]);

  async function download(format: 'srt' | 'vtt') {
    if (!project) return;
    setDownloading(format);
    try {
      const response = await api.get(endpoints.download(project.id), {
        params: { format },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${project.title || 'sous-titres'}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setDownloading('');
    }
  }

  const translatedText = segments.map((segment) => segment.translated.trim()).filter(Boolean).join('\n\n');
  const wordCount = translatedText ? translatedText.split(/\s+/).filter(Boolean).length : 0;
  const hasSegments = segments.length > 0;
  const source = languageLabels[project?.source || ''] || project?.source || '—';
  const target = languageLabels[project?.target || ''] || project?.target || '—';

  async function copyText() {
    if (!translatedText) return;
    try {
      await navigator.clipboard.writeText(translatedText);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = translatedText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return <>
    <div className="result-top">
      <div>
        <Link to="/dashboard" className="back-link"><ArrowLeft size={15}/> Tableau de bord</Link>
        <h2>{loading ? 'Chargement...' : project?.title || 'Aucun projet'}</h2>
        <p className="muted">{project ? `${project.filename} · ${project.date}` : 'Aucune traduction disponible'}</p>
      </div>
      <div className="result-actions">
        <button className="button secondary" disabled={!hasSegments || !!downloading} onClick={() => download('vtt')}>{downloading === 'vtt' ? '...' : 'VTT'}</button>
        <button className="button primary" disabled={!hasSegments || !!downloading} onClick={() => download('srt')}><Download size={17}/> Télécharger le SRT</button>
      </div>
    </div>
    {error && <p style={{ color: '#ff8298', fontSize: 12, marginBottom: 18 }}>{error}</p>}
    <div className="result-stats">
      <div><Film size={18}/><span>Durée</span><strong>{project?.duration || '—'}</strong></div>
      <div><Languages size={18}/><span>Langues</span><strong>{project ? `${source} → ${target}` : '—'}</strong></div>
      <div><FileText size={18}/><span>Mots</span><strong>{wordCount} mots</strong></div>
      <div><CheckCircle2 size={18}/><span>Statut</span><strong className={project?.status === 'completed' || project?.status === 'Terminé' ? 'success-text' : ''}>{statusLabel(project?.status)}</strong></div>
    </div>
    <section className="panel subtitle-panel">
      <div className="panel-heading">
        <div><h3>Traduction complète</h3><p>Copiez le texte traduit en un clic.</p></div>
        <button className="button secondary" disabled={!translatedText} onClick={copyText}>{copied ? <><Check size={15}/> Copié</> : <><Copy size={15}/> Copier</>}</button>
      </div>
      <textarea className="translation-text" readOnly value={translatedText} placeholder="Aucun texte traduit disponible." aria-label="Texte de la traduction" />
      <div className="subtitle-foot"><span><WandSparkles size={15}/> {hasSegments ? 'Traduction enregistrée dans la base de données.' : 'Aucun sous-titre généré.'}</span><button className="button primary" disabled={!hasSegments || !!downloading} onClick={() => download('srt')}><Download size={15}/> Télécharger le fichier SRT</button></div>
    </section>
  </>;
}
