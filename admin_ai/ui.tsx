import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Inbox, LoaderCircle, X, type LucideIcon } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; message: string };
type ToastApi = {
  notify: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++toastId;
    setToasts((current) => [...current, { id, kind, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500);
  }, []);
  const api: ToastApi = {
    notify,
    success: (message) => notify(message, 'success'),
    error: (message) => notify(message, 'error'),
  };
  return <ToastContext.Provider value={api}>
    {children}
    <div className="admin-toast-stack">
      {toasts.map((toast) => <div key={toast.id} className={`admin-toast ${toast.kind}`}>
        {toast.kind === 'success' ? <CheckCircle2 size={18}/> : toast.kind === 'error' ? <AlertCircle size={18}/> : <Inbox size={18}/>}
        <span>{toast.message}</span>
        <button type="button" aria-label="Fermer" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><X size={15}/></button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast doit être utilisé dans ToastProvider');
  return context;
}

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return <div className="panel-heading">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-.8px' }}>{title}</h1>
      {description && <p style={{ margin: '6px 0 0' }}>{description}</p>}
    </div>
    {actions && <div className="admin-actions">{actions}</div>}
  </div>;
}

export function Panel({ title, subtitle, actions, children }: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return <section className="panel">
    {title && <div className="admin-panel-head">
      <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
      {actions && <div className="admin-actions">{actions}</div>}
    </div>}
    {children}
  </section>;
}

export function Stat({ icon: Icon, label, value, hint, tone }: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'violet' | 'blue' | 'green' | 'orange';
}) {
  return <div className="stat-card">
    <span className="stat-icon" style={tone === 'blue' ? { background: 'rgba(10,132,255,.18)', color: '#6fb7ff' } : tone === 'green' ? { background: 'rgba(48,209,88,.16)', color: '#5ee07f' } : tone === 'orange' ? { background: 'rgba(255,159,10,.18)', color: '#ffbf5c' } : undefined}>
      <Icon size={19}/>
    </span>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    {hint && <div className="stat-delta"><small>{hint}</small></div>}
  </div>;
}

export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
};

export function DataTable<T>({ columns, rows, empty = 'Aucune donnée', loading = false }: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  loading?: boolean;
}) {
  if (loading) return <div className="admin-loading"><LoaderCircle size={20} className="spin"/> Chargement…</div>;
  if (rows.length === 0) return <div className="admin-empty"><Inbox size={26}/><span>{empty}</span></div>;
  return <div className="admin-table-wrap">
    <table className="admin-table">
      <thead><tr>{columns.map((column) => <th key={column.key} className={column.numeric ? 'numeric' : undefined}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={(row as { id?: number }).id ?? index}>
        {columns.map((column) => <td key={column.key} className={column.numeric ? 'numeric' : undefined}>{column.render(row)}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function Pagination({ total, page, pageSize, onChange }: {
  total: number;
  page: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="admin-pagination">
    <span>{total} résultat{total > 1 ? 's' : ''} · page {page} sur {pages}</span>
    <div className="page-buttons">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Précédent</button>
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Suivant</button>
    </div>
  </div>;
}

export function Modal({ open, title, description, onClose, children, footer, wide = false }: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="admin-modal" role="dialog" aria-modal="true" style={wide ? { width: 'min(900px,100%)' } : undefined}>
      <div className="admin-modal-head">
        <div><h3>{title}</h3>{description && <p>{description}</p>}</div>
        <button type="button" className="admin-icon-btn" aria-label="Fermer" onClick={onClose}><X size={17}/></button>
      </div>
      <div className="admin-modal-body">{children}</div>
      {footer && <div className="admin-modal-foot">{footer}</div>}
    </div>
  </div>;
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading = false }: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return <Modal open={open} title={title} onClose={onCancel} footer={<>
    <button type="button" className="button secondary" onClick={onCancel}>Annuler</button>
    <button type="button" className="button danger" disabled={loading} onClick={onConfirm}>{loading ? 'Traitement…' : 'Confirmer'}</button>
  </>}>
    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{message}</p>
  </Modal>;
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  let tone = '';
  if (['completed', 'done', 'success', 'active', 'resolved', 'paid', 'successful', 'terminé', 'terminée'].includes(normalized)) tone = 'green';
  else if (['error', 'failed', 'cancelled', 'suspended', 'danger', 'high', 'rejected', 'expired'].includes(normalized)) tone = 'red';
  else if (['pending', 'waiting', 'new', 'en attente', 'refunded', 'pending_payment'].includes(normalized)) tone = 'orange';
  else if (['processing', 'analyzing', 'translating', 'audio', 'assembling', 'in_progress', 'encours', 'open', 'progressing'].includes(normalized)) tone = 'violet';
  else if (['premium', 'finance', 'super_admin', 'admin', 'tech', 'support'].includes(normalized)) tone = 'blue';
  return <span className={`admin-badge ${tone}`}><i/>{value}</span>;
}

export const formatNumber = (value: number | undefined | null) => new Intl.NumberFormat('fr-FR').format(value ?? 0);
export const formatMoney = (value: number | undefined | null, currency = 'USD') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value ?? 0);
export const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
