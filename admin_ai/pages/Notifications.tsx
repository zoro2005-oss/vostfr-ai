import { useCallback, useEffect, useState } from 'react';
import { Bell, Megaphone, Trash2 } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { NotificationRow, UserRow } from '../types';
import { DataTable, Panel, formatDate, useToast, type Column } from '../ui';

const templates: { label: string; title: string; body: string; audience: string }[] = [
  { label: 'Maintenance', title: 'Maintenance programmée', body: 'La plateforme sera temporairement indisponible. Vos projets en cours reprendront automatiquement.', audience: 'all' },
  { label: 'Nouveauté', title: 'Une nouvelle fonctionnalité est disponible', body: 'Découvrez les dernières améliorations de VOSTFR AI dans votre espace.', audience: 'all' },
  { label: 'Changement de forfait', title: 'Votre formule a évolué', body: 'Les conditions de votre abonnement ont été mises à jour. Consultez votre espace pour plus de détails.', audience: 'premium' },
];

export default function Notifications() {
  const toast = useToast();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', user_id: '', kind: 'info' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi.get<NotificationRow[]>('/notifications').then(setRows).catch((error) => toast.error(getApiError(error)));
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    adminApi.get<{ items: UserRow[] }>('/users', { page: 1, page_size: 100 }).then((data) => setUsers(data.items)).catch(() => undefined);
  }, []);

  const send = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error('Le titre et le message sont requis'); return; }
    if (form.audience === 'user' && !form.user_id) { toast.error('Sélectionnez un destinataire'); return; }
    setBusy(true);
    try {
      await adminApi.post('/notifications', {
        title: form.title, body: form.body, audience: form.audience, kind: form.kind,
        ...(form.audience === 'user' ? { user_id: Number(form.user_id) } : {}),
      });
      toast.success('Notification envoyée');
      setForm({ title: '', body: '', audience: 'all', user_id: '', kind: 'info' });
      load();
    } catch (error) { toast.error(getApiError(error)); }
    finally { setBusy(false); }
  };

  const columns: Column<NotificationRow>[] = [
    { key: 'title', label: 'Titre', render: (row) => <span className="cell-main">{row.title}</span> },
    { key: 'body', label: 'Message', render: (row) => <span title={row.body}>{row.body.slice(0, 80)}{row.body.length > 80 ? '…' : ''}</span> },
    { key: 'audience', label: 'Audience', render: (row) => row.audience },
    { key: 'kind', label: 'Type', render: (row) => row.kind },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.created_at) },
    { key: 'actions', label: '', render: (row) => <div className="admin-actions-cell">
      <button type="button" className="admin-icon-btn danger" title="Supprimer" onClick={() => adminApi.remove(`/notifications/${row.id}`).then(() => { toast.success('Notification supprimée'); load(); }).catch((error) => toast.error(getApiError(error)))}><Trash2 size={15}/></button>
    </div> },
  ];

  return <>
    <div className="admin-grid">
      <Panel title="Envoyer une notification" subtitle="Notification dans l’application, prête pour l’e-mail">
        <div className="admin-form">
          <label className="admin-field wide"><span>Modèles rapides</span><div className="admin-filters">
            {templates.map((template) => <button key={template.label} type="button" className="filter-pill" onClick={() => setForm({ title: template.title, body: template.body, audience: template.audience, user_id: '', kind: 'info' })}>{template.label}</button>)}
          </div></label>
          <label className="admin-field"><span>Titre</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label>
          <label className="admin-field"><span>Type</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="info">Information</option><option value="warning">Avertissement</option><option value="success">Success</option></select></label>
          <label className="admin-field wide"><span>Message</span><textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })}/></label>
          <label className="admin-field"><span>Destinataires</span><select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}><option value="all">Tous les utilisateurs</option><option value="premium">Abonnés premium</option><option value="user">Utilisateur précis</option></select></label>
          {form.audience === 'user' && <label className="admin-field"><span>Utilisateur</span><select value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.target.value })}><option value="">Choisir…</option>{users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}</select></label>}
          <div className="admin-form-footer"><button type="button" className="button primary" disabled={busy || (form.audience === 'user' && !form.user_id)} onClick={send}><Megaphone size={16}/> Envoyer</button></div>
        </div>
      </Panel>
      <Panel title="Historique des notifications" subtitle="Messages envoyés depuis l’administration">
        <div className="admin-list">
          {rows.length === 0 && <div className="admin-empty"><Bell size={24}/> Aucune notification envoyée.</div>}
          {rows.map((row) => <div key={row.id} className="admin-list-row">
            <Bell size={16} color="var(--accent)"/>
            <div className="grow"><strong>{row.title}</strong><small>{row.body}</small></div>
            <span style={{ fontSize: 10.5, color: 'var(--text-2)' }}>{row.audience}</span>
          </div>)}
        </div>
      </Panel>
    </div>
    <div className="panel">
      <DataTable columns={columns} rows={rows} empty="Aucune notification."/>
    </div>
  </>;
}
