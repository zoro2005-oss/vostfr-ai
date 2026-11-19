import { useCallback, useEffect, useState } from 'react';
import { Archive, CheckCircle2, Clock3, Eye, HardDrive, Pencil, Plus, Power, Sparkles, Users } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { PlanRow } from '../types';
import { ConfirmDialog, DataTable, Modal, StatusBadge, formatMoney, useToast } from '../ui';

type PlanForm = {
  code: string; name: string; description: string; price: number; currency: string;
  price_fcfa: number; highlight: string; duration_days: number; generation_limit: string;
  video_max_minutes: string; backup_enabled: boolean; retention_minutes: number;
  premium: boolean; download: boolean; reset_monthly: boolean; fair_use: boolean;
  unlimited_mode: string; is_active: boolean;
};

const emptyForm: PlanForm = {
  code: '', name: '', description: '', price: 0, currency: 'USD', price_fcfa: 0, highlight: '',
  duration_days: 30, generation_limit: '30', video_max_minutes: '60', backup_enabled: false,
  retention_minutes: 120, premium: false, download: false, reset_monthly: false,
  fair_use: false, unlimited_mode: '', is_active: true,
};

const fcfaOf = (plan: PlanRow) => Number(plan.features?.price_fcfa || 0);
const quotaOf = (plan: PlanRow) => plan.generation_limit === null ? 'Illimité' : String(plan.generation_limit);
const retentionOf = (plan: PlanRow) => plan.retention_minutes === 0 ? 'Permanent' : `${plan.retention_minutes} min`;
const videoOf = (plan: PlanRow) => plan.code === 'FREE' ? `${plan.video_max_minutes ?? 150} min avant Premium` : 'Illimitée';
const statusOf = (plan: PlanRow) => plan.is_archived ? 'expired' : plan.is_active ? 'active' : 'suspended';

