import { useCallback, useEffect, useState } from 'react';
import { Ban, Eye, LoaderCircle, RefreshCw, ScrollText } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { Paginated, ProjectRow } from '../types';
import { ConfirmDialog, DataTable, Modal, Pagination, StatusBadge, formatDate, formatMoney, useToast, type Column } from '../ui';

const statuses = ['pending', 'analyzing', 'translating', 'audio', 'assembling', 'completed', 'failed', 'cancelled', 'expired'];

export default function Generations() {
  const toast = useToast();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [slow, setSlow] = useState(false);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ProjectRow | null>(null);
  const [cancelFor, setCancelFor] = useState<ProjectRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get<Paginated<ProjectRow>>('/projects', { q, status, slow, page, page_size: 20 })
      .then((data) => { setRows(data.items); setTotal(data.total); })
      .catch((error) => toast.error(getApiError(error)))
      .finally(() => setLoading(false));
  }, [q, status, slow, page, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, [live, load]);

  const openDetail = (row: ProjectRow) => {
    adminApi.get<ProjectRow>(`/projects/${row.id}`).then(setDetail).catch((error) => toast.error(getApiError(error)));
  };

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await action(); toast.success(message); load(); if (detail) openDetail(detail); }
    catch (error) { toast.error(getApiError(error)); }
    finally { setBusy(false); }
  };

  const columns: Column<ProjectRow>[] = [
    { key: 'file', label: 'Fichier', render: (row) => <><span className="cell-main">{row.title}</span><span className="cell-sub">{row.filename}</span></> },
    { key: 'user', label: 'Utilisateur', render: (row) => row.user },
    { key: 'langs', label: 'Langues', render: (row) => <span className="language-pair"><b>{row.source}</b> → {row.target}</span> },
    { key: 'duration', label: 'Durée', render: (row) => row.duration },
    { key: 'status', label: 'Statut', render: (row) => <StatusBadge value={row.status}/> },
    { key: 'progress', label: 'Progression', render: (row) => `${row.progress} %`, numeric: true },
    { key: 'processing', label: 'Traitement', render: (row) => row.processing_minutes === null ? '—' : `${row.processing_minutes} min`, numeric: true },
    { key: 'cost', label: 'Coût estimé', render: (row) => formatMoney(row.cost), numeric: true },
    { key: 'backup', label: 'Sauvegarde', render: (row) => <StatusBadge value={row.backup}/> },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.created_at) },
    { key: 'actions', label: '', render: (row) => <div className="admin-actions-cell">
      <button type="button" className="admin-icon-btn" title="Détails et journaux" onClick={() => openDetail(row)}><Eye size={15}/></button>
      <button type="button" className="admin-icon-btn" title="Journaux" onClick={() => openDetail(row)}><ScrollText size={15}/></button>
      <button type="button" className="admin-icon-btn" title="Relancer" disabled={!['error', 'failed', 'cancelled', 'expired'].includes(row.status)} onClick={() => run(() => adminApi.post(`/projects/${row.id}/retry`), 'Génération relancée')}><RefreshCw size={15}/></button>
      <button type="button" className="admin-icon-btn danger" title="Annuler" disabled={['completed', 'failed', 'cancelled'].includes(row.status)} onClick={() => setCancelFor(row)}><Ban size={15}/></button>
    </div> },
  ];

  return <>
    <div className="admin-toolbar">
      <form className="search" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Titre ou fichier…" aria-label="Rechercher une génération"/>
      </form>
      <div className="admin-filters">
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button type="button" className={`filter-pill ${slow ? 'active' : ''}`} onClick={() => { setSlow(!slow); setPage(1); }}>Traitements anormalement longs</button>
        <button type="button" className={`filter-pill ${live ? 'active' : ''}`} onClick={() => setLive(!live)}>{live ? <LoaderCircle size={14} className="spin"/> : null} Temps réel {live ? 'activé' : 'désactivé'}</button>
      </div>
    </div>

    <div className="panel">
      <DataTable columns={columns} rows={rows} loading={loading} empty="Aucune génération trouvée."/>
      <Pagination total={total} page={page} pageSize={20} onChange={setPage}/>
    </div>

    <Modal open={Boolean(detail)} title={detail?.title || 'Génération'} description={detail?.filename} onClose={() => setDetail(null)} wide footer={<>
      {detail && ['error', 'failed', 'cancelled', 'expired'].includes(detail.status) && <button type="button" className="button primary" disabled={busy} onClick={() => run(() => adminApi.post(`/projects/${detail.id}/retry`), 'Génération relancée')}><RefreshCw size={16}/> Relancer</button>}
      <button type="button" className="button secondary" onClick={() => setDetail(null)}>Fermer</button>
    </>}>
      {detail && <>
        <div className="admin-detail-grid">
          <div className="admin-detail"><span>Utilisateur</span><strong>{detail.user}</strong></div>
          <div className="admin-detail"><span>Statut</span><strong>{detail.status}</strong></div>
          <div className="admin-detail"><span>Langues</span><strong>{detail.source} → {detail.target}</strong></div>
          <div className="admin-detail"><span>Durée vidéo</span><strong>{detail.duration}</strong></div>
          <div className="admin-detail"><span>Abonnement</span><strong>{detail.plan}</strong></div>
          <div className="admin-detail"><span>Coût estimé</span><strong>{formatMoney(detail.cost)}</strong></div>
          <div className="admin-detail"><span>Durée de traitement</span><strong>{detail.processing_minutes ?? '—'} min</strong></div>
          <div className="admin-detail"><span>Sauvegarde</span><strong>{detail.backup}</strong></div>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${detail.progress}%` }}/></div>
        <h4 style={{ margin: '6px 0 0', fontSize: 13 }}>Journaux techniques</h4>
        <div className="admin-log">
          {(detail.logs || []).length === 0 ? 'Aucun journal disponible pour cette génération.' : (detail.logs || []).map((log) => `[${formatDate(log.created_at)}] ${log.level.toUpperCase()} ${log.resource ? `(${log.resource}) ` : ''}— ${log.message}`).join('\n')}
        </div>
      </>}
    </Modal>

    <ConfirmDialog open={Boolean(cancelFor)} title="Annuler la génération" message={`Le traitement de « ${cancelFor?.title} » sera interrompu. Cette action est journalisée.`} onCancel={() => setCancelFor(null)} onConfirm={() => cancelFor && run(async () => {
      await adminApi.post(`/projects/${cancelFor.id}/cancel`); setCancelFor(null);
    }, 'Génération annulée')} loading={busy}/>
  </>;
}
