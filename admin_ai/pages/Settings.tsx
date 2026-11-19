import { useEffect, useState } from 'react';
import { Check, KeyRound, Plus, Save, Trash2 } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import { ConfirmDialog, Panel, StatusBadge, formatDate, useToast } from '../ui';

type SettingsResponse = { values: Record<string, Record<string, unknown>>; secrets: SecretRow[] };
type SecretRow = { id: number; service: string; hint: string; updated_at: string | null };
type DataRequestRow = { id: number; email: string; status: string; created_at: string | null; resolved_at: string | null };

const sections = [
  { key: 'platform', label: 'Identité de la plateforme', fields: [
    { name: 'name', label: 'Nom' }, { name: 'description', label: 'Description' },
    { name: 'contact_email', label: 'E-mail de contact' }, { name: 'maintenance', label: 'Mode maintenance', type: 'boolean' },
  ] },
  { key: 'subscriptions', label: 'Abonnements', fields: [
    { name: 'currency', label: 'Devise' }, { name: 'trial_days', label: 'Jours d’essai', type: 'number' },
    { name: 'monthly_reset', label: 'Renouvellement mensuel', type: 'boolean' },
  ] },
  { key: 'storage', label: 'Stockage', fields: [
    { name: 'provider', label: 'Fournisseur' }, { name: 'max_size_gb', label: 'Taille max (Go)', type: 'number' },
  ] },
  { key: 'notifications', label: 'Notifications', fields: [
    { name: 'email_enabled', label: 'Notifications e-mail', type: 'boolean' },
  ] },
  { key: 'legal', label: 'Informations légales', fields: [
    { name: 'terms', label: 'Conditions d’utilisation', type: 'textarea' },
    { name: 'privacy', label: 'Politique de confidentialité', type: 'textarea' },
  ] },
] as const;

