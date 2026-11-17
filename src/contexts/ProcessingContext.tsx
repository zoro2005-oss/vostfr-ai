import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock3, Download, Info, LoaderCircle, X } from 'lucide-react';
import { api, endpoints, isAuthenticated } from '../services/api';
import { projectName } from '../utils/slug';

type ActiveProcessing = {
  id: number;
  title: string;
  progress: number;
  status: string;
};

type CompletedProcessing = {
  id: number;
  title: string;
  slug: string;
};

interface ProcessingContextType {
  active: ActiveProcessing | null;
  start: (id: number, title: string) => void;
  report: (patch: Partial<Pick<ActiveProcessing, 'progress' | 'status'>>) => void;
  complete: (id: number, title?: string) => void;
  finish: () => void;
}

const STORAGE_KEY = 'vostfr_active_processing';
const DEFAULT_MESSAGE = 'Le traitement peut prendre quelques minutes. Un peu de patience, vous pouvez suivre son avancement.';

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

function readStored(): ActiveProcessing | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as ActiveProcessing : null;
  } catch {
    return null;
  }
}

export function ProcessingProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveProcessing | null>(readStored);
  const [completed, setCompleted] = useState<CompletedProcessing | null>(null);
  const [toast, setToast] = useState<{ title: string; message: string; key: number } | null>(null);
  const [downloading, setDownloading] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const navigate = useNavigate();
  const location = useLocation();

  const finish = useCallback(() => setActive(null), []);

  useEffect(() => {
    try {
      if (active) localStorage.setItem(STORAGE_KEY, JSON.stringify(active));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
  }, [active]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const notify = useCallback((message = DEFAULT_MESSAGE, title = 'Traitement lancé') => {
    window.clearTimeout(toastTimer.current);
    setToast({ title, message, key: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 10000);
  }, []);

  const start = useCallback((id: number, title: string) => {
    setCompleted(null);
    setActive({ id, title, progress: 0, status: 'pending' });
    notify();
  }, [notify]);

  const complete = useCallback((id: number, title?: string) => {
    const name = title || `sous-titres-${id}`;
    setActive(null);
    setCompleted({ id, title: name, slug: title ? projectName(title) : String(id) });
  }, []);

  const report = useCallback((patch: Partial<Pick<ActiveProcessing, 'progress' | 'status'>>) => {
    setActive((previous) => {
      if (!previous) return previous;
      const next = { ...previous, ...patch };
      if (next.status === 'completed' || next.status === 'error' || next.progress >= 100) return null;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await api.get(endpoints.progress(active.id));
        if (cancelled) return;
        const progress = Number(data.progress) || 0;
        const status = String(data.status || '');
        if (status === 'completed' || progress >= 100) {
          let title = '';
          try {
            const { data: project } = await api.get(endpoints.project(active.id));
            title = project.title || '';
          } catch {
            title = '';
          }
          if (!cancelled) complete(active.id, title);
          return;
        }
        if (status === 'error') {
          finish();
          return;
        }
        setActive((previous) => previous && previous.id === active.id ? { ...previous, progress, status } : previous);
      } catch (err) {
        const responseStatus = (err as { response?: { status?: number } })?.response?.status;
        if (responseStatus === 404) finish();
      }
    };

    poll();
    const interval = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [active?.id, complete, finish]);

  const showFab = active !== null && isAuthenticated() && !location.pathname.startsWith('/processing');
  const progress = Math.round(active?.progress || 0);

  async function downloadCompleted(format: 'srt' | 'vtt') {
    if (!completed) return;
    setDownloading(format);
    try {
      const response = await api.get(endpoints.download(completed.id), {
        params: { format },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${completed.title}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      notify('Impossible de lancer le téléchargement. Réessayez.', 'Téléchargement impossible');
    } finally {
      setDownloading('');
    }
  }

  return <ProcessingContext.Provider value={{ active, start, report, complete, finish }}>
    {children}

    {toast && <div key={toast.key} className="app-toast" role="status">
      <span className="app-toast-icon"><Info size={18}/></span>
      <div className="app-toast-body"><strong>{toast.title}</strong><p>{toast.message}</p></div>
      <button type="button" aria-label="Fermer la notification" onClick={() => setToast(null)}><X size={16}/></button>
    </div>}

    {showFab && active && <button
      type="button"
      className="processing-fab"
      onClick={() => navigate(`/processing/${projectName(active.title)}`)}
      aria-label={`Suivre le traitement de ${active.title}`}
    >
      <span className="processing-fab-ring" style={{ background: `conic-gradient(#a79bff ${progress}%, rgba(255,255,255,.14) 0)` }}>
        <LoaderCircle size={18} className="spin"/>
      </span>
      <span className="processing-fab-text">
        <strong>Traitement en cours</strong>
        <small>{progress} % · {active.title}</small>
      </span>
    </button>}

    {completed && isAuthenticated() && <div
      className="confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setCompleted(null);
      }}
    >
      <div className="confirm-dialog success-dialog" role="dialog" aria-modal="true" aria-labelledby="global-success-title" aria-describedby="global-success-desc">
        <button type="button" className="auth-modal-close success-close" onClick={() => setCompleted(null)} aria-label="Fermer">
          <X size={18}/>
        </button>
        <span className="success-icon"><CheckCircle2 size={26}/></span>
        <h3 id="global-success-title">Traduction terminée !</h3>
        <p id="global-success-desc">Votre fichier est prêt. Veuillez le télécharger en cliquant sur le bouton ci-dessous.</p>
        <div className="success-warning">
          <Clock3 size={16}/>
          <span>Votre fichier sera automatiquement supprimé dans <strong>2 heures</strong> de votre historique. Pensez à le télécharger dès maintenant.</span>
        </div>
        <div className="success-actions">
          <button type="button" className="button primary" onClick={() => downloadCompleted('srt')} disabled={downloading !== ''}>
            <Download size={17}/><span>{downloading === 'srt' ? 'Téléchargement...' : 'Télécharger le SRT'}</span>
          </button>
          <button type="button" className="button secondary" onClick={() => downloadCompleted('vtt')} disabled={downloading !== ''}>
            <Download size={17}/><span>{downloading === 'vtt' ? 'Téléchargement...' : 'Télécharger le VTT'}</span>
          </button>
        </div>
        <button type="button" className="success-result-link" onClick={() => {
          const slug = completed.slug;
          setCompleted(null);
          navigate(`/result/${slug}`);
        }}>Voir le résultat</button>
      </div>
    </div>}
  </ProcessingContext.Provider>;
}

export function useProcessing() {
  const context = useContext(ProcessingContext);
  if (context === undefined) {
    throw new Error('useProcessing must be used within a ProcessingProvider');
  }
  return context;
}
