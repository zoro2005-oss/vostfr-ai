import { useCallback, useEffect, useState } from 'react';
import { Eye, Send } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { AdminRow, TicketRow } from '../types';
import { DataTable, Modal, StatusBadge, formatDate, useToast, type Column } from '../ui';

export default function Support() {
  const toast = useToast();
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<TicketRow | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi.get<TicketRow[]>('/tickets', { status, q }).then(setRows).catch((error) => toast.error(getApiError(error)));
  }, [status, q, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { adminApi.get<AdminRow[]>('/assignees').then(setAdmins).catch(() => undefined); }, []);

  const open = (row: TicketRow) => {
    adminApi.get<TicketRow>(`/tickets/${row.id}`).then(setDetail).catch((error) => toast.error(getApiError(error)));
  };

  const update = async (patch: Record<string, unknown>) => {
    if (!detail) return;
    setBusy(true);
    try {
      const updated = await adminApi.patch<TicketRow>(`/tickets/${detail.id}`, patch);
      setDetail({ ...detail, ...updated });
      toast.success('Ticket mis à jour');
      load();
    } catch (error) { toast.error(getApiError(error)); }
    finally { setBusy(false); }
  };

  const sendReply = async () => {
    if (!detail || !reply.trim()) { toast.error('Le message ne peut pas être vide'); return; }
    setBusy(true);
    try {
      await adminApi.post(`/tickets/${detail.id}/messages`, { body: reply });
      setReply('');
      open(detail);
      toast.success('Réponse envoyée');
      load();
    } catch (error) { toast.error(getApiError(error)); }
    finally { setBusy(false); }
  };

  const columns: Column<TicketRow>[] = [
    { key: 'subject', label: 'Objet', render: (row) => <span className="cell-main">{row.subject}</span> },
    { key: 'user', label: 'Utilisateur', render: (row) => row.user },
    { key: 'status', label: 'Statut', render: (row) => <StatusBadge value={row.status}/> },
    { key: 'priority', label: 'Priorité', render: (row) => <StatusBadge value={row.priority === 'high' ? 'high' : row.priority === 'low' ? 'waiting' : 'active'}/> },
    { key: 'messages', label: 'Messages', render: (row) => row.messages, numeric: true },
    { key: 'updated', label: 'Mise à jour', render: (row) => formatDate(row.updated_at) },
    { key: 'actions', label: '', render: (row) => <div className="admin-actions-cell">
      <button type="button" className="admin-icon-btn" title="Ouvrir" onClick={() => open(row)}><Eye size={15}/></button>
    </div> },
  ];

  return <>
    <div className="admin-toolbar">
      <form className="search" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Rechercher un ticket…" aria-label="Rechercher un ticket"/>
      </form>
      <div className="admin-filters">
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option><option value="new">Nouveau</option><option value="in_progress">En cours</option><option value="pending">En attente</option><option value="resolved">Résolu</option>
        </select>
      </div>
    </div>
    <div className="panel">
      <DataTable columns={columns} rows={rows} empty="Aucun ticket."/>
    </div>

    <Modal open={Boolean(detail)} title={detail?.subject || 'Ticket'} description={detail?.user} onClose={() => setDetail(null)} wide>
      {detail && <>
        <div className="admin-form">
          <label className="admin-field"><span>Statut</span><select value={detail.status} disabled={busy} onChange={(event) => { setDetail({ ...detail, status: event.target.value }); update({ status: event.target.value }); }}><option value="new">Nouveau</option><option value="in_progress">En cours</option><option value="pending">En attente</option><option value="resolved">Résolu</option></select></label>
          <label className="admin-field"><span>Priorité</span><select value={detail.priority} disabled={busy} onChange={(event) => { setDetail({ ...detail, priority: event.target.value }); update({ priority: event.target.value }); }}><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option></select></label>
          <label className="admin-field wide"><span>Attribuer à</span><select value={detail.assigned_to || ''} disabled={busy} onChange={(event) => { const value = event.target.value ? Number(event.target.value) : null; setDetail({ ...detail, assigned_to: value }); update({ assigned_admin_id: value }); }}><option value="">Non attribué</option>{admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.email}</option>)}</select></label>
        </div>
        <h4 style={{ margin: '6px 0 0', fontSize: 13 }}>Conversation</h4>
        <div className="admin-list">
          {(detail.message_list || []).length === 0 && <div className="admin-empty">Aucun message.</div>}
          {(detail.message_list || []).map((message) => <div key={message.id} className="admin-list-row" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
              <strong>{message.sender}</strong><StatusBadge value={message.role}/>
              <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-2)' }}>{formatDate(message.created_at)}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{message.body}</p>
          </div>)}
        </div>
        <label className="admin-field"><span>Répondre</span><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Votre réponse au utilisateur…"/></label>
        <div className="admin-modal-foot"><button type="button" className="button primary" disabled={busy} onClick={sendReply}><Send size={16}/> Envoyer la réponse</button></div>
      </>}
    </Modal>
  </>;
}
