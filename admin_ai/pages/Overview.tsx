import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, CircleDollarSign, Film,
  LoaderCircle, Sparkles, UserPlus, Users,
} from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { OverviewData } from '../types';
import { Panel, Stat, StatusBadge, formatDate, formatMoney, formatNumber, useToast } from '../ui';

const periods = [
  { label: 'Aujourd’hui', value: 1 },
  { label: '7 jours', value: 7 },
  { label: '30 jours', value: 30 },
];

export default function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get<OverviewData>('/overview', { days })
      .then(setData)
      .catch((error) => toast.error(getApiError(error)))
      .finally(() => setLoading(false));
  }, [days, toast]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) return <div className="admin-loading"><LoaderCircle size={20} className="spin"/> Chargement du tableau de bord…</div>;

  const stats = data.stats;
  const periodLabel = days === 1 ? "aujourd’hui" : `sur ${days} jours`;

  return <>
    <div className="admin-toolbar">
      <div className="admin-filters">
        {periods.map((period) => <button
          key={period.value}
          type="button"
          className={`filter-pill ${days === period.value ? 'active' : ''}`}
          onClick={() => setDays(period.value)}
        >{period.label}</button>)}
      </div>
    </div>

    <div className="admin-simple-intro">
      <CheckCircle2 size={20}/>
      <div>
        <strong>En clair</strong>
        <p>
          {periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}, {formatNumber(stats.new_users)} nouvelles personnes se sont inscrites et {formatNumber(stats.total_videos)} vidéos ont été générées. La plateforme compte {formatNumber(stats.total_users)} utilisateurs au total.
        </p>
      </div>
    </div>

    <div className="admin-kpi">
      <Stat icon={Users} label="Utilisateurs" value={formatNumber(stats.total_users)} hint={`${formatNumber(stats.new_users)} nouveaux ${periodLabel}`}/>
      <Stat icon={Sparkles} label="Abonnés payants" value={formatNumber(stats.premium_users)} hint="Comptes avec une formule payante" tone="violet"/>
      <Stat icon={Film} label="Vidéos générées" value={formatNumber(stats.total_videos)} hint="Toutes les vidéos traitées" tone="blue"/>
      <Stat icon={CircleDollarSign} label="Revenus" value={formatMoney(stats.revenue_period)} hint={`Paiements ${periodLabel}`} tone="green"/>
    </div>

    <div className="admin-grid">
      <Panel title="Dernières inscriptions" subtitle="Les nouveaux comptes créés">
        <div className="admin-list">
          {data.recent_users.length === 0 && <div className="admin-empty">Aucune inscription pour le moment.</div>}
          {data.recent_users.slice(0, 5).map((row) => <div key={row.id} className="admin-list-row">
            <UserPlus size={16} color="var(--accent)"/>
            <div className="grow"><strong>{row.full_name || row.email}</strong><small>{row.email}</small></div>
            <StatusBadge value={row.plan}/>
          </div>)}
        </div>
      </Panel>

      <Panel title="Derniers paiements" subtitle="Les rentrées d’argent récentes">
        <div className="admin-list">
          {data.recent_transactions.length === 0 && <div className="admin-empty">Aucun paiement pour le moment.</div>}
          {data.recent_transactions.slice(0, 5).map((row) => <div key={row.id} className="admin-list-row">
            <CircleDollarSign size={16} color="#5ee07f"/>
            <div className="grow"><strong>{row.user}</strong><small>{row.reference}</small></div>
            <strong>{formatMoney(row.amount, row.currency)}</strong>
            <StatusBadge value={row.status}/>
          </div>)}
        </div>
      </Panel>

      <Panel title="Dernières actions admin" subtitle="Ce qui a été fait récemment">
        <div className="admin-list">
          {data.recent_activities.length === 0 && <div className="admin-empty">Aucune action récente.</div>}
          {data.recent_activities.slice(0, 5).map((row) => <div key={row.id} className="admin-list-row">
            <Activity size={16} color="var(--accent)"/>
            <div className="grow"><strong>{row.action}</strong><small>{row.admin}</small></div>
            <span style={{ fontSize: 10.5, color: 'var(--text-2)' }}>{formatDate(row.created_at)}</span>
          </div>)}
        </div>
      </Panel>

      <Panel title="État de la plateforme" subtitle="Un coup d’œil rapide">
        <div className="admin-detail-grid">
          <div className="admin-detail"><span>Vidéos en échec</span><strong>{formatNumber(stats.failed_generations)}</strong></div>
          <div className="admin-detail"><span>Problèmes signalés</span><strong>{formatNumber(data.alerts.length)}</strong></div>
          <div className="admin-detail"><span>Abonnements actifs</span><strong>{formatNumber(stats.active_subscriptions)}</strong></div>
          <div className="admin-detail"><span>Taux de transformation</span><strong>{stats.conversion_rate} %</strong></div>
        </div>
        {data.alerts.length > 0 && <div className="admin-inline-alert">
          <AlertTriangle size={15}/> {data.alerts.length} vidéo(s) à vérifier dans la page « Vidéos et générations IA ».
        </div>}
      </Panel>
    </div>
  </>;
}
