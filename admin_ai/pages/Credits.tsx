import { useCallback, useEffect, useState } from 'react';
import { Coins, Save } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { CreditRow, Paginated, UserRow } from '../types';
import { DataTable, Modal, Pagination, StatusBadge, useToast, type Column } from '../ui';

type CreditUser = { id: number; user: string; full_name: string; credits: number; consumed: number; plan: string };
type Rules = { monthly_reset: boolean; cost_per_generation: number; anomaly_threshold: number };

export default function Credits() {
  const toast = useToast();
  const [users, setUsers] = useState<CreditUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [ledger, setLedger] = useState<CreditRow[]>([]);
  const [rules, setRules] = useState<Rules | null>(null);
  const [adjustFor, setAdjustFor] = useState<CreditUser | null>(null);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    adminApi.get<Paginated<CreditUser>>('/credits', { q, page, page_size: 20 })
      .then((data) => { setUsers(data.items); setTotal(data.total); })
      .catch((error) => toast.error(getApiError(error)));
  }, [q, page, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    adminApi.get<CreditRow[]>('/credits/ledger').then(setLedger).catch((error) => toast.error(getApiError(error)));
    adminApi.get<Rules>('/credits/rules').then(setRules).catch((error) => toast.error(getApiError(error)));
  }, [toast]);

  const columns: Column<CreditUser>[] = [
    { key: 'user', label: 'Utilisateur', render: (row) => <><span className="cell-main">{row.full_name || row.user}</span><span className="cell-sub">{row.user}</span></> },
    { key: 'plan', label: 'Abonnement', render: (row) => <StatusBadge value={row.plan}/> },
    { key: 'consumed', label: 'Générations', render: (row) => row.consumed, numeric: true },
    { key: 'credits', label: 'Crédits disponibles', render: (row) => <strong>{row.credits}</strong>, numeric: true },
    { key: 'action', label: '', render: (row) => <div className="admin-actions-cell">
      <button type="button" className="admin-icon-btn" title="Ajuster" onClick={() => { setAdjustFor(row); setDelta(0); setReason(''); }}><Coins size={15}/></button>
    </div> },
  ];

  return <>
    <div className="admin-toolbar">
      <form className="search" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Rechercher un utilisateur…" aria-label="Rechercher"/>
      </form>
    </div>

    <div className="panel">
      <DataTable columns={columns} rows={users} empty="Aucun utilisateur."/>
      <Pagination total={total} page={page} pageSize={20} onChange={setPage}/>
    </div>

    <div className="admin-grid">
      <div className="panel">
        <div className="admin-panel-head"><div><h3>Règles de consommation</h3><p>Configuration centralisée des crédits</p></div></div>
        {!rules ? <div className="admin-loading">Chargement…</div> : <div className="admin-form">
          <label className="admin-field"><span>Renouvellement mensuel</span><select value={rules.monthly_reset ? 'yes' : 'no'} onChange={(event) => setRules({ ...rules, monthly_reset: event.target.value === 'yes' })}><option value="yes">Activé</option><option value="no">Désactivé</option></select></label>
          <label className="admin-field"><span>Coût par génération</span><input type="number" min="0" value={rules.cost_per_generation} onChange={(event) => setRules({ ...rules, cost_per_generation: Number(event.target.value) })}/></label>
          <label className="admin-field wide"><span>Seuil de consommation anormale</span><input type="number" min="1" value={rules.anomaly_threshold} onChange={(event) => setRules({ ...rules, anomaly_threshold: Number(event.target.value) })}/></label>
          <div className="admin-form-footer"><button type="button" className="button primary" onClick={() => rules && adminApi.put('/credits/rules', rules).then(() => toast.success('Règles enregistrées')).catch((error) => toast.error(getApiError(error)))}><Save size={16}/> Enregistrer</button></div>
        </div>}
      </div>
      <div className="panel">
        <div className="admin-panel-head"><div><h3>Journal des crédits</h3><p>Toutes les modifications manuelles et automatiques</p></div></div>
        <div className="admin-list">
          {ledger.length === 0 && <div className="admin-empty">Aucune modification enregistrée.</div>}
          {ledger.slice(0, 20).map((row) => <div key={row.id} className="admin-list-row">
            <div className="grow"><strong>{row.user}</strong><small>{row.reason}</small></div>
            <span style={{ fontWeight: 700, color: row.delta >= 0 ? '#5ee07f' : '#ff8b82' }}>{row.delta >= 0 ? '+' : ''}{row.delta}</span>
          </div>)}
        </div>
      </div>
    </div>

    <Modal open={Boolean(adjustFor)} title="Ajuster les crédits" description={adjustFor?.user} onClose={() => setAdjustFor(null)} footer={<>
      <button type="button" className="button secondary" onClick={() => setAdjustFor(null)}>Annuler</button>
      <button type="button" className="button primary" onClick={() => adjustFor && adminApi.post(`/users/${adjustFor.id}/credits`, { delta, reason })
        .then(() => { toast.success('Crédits mis à jour'); setAdjustFor(null); load(); })
        .catch((error) => toast.error(getApiError(error)))}>Appliquer</button>
    </>}>
      <div className="admin-form">
        <label className="admin-field"><span>Variation</span><input type="number" value={delta} onChange={(event) => setDelta(Number(event.target.value))}/></label>
        <label className="admin-field"><span>Motif</span><input value={reason} onChange={(event) => setReason(event.target.value)}/></label>
      </div>
    </Modal>
  </>;
}
