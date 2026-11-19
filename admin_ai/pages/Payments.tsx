import { useCallback, useEffect, useState } from 'react';
import { CircleDollarSign, Download, Eye, RotateCcw } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { TransactionRow } from '../types';
import { ConfirmDialog, DataTable, Modal, Panel, StatusBadge, formatDate, formatMoney, useToast, type Column } from '../ui';

type Revenue = {
  total: number;
  refunds: number;
  by_method: { method: string; amount: number }[];
  series: { date: string; value: number }[];
};

export default function Payments() {
  const toast = useToast();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [detail, setDetail] = useState<TransactionRow | null>(null);
  const [refunding, setRefunding] = useState<TransactionRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminApi.get<{ items: TransactionRow[] }>('/transactions', { q, status, method }),
      adminApi.get<Revenue>('/revenue', { days: 30 }),
    ]).then(([transactions, revenueData]) => { setRows(transactions.items); setRevenue(revenueData); })
      .catch((error) => toast.error(getApiError(error)))
      .finally(() => setLoading(false));
  }, [q, status, method, toast]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<TransactionRow>[] = [
    { key: 'ref', label: 'Identifiant', render: (row) => <span className="cell-main">{row.reference}</span> },
    { key: 'user', label: 'Utilisateur', render: (row) => row.user },
    { key: 'amount', label: 'Montant', render: (row) => formatMoney(row.amount, row.currency), numeric: true },
    { key: 'method', label: 'Moyen de paiement', render: (row) => row.method },
    { key: 'plan', label: 'Forfait', render: (row) => row.plan },
    { key: 'status', label: 'Statut', render: (row) => <StatusBadge value={row.status}/> },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.created_at) },
    { key: 'actions', label: '', render: (row) => <div className="admin-actions-cell">
      <button type="button" className="admin-icon-btn" title="Détails" onClick={() => setDetail(row)}><Eye size={15}/></button>
      <button type="button" className="admin-icon-btn" title="Rembourser" disabled={row.status === 'refunded'} onClick={() => setRefunding(row)}><RotateCcw size={15}/></button>
    </div> },
  ];

  const refund = async () => {
    if (!refunding) return;
    setBusy(true);
    try {
      await adminApi.post(`/transactions/${refunding.id}/refund`, { reason: 'Remboursement administratif' });
      toast.success('Remboursement enregistré');
      setRefunding(null);
      load();
    } catch (error) { toast.error(getApiError(error)); }
    finally { setBusy(false); }
  };

  return <>
    {revenue && <div className="admin-kpi">
      <div className="stat-card"><div className="stat-label">Revenus 30 jours</div><div className="stat-value">{formatMoney(revenue.total)}</div></div>
      <div className="stat-card"><div className="stat-label">Remboursements</div><div className="stat-value">{formatMoney(revenue.refunds)}</div></div>
      <div className="stat-card"><div className="stat-label">Moyens de paiement</div><div className="stat-value">{revenue.by_method.length}</div></div>
      <div className="stat-card"><div className="stat-label">Transactions affichées</div><div className="stat-value">{rows.length}</div></div>
    </div>}

    {revenue && <Panel title="Revenus journaliers" subtitle="Paiements réussis sur 30 jours">
      <div className="admin-list">
        {revenue.series.every((point) => point.value === 0) && <div className="admin-empty">Aucun paiement réussi sur les 30 derniers jours.</div>}
        {revenue.series.filter((point) => point.value > 0).map((point) => <div key={point.date} className="admin-list-row">
          <CircleDollarSign size={16} color="#5ee07f"/>
          <div className="grow"><strong>{point.date}</strong></div>
          <strong>{formatMoney(point.value)}</strong>
        </div>)}
      </div>
    </Panel>}

    <div className="admin-toolbar">
      <form className="search" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Référence de transaction…" aria-label="Rechercher une transaction"/>
      </form>
      <div className="admin-filters">
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          <option value="success">Réussi</option><option value="pending">En attente</option>
          <option value="failed">Échoué</option><option value="refunded">Remboursé</option><option value="cancelled">Annulé</option>
        </select>
        <select value={method} onChange={(event) => setMethod(event.target.value)} aria-label="Filtrer par moyen de paiement">
          <option value="">Tous les moyens</option><option value="card">Carte bancaire</option>
          <option value="mtn_momo">MTN MoMo</option><option value="moov_money">Moov Money</option>
          <option value="mobile_money">Mobile Money</option>
        </select>
        <button type="button" className="button secondary" onClick={() => {
          adminApi.download(`/transactions?export=csv&q=${encodeURIComponent(q)}&status=${status}&method=${method}`, 'transactions.csv')
            .catch((error) => toast.error(getApiError(error)));
        }}><Download size={16}/> Exporter CSV</button>
      </div>
    </div>

    <div className="panel">
      <DataTable columns={columns} rows={rows} loading={loading} empty="Aucune transaction trouvée."/>
    </div>

    <Modal open={Boolean(detail)} title={`Transaction ${detail?.reference || ''}`} onClose={() => setDetail(null)}>
      {detail && <div className="admin-detail-grid">
        <div className="admin-detail"><span>Utilisateur</span><strong>{detail.user}</strong></div>
        <div className="admin-detail"><span>Montant</span><strong>{formatMoney(detail.amount, detail.currency)}</strong></div>
        <div className="admin-detail"><span>Moyen de paiement</span><strong>{detail.method}</strong></div>
        <div className="admin-detail"><span>Forfait</span><strong>{detail.plan}</strong></div>
        <div className="admin-detail"><span>Statut</span><strong>{detail.status}</strong></div>
        <div className="admin-detail"><span>Référence prestataire</span><strong>{detail.provider_reference || '—'}</strong></div>
        <div className="admin-detail"><span>Date</span><strong>{formatDate(detail.created_at)}</strong></div>
      </div>}
    </Modal>

    <ConfirmDialog open={Boolean(refunding)} title="Rembourser la transaction" message={`Le montant de ${formatMoney(refunding?.amount || 0, refunding?.currency)} sera marqué comme remboursé et l’action journalisée.`} onCancel={() => setRefunding(null)} onConfirm={refund} loading={busy}/>
  </>;
}