export default function Plans() {
  const toast = useToast();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlanRow | 'new' | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [subscribersFor, setSubscribersFor] = useState<PlanRow | null>(null);
  const [subscribers, setSubscribers] = useState<{ id: number; user: string; status: string; starts_at: string | null; ends_at: string | null; generations_used: number }[]>([]);
  const [archiving, setArchiving] = useState<PlanRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get<PlanRow[]>('/plans').then(setPlans).catch((error) => toast.error(getApiError(error))).finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (plan: PlanRow) => {
    setEditing(plan);
    setForm({
      code: plan.code, name: plan.name, description: plan.description, price: plan.price, currency: plan.currency,
      price_fcfa: fcfaOf(plan), highlight: String(plan.features?.highlight || ''),
      duration_days: plan.duration_days, generation_limit: plan.generation_limit === null ? '' : String(plan.generation_limit),
      video_max_minutes: plan.video_max_minutes === null ? '' : String(plan.video_max_minutes),
      backup_enabled: plan.backup_enabled, retention_minutes: plan.retention_minutes,
      premium: Boolean(plan.features?.premium), download: Boolean(plan.features?.download),
      reset_monthly: Boolean(plan.features?.reset_monthly), fair_use: Boolean(plan.features?.fair_use),
      unlimited_mode: String(plan.features?.unlimited_mode || ''), is_active: plan.is_active,
    });
  };

  const openSubscribers = (plan: PlanRow) => {
    setSubscribersFor(plan);
    setSubscribers([]);
    adminApi.get<{ id: number; user: string; status: string; starts_at: string | null; ends_at: string | null; generations_used: number }[]>(`/plans/${plan.id}/subscribers`)
      .then(setSubscribers)
      .catch((error) => toast.error(getApiError(error)));
  };

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await action(); toast.success(message); load(); }
    catch (error) { toast.error(getApiError(error)); }
    finally { setBusy(false); }
  };

  const save = () => {
    if (!form.name.trim() || (!editing && !form.code.trim())) { toast.error('Le nom et le code sont requis'); return; }
    const payload = {
      name: form.name, description: form.description, price: Number(form.price), currency: form.currency,
      duration_days: Number(form.duration_days),
      generation_limit: form.generation_limit === '' ? null : Number(form.generation_limit),
      video_max_minutes: form.video_max_minutes === '' ? null : Number(form.video_max_minutes),
      backup_enabled: form.backup_enabled, retention_minutes: Number(form.retention_minutes), is_active: form.is_active,
      features: {
        price_fcfa: Number(form.price_fcfa), highlight: form.highlight.trim(),
        premium: form.premium, download: form.download, reset_monthly: form.reset_monthly,
        fair_use: false,
        ...(form.unlimited_mode ? { unlimited_mode: form.unlimited_mode } : {}),
      },
      ...(editing === 'new' ? { code: form.code } : {}),
    };
    run(async () => {
      if (editing === 'new') await adminApi.post('/plans', payload);
      else if (editing) await adminApi.patch(`/plans/${editing.id}`, payload);
      setEditing(null);
    }, editing === 'new' ? 'Forfait créé' : 'Forfait mis à jour');
  };

  return <>
    <div className="admin-simple-intro">
      <CheckCircle2 size={20}/>
      <div>
        <strong>En clair</strong>
        <p>
          Vous gérez ici les {plans.length} formules proposées aux utilisateurs. Modifiez un prix, une durée ou une limite : le changement apparaît ensuite sur la page « Abonnement » et sur le site public.
        </p>
      </div>
    </div>

    <div className="admin-toolbar">
      <div className="admin-plans-count"><Sparkles size={16}/> {plans.filter((plan) => plan.is_active && !plan.is_archived).length} formule(s) active(s)</div>
      <button type="button" className="button primary" onClick={() => { setEditing('new'); setForm(emptyForm); }}><Plus size={16}/> Créer un forfait</button>
    </div>

    {loading ? <div className="admin-loading">Chargement des forfaits…</div> : plans.length === 0 ? (
      <div className="panel"><div className="admin-empty">Aucun forfait configuré.</div></div>
    ) : (
      <div className="admin-plans-grid">
        {plans.map((plan) => {
          const highlight = String(plan.features?.highlight || '');
          const fcfa = fcfaOf(plan);
          return <article key={plan.id} className={`admin-plan-card ${statusOf(plan) === 'active' ? '' : 'muted'} ${plan.code === 'PREMIUM_30_BACKUP' ? 'featured' : ''}`}>
            <div className="admin-plan-head">
              <div>
                <span className="admin-plan-code">{plan.code}</span>
                <h3>{plan.name}</h3>
                {highlight && <span className="admin-plan-badge">{highlight}</span>}
              </div>
              <StatusBadge value={statusOf(plan)}/>
            </div>

            <p className="admin-plan-description">{plan.description}</p>

            <div className="admin-plan-price">
              <strong>{formatMoney(plan.price, plan.currency)}</strong>
              <span>{fcfa > 0 ? `≈ ${new Intl.NumberFormat('fr-FR').format(fcfa)} FCFA` : 'Gratuit'}</span>
            </div>

            <div className="admin-plan-facts">
              <div><Clock3 size={16}/><span>Durée</span><strong>{plan.duration_days} jours</strong></div>
              <div><Sparkles size={16}/><span>Générations</span><strong>{quotaOf(plan)}</strong></div>
              <div><HardDrive size={16}/><span>Sauvegarde</span><strong>{plan.backup_enabled ? 'Activée' : 'Désactivée'}</strong></div>
              <div><Users size={16}/><span>Abonnés</span><strong>{plan.subscribers}</strong></div>
            </div>

            <div className="admin-plan-more">
              <span>Conservation : {retentionOf(plan)}</span>
              <span>Vidéo : {videoOf(plan)}</span>
            </div>

            <div className="admin-plan-actions">
              <button type="button" className="button secondary" onClick={() => openEdit(plan)}><Pencil size={15}/> Modifier</button>
              <button type="button" className="button secondary" onClick={() => openSubscribers(plan)}><Eye size={15}/> Abonnés</button>
              <button type="button" className="admin-icon-btn" title={plan.is_active ? 'Désactiver' : 'Activer'} onClick={() => run(() => adminApi.patch(`/plans/${plan.id}`, { is_active: !plan.is_active }), plan.is_active ? 'Formule désactivée' : 'Formule activée')}><Power size={15}/></button>
              <button type="button" className="admin-icon-btn danger" title="Archiver" onClick={() => setArchiving(plan)}><Archive size={15}/></button>
            </div>
          </article>;
        })}
      </div>
    )}

    <Modal open={Boolean(editing)} title={editing === 'new' ? 'Nouveau forfait' : `Modifier · ${editing?.name || ''}`} onClose={() => setEditing(null)} wide footer={<>
      <button type="button" className="button secondary" onClick={() => setEditing(null)}>Annuler</button>
      <button type="button" className="button primary" disabled={busy} onClick={save}>Enregistrer</button>
    </>}>
      <div className="admin-form-sections">
        <div className="admin-form-section">
          <h4>Informations</h4>
          <div className="admin-form">
            {editing === 'new' && <label className="admin-field"><span>Code</span><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="PREMIUM_90"/></label>}
            <label className="admin-field"><span>Nom</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label>
            <label className="admin-field wide"><span>Description</span><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></label>
            <label className="admin-field wide"><span>Badge affiché</span><input value={form.highlight} onChange={(event) => setForm({ ...form, highlight: event.target.value })} placeholder="Le plus choisi"/></label>
          </div>
        </div>

        <div className="admin-form-section">
          <h4>Prix</h4>
          <div className="admin-form">
            <label className="admin-field"><span>Prix USD</span><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}/></label>
            <label className="admin-field"><span>Prix approximatif FCFA</span><input type="number" min="0" step="100" value={form.price_fcfa} onChange={(event) => setForm({ ...form, price_fcfa: Number(event.target.value) })}/></label>
            <label className="admin-field"><span>Devise</span><input value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}/></label>
          </div>
        </div>

        <div className="admin-form-section">
          <h4>Durée et limites</h4>
          <div className="admin-form">
            <label className="admin-field"><span>Durée (jours)</span><input type="number" min="1" value={form.duration_days} onChange={(event) => setForm({ ...form, duration_days: Number(event.target.value) })}/></label>
            <label className="admin-field"><span>Générations (vide = illimité)</span><input type="number" min="0" value={form.generation_limit} onChange={(event) => setForm({ ...form, generation_limit: event.target.value })}/></label>
            <label className="admin-field"><span>Vidéo incluse (min, vide = illimité)</span><input type="number" min="0" value={form.video_max_minutes} onChange={(event) => setForm({ ...form, video_max_minutes: event.target.value })}/></label>
            <label className="admin-field"><span>Conservation (min, 0 = permanent)</span><input type="number" min="0" value={form.retention_minutes} onChange={(event) => setForm({ ...form, retention_minutes: Number(event.target.value) })}/></label>
          </div>
        </div>

        <div className="admin-form-section">
          <h4>Options</h4>
          <div className="admin-form">
            <label className="admin-field"><span>Sauvegarde</span><select value={form.backup_enabled ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, backup_enabled: event.target.value === 'yes' })}><option value="no">Désactivée</option><option value="yes">Activée</option></select></label>
            <label className="admin-field"><span>Mode illimité</span><select value={form.unlimited_mode} onChange={(event) => setForm({ ...form, unlimited_mode: event.target.value })}><option value="">Aucun</option><option value="no_hard_count">Sans quota de nombre</option><option value="daily_minutes_cap">Plafond journalier en minutes</option></select></label>
            <label className="admin-field"><span>Formule premium</span><select value={form.premium ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, premium: event.target.value === 'yes' })}><option value="no">Non</option><option value="yes">Oui</option></select></label>
            <label className="admin-field"><span>Téléchargement</span><select value={form.download ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, download: event.target.value === 'yes' })}><option value="no">Désactivé</option><option value="yes">Activé</option></select></label>
            <label className="admin-field"><span>Renouvellement mensuel</span><select value={form.reset_monthly ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, reset_monthly: event.target.value === 'yes' })}><option value="no">Non</option><option value="yes">Oui</option></select></label>
            <label className="admin-field"><span>Statut</span><select value={form.is_active ? 'active' : 'inactive'} onChange={(event) => setForm({ ...form, is_active: event.target.value === 'active' })}><option value="active">Actif</option><option value="inactive">Inactif</option></select></label>
          </div>
        </div>
      </div>
    </Modal>

    <Modal open={Boolean(subscribersFor)} title={`Abonnés · ${subscribersFor?.name || ''}`} onClose={() => setSubscribersFor(null)} wide>
      <DataTable columns={[
        { key: 'user', label: 'Utilisateur', render: (row: { user: string }) => row.user },
        { key: 'status', label: 'Statut', render: (row: { status: string }) => <StatusBadge value={row.status}/> },
        { key: 'start', label: 'Début', render: (row: { starts_at: string | null }) => row.starts_at ? new Date(row.starts_at).toLocaleDateString('fr-FR') : '—' },
        { key: 'end', label: 'Fin', render: (row: { ends_at: string | null }) => row.ends_at ? new Date(row.ends_at).toLocaleDateString('fr-FR') : '—' },
        { key: 'used', label: 'Générations utilisées', render: (row: { generations_used: number }) => row.generations_used, numeric: true },
      ]} rows={subscribers} empty="Aucun abonné pour cette formule."/>
    </Modal>

    <ConfirmDialog open={Boolean(archiving)} title="Archiver le forfait" message={`« ${archiving?.name} » sera archivé et désactivé. Les abonnements existants restent en place.`} onCancel={() => setArchiving(null)} onConfirm={() => archiving && run(async () => {
      await adminApi.remove(`/plans/${archiving.id}`); setArchiving(null);
    }, 'Forfait archivé')} loading={busy}/>
  </>;
}
