import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ban, Coins, Eye, History, Pencil, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { AdminMe, Paginated, PlanRow, UserRow } from '../types';
import { ConfirmDialog, DataTable, Modal, Pagination, StatusBadge, formatDate, formatNumber, useToast, type Column } from '../ui';

type Detail = UserRow;

export default function Users() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [creditsFor, setCreditsFor] = useState<UserRow | null>(null);
  const [subscribeFor, setSubscribeFor] = useState<UserRow | null>(null);
  const [activityFor, setActivityFor] = useState<UserRow | null>(null);
  const [activity, setActivity] = useState<{ projects: UserRow['projects']; transactions: UserRow['transactions'] } | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [form, setForm] = useState({ full_name: '', email: '', is_active: true, role: 'user' });
  const [creditForm, setCreditForm] = useState({ delta: 0, reason: '' });
  const [planId, setPlanId] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);

  const can = (permission: string) => Boolean(admin && (admin.permissions.includes('*') || admin.permissions.includes(permission)));

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get<Paginated<UserRow>>('/users', { q, status, plan, page, page_size: 20 })
      .then((data) => { setRows(data.items); setTotal(data.total); })
      .catch((error) => toast.error(getApiError(error)))
      .finally(() => setLoading(false));
  }, [q, status, plan, page, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { adminApi.get<AdminMe>('/me').then(setAdmin).catch(() => undefined); }, []);
  useEffect(() => {
    if (can('plans')) adminApi.get<PlanRow[]>('/plans').then(setPlans).catch(() => undefined);
  }, [admin]);

  const openDetail = (row: UserRow) => {
    adminApi.get<Detail>(`/users/${row.id}`).then(setDetail).catch((error) => toast.error(getApiError(error)));
  };

  const openActivity = (row: UserRow) => {
    setActivityFor(row);
    setActivity(null);
    adminApi.get<{ projects: UserRow['projects']; transactions: UserRow['transactions'] }>(`/users/${row.id}/activity`)
      .then(setActivity).catch((error) => toast.error(getApiError(error)));
  };

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await action(); toast.success(message); load(); }
    catch (error) { toast.error(getApiError(error)); }
    finally { setBusy(false); }
  };

  const columns: Column<UserRow>[] = [
    { key: 'user', label: 'Utilisateur', render: (row) => <>
      <span className="cell-main">{row.full_name || '—'}</span><span className="cell-sub">{row.email}</span>
    </> },
    { key: 'created', label: 'Inscription', render: (row) => formatDate(row.created_at) },
    { key: 'account', label: 'Compte', render: (row) => <StatusBadge value={row.plan}/> },
    { key: 'generations', label: 'Générations', render: (row) => formatNumber(row.generations), numeric: true },
    { key: 'credits', label: 'Crédits', render: (row) => formatNumber(row.credits), numeric: true },
    { key: 'status', label: 'Statut', render: (row) => <StatusBadge value={row.status}/> },
    { key: 'last', label: 'Dernière activité', render: (row) => formatDate(row.last_activity) },
    { key: 'actions', label: '', render: (row) => <div className="admin-actions-cell">
      <button type="button" className="admin-icon-btn" title="Voir le profil" onClick={() => openDetail(row)}><Eye size={15}/></button>
      <button type="button" className="admin-icon-btn" title="Modifier" onClick={() => { setEditing(row); setForm({ full_name: row.full_name, email: row.email, is_active: row.status === 'active', role: row.role }); }}><Pencil size={15}/></button>
      {can('credits') && <button type="button" className="admin-icon-btn" title="Crédits" onClick={() => { setCreditsFor(row); setCreditForm({ delta: 0, reason: '' }); }}><Coins size={15}/></button>}
      <button type="button" className="admin-icon-btn" title="Activité" onClick={() => openActivity(row)}><History size={15}/></button>
      <button type="button" className="admin-icon-btn" title="Suspendre ou réactiver" onClick={() => run(() => adminApi.patch(`/users/${row.id}`, { is_active: row.status !== 'active' }), row.status === 'active' ? 'Compte suspendu' : 'Compte réactivé')}><Ban size={15}/></button>
      <button type="button" className="admin-icon-btn" title="Réinitialiser les données" onClick={() => setResetting(row)}><RotateCcw size={15}/></button>
      <button type="button" className="admin-icon-btn danger" title="Supprimer" onClick={() => setDeleting(row)}><Trash2 size={15}/></button>
    </div> },
  ];

  return <>
    <div className="admin-toolbar">
      <form className="search" onSubmit={(event) => { event.preventDefault(); setParams(q ? { q } : {}); setPage(1); load(); }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Nom ou e-mail…" aria-label="Rechercher un utilisateur"/>
      </form>
      <div className="admin-filters">
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option><option value="active">Actifs</option><option value="suspended">Suspendus</option>
        </select>
        {can('plans') ? <select value={plan} onChange={(event) => { setPlan(event.target.value); setPage(1); }} aria-label="Filtrer par abonnement">
          <option value="">Tous les abonnements</option>
          {plans.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
          <option value="FREE">Gratuit</option>
        </select> : <select disabled value="" aria-label="Filtrer par abonnement"><option>Abonnements non disponibles</option></select>}
        <button type="button" className="button secondary" onClick={() => { setQ(''); setStatus(''); setPlan(''); setParams({}); setPage(1); }}>Réinitialiser</button>
      </div>
    </div>

    <div className="panel">
      <DataTable columns={columns} rows={rows} loading={loading} empty="Aucun utilisateur ne correspond aux filtres."/>
      <Pagination total={total} page={page} pageSize={20} onChange={setPage}/>
    </div>

    <Modal open={Boolean(detail)} title="Fiche utilisateur" description={detail?.email} onClose={() => setDetail(null)} wide footer={<>
      {detail && can('plans') && <button type="button" className="button primary" onClick={() => { setSubscribeFor(detail); setPlanId(plans[0]?.id || ''); }}><UserPlus size={16}/> Attribuer un abonnement</button>}
      <button type="button" className="button secondary" onClick={() => setDetail(null)}>Fermer</button>
    </>}>
      {detail && <>
        <div className="admin-detail-grid">
          <div className="admin-detail"><span>Nom complet</span><strong>{detail.full_name || '—'}</strong></div>
          <div className="admin-detail"><span>E-mail</span><strong>{detail.email}</strong></div>
          <div className="admin-detail"><span>Rôle</span><strong>{detail.role}</strong></div>
          <div className="admin-detail"><span>Statut</span><strong>{detail.status}</strong></div>
          <div className="admin-detail"><span>Abonnement</span><strong>{detail.plan_name}</strong></div>
          <div className="admin-detail"><span>Crédits</span><strong>{detail.credits}</strong></div>
          <div className="admin-detail"><span>Générations</span><strong>{detail.generations}</strong></div>
          <div className="admin-detail"><span>Inscription</span><strong>{formatDate(detail.created_at)}</strong></div>
        </div>
        <h4 style={{ margin: '6px 0 0', fontSize: 13 }}>Vidéos générées</h4>
        <div className="admin-list">
          {(detail.projects || []).length === 0 && <div className="admin-empty">Aucune vidéo générée.</div>}
          {(detail.projects || []).slice(0, 5).map((project) => <div key={project.id} className="admin-list-row">
            <div className="grow"><strong>{project.title}</strong><small>{project.source} → {project.target}</small></div>
            <StatusBadge value={project.status}/>
          </div>)}
        </div>
        <h4 style={{ margin: '6px 0 0', fontSize: 13 }}>Paiements</h4>
        <div className="admin-list">
          {(detail.transactions || []).length === 0 && <div className="admin-empty">Aucun paiement.</div>}
          {(detail.transactions || []).slice(0, 5).map((transaction) => <div key={transaction.id} className="admin-list-row">
            <div className="grow"><strong>{transaction.reference}</strong><small>{transaction.method} · {formatDate(transaction.created_at)}</small></div>
            <StatusBadge value={transaction.status}/>
          </div>)}
        </div>
      </>}
    </Modal>

    <Modal open={Boolean(editing)} title="Modifier l’utilisateur" onClose={() => setEditing(null)} footer={<>
      <button type="button" className="button secondary" onClick={() => setEditing(null)}>Annuler</button>
      <button type="button" className="button primary" disabled={busy} onClick={() => editing && run(async () => {
        const payload = admin?.role === 'super_admin'
          ? form
          : { full_name: form.full_name, email: form.email, is_active: form.is_active };
        await adminApi.patch(`/users/${editing.id}`, payload); setEditing(null);
      }, 'Utilisateur mis à jour')}>Enregistrer</button>
    </>}>
      <div className="admin-form">
        <label className="admin-field"><span>Nom complet</span><input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })}/></label>
        <label className="admin-field"><span>E-mail</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label>
        <label className="admin-field"><span>Statut</span><select value={form.is_active ? 'active' : 'suspended'} onChange={(event) => setForm({ ...form, is_active: event.target.value === 'active' })}><option value="active">Actif</option><option value="suspended">Suspendu</option></select></label>
        {admin?.role === 'super_admin' && <label className="admin-field"><span>Rôle</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="user">Utilisateur</option><option value="support">Support</option><option value="finance">Gestionnaire financier</option><option value="tech">Responsable technique</option><option value="admin">Administrateur</option><option value="super_admin">Super administrateur</option></select></label>}
      </div>
    </Modal>

    <Modal open={Boolean(creditsFor)} title="Ajuster les crédits" description={creditsFor?.email} onClose={() => setCreditsFor(null)} footer={<>
      <button type="button" className="button secondary" onClick={() => setCreditsFor(null)}>Annuler</button>
      <button type="button" className="button primary" disabled={busy} onClick={() => creditsFor && run(async () => {
        await adminApi.post(`/users/${creditsFor.id}/credits`, creditForm); setCreditsFor(null);
      }, 'Crédits mis à jour et journalisés')}>Appliquer</button>
    </>}>
      <div className="admin-form">
        <label className="admin-field"><span>Variation (+ / -)</span><input type="number" value={creditForm.delta} onChange={(event) => setCreditForm({ ...creditForm, delta: Number(event.target.value) })}/></label>
        <label className="admin-field"><span>Motif</span><input value={creditForm.reason} onChange={(event) => setCreditForm({ ...creditForm, reason: event.target.value })} placeholder="Ajustement manuel"/></label>
      </div>
    </Modal>

    <Modal open={Boolean(subscribeFor)} title="Attribuer un abonnement" description={subscribeFor?.email} onClose={() => setSubscribeFor(null)} footer={<>
      <button type="button" className="button secondary" onClick={() => setSubscribeFor(null)}>Annuler</button>
      <button type="button" className="button primary" disabled={busy || !planId} onClick={() => subscribeFor && run(async () => {
        await adminApi.post(`/users/${subscribeFor.id}/subscription`, { plan_id: planId }); setSubscribeFor(null);
      }, 'Abonnement attribué')}>Attribuer</button>
    </>}>
      <label className="admin-field"><span>Formule</span><select value={planId} onChange={(event) => setPlanId(Number(event.target.value))}>{plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </Modal>

    <Modal open={Boolean(activityFor)} title="Historique du compte" description={activityFor?.email} onClose={() => setActivityFor(null)}>
      {!activity && <div className="admin-loading">Chargement…</div>}
      {activity && <>
        <h4 style={{ margin: 0, fontSize: 13 }}>Générations</h4>
        <div className="admin-list">
          {(activity.projects || []).length === 0 && <div className="admin-empty">Aucune génération.</div>}
          {(activity.projects || []).map((project) => <div key={project.id} className="admin-list-row"><div className="grow"><strong>{project.title}</strong><small>{formatDate(project.created_at)}</small></div><StatusBadge value={project.status}/></div>)}
        </div>
        <h4 style={{ margin: '6px 0 0', fontSize: 13 }}>Paiements</h4>
        <div className="admin-list">
          {(activity.transactions || []).length === 0 && <div className="admin-empty">Aucun paiement.</div>}
          {(activity.transactions || []).map((transaction) => <div key={transaction.id} className="admin-list-row"><div className="grow"><strong>{transaction.reference}</strong><small>{formatDate(transaction.created_at)}</small></div><StatusBadge value={transaction.status}/></div>)}
        </div>
      </>}
    </Modal>

    <ConfirmDialog open={Boolean(deleting)} title="Supprimer le compte" message={`Le compte ${deleting?.email} et ses fichiers associés seront définitivement supprimés. Cette action est irréversible.`} onCancel={() => setDeleting(null)} onConfirm={() => deleting && run(async () => {
      await adminApi.remove(`/users/${deleting.id}`); setDeleting(null);
    }, 'Compte supprimé')} loading={busy}/>

    <ConfirmDialog open={Boolean(resetting)} title="Réinitialiser les données" message={`Les vidéos, sous-titres et crédits de ${resetting?.email} seront supprimés. Le compte reste actif.`} onCancel={() => setResetting(null)} onConfirm={() => resetting && run(async () => {
      await adminApi.post(`/users/${resetting.id}/reset`); setResetting(null);
    }, 'Données réinitialisées')} loading={busy}/>
  </>;
}