export default function Settings() {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, Record<string, unknown>>>({});
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [dataRequests, setDataRequests] = useState<DataRequestRow[]>([]);
  const [secretForm, setSecretForm] = useState({ service: '', value: '' });
  const [requestForm, setRequestForm] = useState({ email: '' });
  const [deleting, setDeleting] = useState<SecretRow | null>(null);
  const [saving, setSaving] = useState('');

  const load = () => {
    adminApi.get<SettingsResponse>('/settings').then((data) => { setValues(data.values); setSecrets(data.secrets); })
      .catch((error) => toast.error(getApiError(error)));
    adminApi.get<DataRequestRow[]>('/data-requests').then(setDataRequests)
      .catch((error) => toast.error(getApiError(error)));
  };

  useEffect(() => { load(); }, [toast]);

  const saveSection = async (key: string) => {
    setSaving(key);
    try {
      await adminApi.put(`/settings/${key}`, values[key] || {});
      toast.success('Paramètres enregistrés');
    } catch (error) { toast.error(getApiError(error)); }
    finally { setSaving(''); }
  };

  const renderField = (sectionKey: string, field: { name: string; label: string; type?: string }) => {
    const value = values[sectionKey]?.[field.name];
    if (field.type === 'boolean') return <label className="admin-field" key={field.name}>
      <span>{field.label}</span>
      <select value={value === true ? 'yes' : 'no'} onChange={(event) => setValues((current) => ({ ...current, [sectionKey]: { ...current[sectionKey], [field.name]: event.target.value === 'yes' } }))}>
        <option value="yes">Activé</option><option value="no">Désactivé</option>
      </select>
    </label>;
    return <label className={`admin-field ${field.type === 'textarea' ? 'wide' : ''}`} key={field.name}>
      <span>{field.label}</span>
      {field.type === 'textarea'
        ? <textarea value={typeof value === 'string' ? value : ''} onChange={(event) => setValues((current) => ({ ...current, [sectionKey]: { ...current[sectionKey], [field.name]: event.target.value } }))}/>
        : <input type={field.type === 'number' ? 'number' : 'text'} value={typeof value === 'string' || typeof value === 'number' ? value : ''} onChange={(event) => setValues((current) => ({ ...current, [sectionKey]: { ...current[sectionKey], [field.name]: field.type === 'number' ? Number(event.target.value) : event.target.value } }))}/>}
    </label>;
  };

  return <>
    {sections.map((section) => <Panel key={section.key} title={section.label} subtitle={`Clé : ${section.key}`} actions={<button type="button" className="button primary" disabled={saving === section.key} onClick={() => saveSection(section.key)}><Save size={16}/> Enregistrer</button>}>
      <div className="admin-form">{section.fields.map((field) => renderField(section.key, field))}</div>
    </Panel>)}

    <div className="admin-grid">
      <Panel title="Clés API et secrets" subtitle="Stockés chiffrés, jamais réaffichés en clair">
        <div className="admin-list" style={{ marginBottom: 16 }}>
          {secrets.length === 0 && <div className="admin-empty">Aucune clé enregistrée.</div>}
          {secrets.map((secret) => <div key={secret.id} className="admin-list-row">
            <KeyRound size={16} color="var(--accent)"/>
            <div className="grow"><strong>{secret.service}</strong><small>{secret.hint} · {formatDate(secret.updated_at)}</small></div>
            <button type="button" className="admin-icon-btn danger" title="Supprimer" onClick={() => setDeleting(secret)}><Trash2 size={15}/></button>
          </div>)}
        </div>
        <div className="admin-form">
          <label className="admin-field"><span>Service</span><input value={secretForm.service} onChange={(event) => setSecretForm({ ...secretForm, service: event.target.value })} placeholder="GROQ_API_KEY"/></label>
          <label className="admin-field"><span>Valeur</span><input type="password" value={secretForm.value} onChange={(event) => setSecretForm({ ...secretForm, value: event.target.value })}/></label>
          <div className="admin-form-footer"><button type="button" className="button primary" onClick={() => {
            if (!secretForm.service.trim() || !secretForm.value.trim()) { toast.error('Service et valeur requis'); return; }
            adminApi.post('/secrets', secretForm).then(() => { toast.success('Clé enregistrée'); setSecretForm({ service: '', value: '' }); load(); }).catch((error) => toast.error(getApiError(error)));
          }}><Plus size={16}/> Ajouter la clé</button></div>
        </div>
      </Panel>

      <Panel title="Demandes de données" subtitle="Demandes d’export ou de suppression RGPD">
        <div className="admin-list" style={{ marginBottom: 16 }}>
          {dataRequests.length === 0 && <div className="admin-empty">Aucune demande.</div>}
          {dataRequests.map((request) => <div key={request.id} className="admin-list-row">
            <div className="grow"><strong>{request.email}</strong><small>{formatDate(request.created_at)}</small></div>
            <StatusBadge value={request.status}/>
            {request.status !== 'resolved' && <button type="button" className="admin-icon-btn" title="Marquer comme traitée" onClick={() => adminApi.patch(`/data-requests/${request.id}`, { status: 'resolved' }).then(() => { toast.success('Demande traitée'); load(); }).catch((error) => toast.error(getApiError(error)))}><Check size={15}/></button>}
          </div>)}
        </div>
        <div className="admin-form">
          <label className="admin-field wide"><span>Nouvelle demande (e-mail)</span><input value={requestForm.email} onChange={(event) => setRequestForm({ email: event.target.value })} placeholder="utilisateur@exemple.com"/></label>
          <div className="admin-form-footer"><button type="button" className="button secondary" onClick={() => {
            if (!requestForm.email.trim()) { toast.error('E-mail requis'); return; }
            adminApi.post('/data-requests', requestForm).then(() => { toast.success('Demande créée'); setRequestForm({ email: '' }); load(); }).catch((error) => toast.error(getApiError(error)));
          }}><Plus size={16}/> Créer une demande</button></div>
        </div>
      </Panel>
    </div>

    <ConfirmDialog open={Boolean(deleting)} title="Supprimer la clé" message={`La clé « ${deleting?.service} » sera supprimée définitivement du coffre chiffré.`} onCancel={() => setDeleting(null)} onConfirm={() => deleting && adminApi.remove(`/secrets/${deleting.id}`).then(() => { toast.success('Clé supprimée'); setDeleting(null); load(); }).catch((error) => toast.error(getApiError(error)))}/>
  </>;
}
