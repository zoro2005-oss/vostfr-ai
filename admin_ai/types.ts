export type AdminRole = 'super_admin' | 'admin' | 'finance' | 'support' | 'tech' | 'user';

export interface AdminMe {
  id: number;
  email: string;
  full_name: string;
  role: AdminRole;
  permissions: string[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserRow {
  id: number;
  full_name: string;
  email: string;
  role: AdminRole;
  credits: number;
  status: string;
  plan: string;
  plan_name: string;
  subscription_status: string;
  subscription_ends_at: string | null;
  generations: number;
  created_at: string | null;
  last_activity: string | null;
  projects?: ProjectRow[];
  transactions?: TransactionRow[];
  credits_history?: CreditRow[];
}

export interface ProjectRow {
  id: number;
  title: string;
  filename: string;
  user: string;
  user_id: number;
  source: string;
  target: string;
  duration: string;
  duration_minutes: number;
  status: string;
  progress: number;
  plan: string;
  cost: number;
  backup: string;
  processing_minutes: number | null;
  created_at: string | null;
  completed_at: string | null;
  logs?: GenerationLogRow[];
}

export interface GenerationLogRow {
  id: number;
  level: string;
  message: string;
  resource: string | null;
  created_at: string | null;
}

export interface PlanRow {
  id: number;
  code: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration_days: number;
  generation_limit: number | null;
  video_max_minutes: number | null;
  backup_enabled: boolean;
  retention_minutes: number;
  features: Record<string, unknown>;
  is_active: boolean;
  is_archived: boolean;
  subscribers: number;
}

export interface TransactionRow {
  id: number;
  reference: string;
  user: string;
  user_id: number;
  amount: number;
  currency: string;
  method: string;
  plan: string;
  status: string;
  provider_reference: string;
  created_at: string | null;
}

export interface CreditRow {
  id: number;
  user?: string;
  delta: number;
  reason: string;
  created_at: string | null;
}

export interface AuditRow {
  id: number;
  admin: string;
  admin_id: number | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string | null;
}

export interface NotificationRow {
  id: number;
  title: string;
  body: string;
  audience: string;
  kind: string;
  created_at: string | null;
}

export interface TicketRow {
  id: number;
  subject: string;
  user: string;
  status: string;
  priority: string;
  assigned_to: number | null;
  messages: number;
  created_at: string | null;
  updated_at: string | null;
  message_list?: TicketMessageRow[];
}

export interface TicketMessageRow {
  id: number;
  sender: string;
  role: string;
  body: string;
  created_at: string | null;
}

export interface LanguageRow {
  code: string;
  name: string;
  source: boolean;
  target: boolean;
  voices?: { id: string; name: string; enabled?: boolean }[];
}

export interface EngineRow {
  id: string;
  name: string;
  enabled: boolean;
  quality?: string;
}

export interface PromoRow {
  id: number;
  code: string;
  plan_id: number | null;
  discount_percent: number;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  is_active: boolean;
}

export interface AdminRow {
  id: number;
  email: string;
  full_name: string;
  role: AdminRole;
  is_active: boolean;
  last_active_at: string | null;
  sessions: number;
}

export interface OverviewData {
  stats: Record<string, number>;
  charts: {
    registrations: { date: string; value: number }[];
    revenue: { date: string; value: number }[];
    generations: { date: string; value: number }[];
  };
  subscription_distribution: { label: string; value: number }[];
  recent_activities: AuditRow[];
  recent_transactions: TransactionRow[];
  recent_users: UserRow[];
  alerts: ProjectRow[];
}

export interface AnalyticsData {
  dau: number;
  mau: number;
  conversion_rate: number;
  renewal_rate: number;
  churn_rate: number;
  mrr: number;
  arpu: number;
  generations_per_day: number;
  average_processing_minutes: number;
  failure_rate: number;
  cost_per_minute: number;
  margins: { plan: string; revenue: number; subscribers: number }[];
  series: { date: string; value: number }[];
}

export interface MonitoringData {
  storage: { bytes: number; files: number; limit_gb: number };
  api_errors: { id: number; message: string; resource: string | null; created_at: string | null }[];
  failed_generations: number;
}
