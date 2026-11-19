import { useCallback, useEffect, useState } from 'react';
import { Gift, Pencil, Plus, Trash2 } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { PlanRow, PromoRow } from '../types';
import { ConfirmDialog, DataTable, Modal, StatusBadge, formatDate, useToast, type Column } from '../ui';

type PromoForm = { code: string; plan_id: string; discount_percent: number; max_uses: string; expires_at: string; is_active: boolean };
const emptyForm: PromoForm = { code: '', plan_id: '', discount_percent: 10, max_uses: '', expires_at: '', is_active: true };

export default function Promotions() {
  const toast = useToast();
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [editing, setEditing] = useState<PromoRow | 'new' | null>(null);
  const [form, setForm] = useState<PromoForm>(emptyForm);
  const [deleting, setDeleting] = useState<PromoRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi.get<PromoRow[]>('/promo-codes').then(setRows).catch((error) => toast.error(getApiError(error)));
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    adminApi.get<PlanRow[]>('/plans').then(setPlans).catch(() => undefined);
  }, []);

  const openEdit = (row: PromoRow) => {
    setEditing(row);
    setForm({
      code: row.code, plan_id: row.plan_id ? String(row.plan_id) : '', discount_percent: row.discount_percent,
      max_uses: row.max_uses === null ? '' : String(row.max_uses),
      expires_at: row.expires_at ? row.expires_at.slice(0, 10) : '', is_active: row.is_active,
    });
  };

  const save = () => {
    if (!form.code.trim()) { toast.error('Le code est requis'); return; }
    const payload = {
      code: form.code.trim().toUpperCase(),
      plan_id: form.plan_id ? Number(form.plan_id) : null,
      discount_percent: Number(form.discount_percent),
      max_uses: form.max_uses === '' ? null : Number(form.max_uses),
      expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null,
      is_active: form.is_active,
    };
    setBusy(true);
    const request = editing === 'new'
      ? adminApi.post('/promo-codes', payload)
      : adminApi.patch(`/promo-codes/${(editing as PromoRow).id}`, payload);
    request.then(() => { toast.success(editing === 'new' ? 'Code promo créé' : 'Code promo mis à jour'); setEditing(null); load(); })
      .catch((error) => toast.error(getApiError(error)))
      .finally(() => setBusy(false));
  };

  const columns: Column<PromoRow>[] = [
    { key: 'code', label: 'Code', render: (row) => <span className="cell-main">{row.code}</span> },
    { key: 'plan', label: 'Forfait', render: (row) => plans.find((plan) => plan.id === row.plan_id)?.name || 'Tous' },
    { key: 'discount', label: 'Réduction', render: (row) => `${row.discount_percent} %`, numeric: true },
    { key: 'uses', label: 'Utilisations', render: (row) => row.max_uses === null ? `${row.uses} / ∞` : `${row.uses} / ${row.max_uses}`, numeric: true },
    { key: 'expires', label: 'Expiration', render: (row) => row.expires_at ? formatDate(row.expires_at) : 'Jamais' },
    { key: 'status', label: 'Statut', render: (row) => <StatusBadge value={row.is_active ? 'active' : 'suspended'}/> },
    { key: 'actions', label: '', render: (row) => <div className="admin-actions-cell">
      <button type="button" className="admin-icon-btn" title="Modifier" onClick={() => openEdit(row)}><Pencil size={15}/></button>
      <button type="button" className="admin-icon-btn" title="Activer / désactiver" disabled={busy} onClick={() => adminApi.patch(`/promo-codes/${row.id}`, { is_active: !row.is_active }).then(() => { toast.success('Statut mis à jour'); load(); }).catch((error) => toast.error(getApiError(error)))}><StatusBadge value={row.is_active ? 'active' : 'suspended'}/></button>
      <button type="button" className="admin-icon-btn danger" title="Supprimer" onClick={() => setDeleting(row)}><Trash2 size={15}/></button>
    </div> },
  ];

  return <>
    <div className="admin-toolbar">
      <button type="button" className="button primary" onClick={() => { setEditing('new'); setForm(emptyForm); }}><Plus size={16}/> Créer un code promo</button>
    </div>
    <div className="panel">
      <DataTable columns={columns} rows={rows} empty="Aucun code promo."/>
    </div>

    <Modal open={Boolean(editing)} title={editing === 'new' ? 'Nouveau code promo' : 'Modifier le code promo'} onClose={() => setEditing(null)} footer={<>
      <button type="button" className="button secondary" onClick={() => setEditing(null)}>Annuler</button>
      <button type="button" className="button primary" disabled={busy} onClick={save}>Enregistrer</button>
    </>}>
      <div className="admin-form">
        <label className="admin-field"><span>Code</span><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="BIENVENUE10"/></label>
        <label className="admin-field"><span>Forfait concerné</span><select value={form.plan_id} onChange={(event) => setForm({ ...form, plan_id: event.target.value })}><option value="">Tous les forfaits</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
        <label className="admin-field"><span>Réduction (%)</span><input type="number" min="1" max="100" value={form.discount_percent} onChange={(event) => setForm({ ...form, discount_percent: Number(event.target.value) })}/></label>
        <label className="admin-field"><span>Nombre d’utilisations max</span><input type="number" min="0" value={form.max_uses} onChange={(event) => setForm({ ...form, max_uses: event.target.value })} placeholder="Illimité"/></label>
        <label className="admin-field"><span>Date d’expiration</span><input type="date" value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })}/></label>
        <label className="admin-field"><span>Statut</span><select value={form.is_active ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, is_active: event.target.value === 'yes' })}><option value="yes">Actif</option><option value="no">Désactivé</option></select></label>
      </div>
    </Modal>

    <ConfirmDialog open={Boolean(deleting)} title="Supprimer le code promo" message={`Le code « ${deleting?.code} » sera supprimé et ne pourra plus être utilisé.`} onCancel={() => setDeleting(null)} onConfirm={() => deleting && adminApi.remove(`/promo-codes/${deleting.id}`).then(() => { toast.success('Code supprimé'); setDeleting(null); load(); }).catch((error) => toast.error(getApiError(error)))} loading={busy}/>
  </>;
}
