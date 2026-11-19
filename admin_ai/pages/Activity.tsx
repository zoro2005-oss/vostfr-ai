import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, History } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { AuditRow, Paginated } from '../types';
import { DataTable, Pagination, formatDate, useToast, type Column } from '../ui';

const actionLabels: Record<string, string> = {
  'user.updated': 'Compte utilisateur modifié',
  'user.deleted': 'Compte utilisateur supprimé',
  'user.reset': 'Compte utilisateur réinitialisé',
  'credits.adjusted': 'Crédits modifiés',
  'subscription.assigned': 'Abonnement attribué',
  'plan.created': 'Nouveau forfait créé',
  'plan.updated': 'Forfait modifié',
  'payment.refunded': 'Paiement remboursé',
  'generation.retried': 'Vidéo relancée',
  'generation.cancelled': 'Vidéo annulée',
  'notification.sent': 'Notification envoyée',
  'ticket.updated': 'Demande d’assistance mise à jour',
  'admin.login': 'Connexion administrateur',
  'admin.created': 'Nouvel administrateur créé',
  'settings.updated': 'Paramètres modifiés',
};

const actionLabel = (action: string) => actionLabels[action] || action;

export default function Activity() {
  const toast = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get<Paginated<AuditRow>>('/activity', { q, action, page, page_size: 20 })
      .then((data) => { setRows(data.items); setTotal(data.total); })
      .catch((error) => toast.error(getApiError(error)))
      .finally(() => setLoading(false));
  }, [q, action, page, toast]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<AuditRow>[] = [
    { key: 'date', label: 'Date', render: (row) => formatDate(row.created_at) },
    { key: 'action', label: 'Ce qui s’est passé', render: (row) => <span className="cell-main">{actionLabel(row.action)}</span> },
    { key: 'author', label: 'Par qui', render: (row) => row.admin },
    { key: 'target', label: 'Pour qui', render: (row) => <>{row.target_type || '—'}{row.target_id ? <span className="cell-sub">#{row.target_id}</span> : null}</> },
  ];

  return <>
    <div className="admin-simple-intro">
      <CheckCircle2 size={20}/>
      <div>
        <strong>En clair</strong>
        <p>Cette page montre qui a fait quoi et quand. Elle sert à vérifier les modifications importantes sans regarder de détails techniques.</p>
      </div>
    </div>

    <div className="admin-toolbar">
      <form className="search" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Chercher une action ou une personne…" aria-label="Rechercher"/>
      </form>
      <div className="admin-filters">
        <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} aria-label="Filtrer par type d’action">
          <option value="">Toutes les actions</option>
          {Object.entries(actionLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
      </div>
    </div>

    <div className="panel">
      <DataTable columns={columns} rows={rows} loading={loading} empty="Aucune action enregistrée."/>
      <Pagination total={total} page={page} pageSize={20} onChange={setPage}/>
    </div>

    <p className="admin-simple-foot"><History size={14}/> Les actions sont conservées automatiquement pour garder une trace des changements.</p>
  </>;
}
