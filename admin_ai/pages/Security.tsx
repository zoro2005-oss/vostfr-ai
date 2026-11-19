import { useCallback, useEffect, useState } from 'react';
import { KeyRound, LogOut, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { AdminMe, AdminRow, AuditRow } from '../types';
import { DataTable, Modal, Panel, StatusBadge, formatDate, useToast, type Column } from '../ui';

type NewAdmin = { email: string; full_name: string; password: string; role: string };

export default function Security() {
  const toast = useToast();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewAdmin>({ email: '', full_name: '', password: '', role: 'support' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi.get<AdminRow[]>('/admins').then(setAdmins).catch((error) => toast.error(getApiError(error)));
    adminApi.get<AuditRow[]>('/security/logs').then(setLogs).catch((error) => toast.error(getApiError(error)));
    adminApi.get<AdminMe>('/me').then(setMe).catch(() => undefined);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await action(); toast.success(message); load(); }
    catch (error) { toast.error(getApiError(error)); }
    finally { setBusy(false); }
  };

  const columns: Column<AdminRow>[] = [
    { key: 'email', label: 'Administrateur', render: (row) => <><span className="cell-main">{row.full_name || row.email}</span><span className="cell-sub">{row.email}</span></> },
    { key: 'role', label: 'Rôle', render: (row) => <StatusBadge value={row.role}/> },
    { key: 'status', label: 'Statut', render: (row) => <StatusBadge value={row.is_active ? 'active' : 'suspended'}/> },
    { key: 'last', label: 'Dernière activité', render: (row) => formatDate(row.last_active_at) },
    { key: 'sessions', label: 'Sessions', render: (row) => row.sessions, numeric: true },
    { key: 'actions', label: '', render: (row) => <div className="admin-actions-cell">
      <button type="button" className="admin-icon-btn" title="Changer le rôle" disabled={busy || me?.role !== 'super_admin'} onClick={() => run(() => adminApi.patch(`/admins/${row.id}`, { role: row.role === 'super_admin' ? 'admin' : 'super_admin' }), 'Rôle mis à jour')}><ShieldCheck size={15}/></button>
      <button type="button" className="admin-icon-btn" title={row.is_active ? 'Désactiver' : 'Activer'} disabled={busy || me?.role !== 'super_admin'} onClick={() => run(() => adminApi.patch(`/admins/${row.id}`, { is_active: !row.is_active }), row.is_active ? 'Compte désactivé' : 'Compte activé')}><StatusBadge value={row.is_active ? 'active' : 'suspended'}/></button>
      <button type="button" className="admin-icon-btn danger" title="Révoquer les sessions" disabled={busy} onClick={() => run(() => adminApi.post(`/admins/${row.id}/logout`), 'Sessions révoquées')}><LogOut size={15}/></button>
    </div> },
  ];

  const logColumns: Column<AuditRow>[] = [
    { key: 'date', label: 'Date', render: (row) => formatDate(row.created_at) },
    { key: 'action', label: 'Événement', render: (row) => <span className="cell-main">{row.action}</span> },
    { key: 'admin', label: 'Auteur', render: (row) => row.admin },
    { key: 'target', label: 'Cible', render: (row) => row.target_id || '—' },
  ];

  if (me && !me.permissions.includes('*') && !me.permissions.includes('security')) {
    return <div className="admin-denied"><div className="panel">
      <ShieldCheck size={34} color="var(--accent)"/>
      <h2 style={{ margin: '16px 0 8px', fontSize: 24 }}>Accès réservé</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Votre rôle n’a pas accès à la gestion de la sécurité.</p>
    </div></div>;
  }

  return <>
    <div className="admin-toolbar">
      <button type="button" className="button primary" onClick={() => { setCreating(true); setForm({ email: '', full_name: '', password: '', role: 'support' }); }}><UserPlus size={16}/> Créer un administrateur</button>
    </div>

    <Panel title="Équipe administrative" subtitle="Accès, rôles et sessions actives">
      <DataTable columns={columns} rows={admins} loading={false} empty="Aucun administrateur."/>
    </Panel>

    <Panel title="Journal de sécurité" subtitle="Connexions, créations de comptes et révocations">
      <DataTable columns={logColumns} rows={logs} loading={false} empty="Aucun événement de sécurité."/>
    </Panel>

    <Modal open={creating} title="Nouvel administrateur" description="Le mot de passe sera haché avant stockage." onClose={() => setCreating(false)} footer={<>
      <button type="button" className="button secondary" onClick={() => setCreating(false)}>Annuler</button>
      <button type="button" className="button primary" disabled={busy} onClick={() => {
        if (!form.email.trim() || !form.password.trim()) { toast.error('E-mail et mot de passe requis'); return; }
        run(async () => {
          await adminApi.post('/admins', form);
          setCreating(false);
        }, 'Administrateur créé');
      }}><Plus size={16}/> Créer</button>
    </>}>
      <div className="admin-form">
        <label className="admin-field"><span>Nom complet</span><input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })}/></label>
        <label className="admin-field"><span>E-mail</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label>
        <label className="admin-field"><span>Mot de passe</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}/></label>
        <label className="admin-field"><span>Rôle</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          <option value="support">Support</option><option value="finance">Finance</option>
          <option value="tech">Technique</option><option value="admin">Administrateur</option>
          <option value="super_admin">Super administrateur</option>
        </select></label>
      </div>
      <div className="admin-list" style={{ marginTop: 16 }}>
        <div className="admin-list-row"><KeyRound size={16} color="var(--accent)"/><div className="grow"><strong>Super administrateur</strong><small>Tous les droits, création de rôles et révocation de sessions.</small></div></div>
        <div className="admin-list-row"><ShieldCheck size={16} color="#6fb7ff"/><div className="grow"><strong>Administrateur</strong><small>Gestion courante, hors sécurité et paramètres sensibles.</small></div></div>
        <div className="admin-list-row"><ShieldCheck size={16} color="#cbb8ff"/><div className="grow"><strong>Finance · Support · Technique</strong><small>Périmètres limités définis par les permissions serveur.</small></div></div>
      </div>
    </Modal>
  </>;
}
