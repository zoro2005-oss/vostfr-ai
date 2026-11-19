export type ProjectStatus = 'Terminé' | 'En cours' | 'En attente' | 'Erreur' | 'pending' | 'processing' | 'completed' | 'error';

export interface User {
  id: number;
  email: string;
  full_name?: string;
  role?: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type?: string;
  user?: User;
}

export interface PublicPlan {
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
}

export interface UserSubscription {
  plan: string;
  plan_name: string;
  subscription_status: string;
  subscription_ends_at: string | null;
  starts_at: string | null;
  auto_renew: boolean;
  generations_used: number;
  plan_details: Omit<PublicPlan, 'id' | 'description'>;
}

export interface Project {
  id: number;
  title: string;
  filename: string;
  source: string;
  target: string;
  date: string;
  status: ProjectStatus;
  progress: number;
  duration?: string;
  segments?: number;
  created_at?: string;
}

export interface SubtitleSegment {
  id: number;
  start: string;
  end: string;
  translated: string;
}

export interface ProjectDetail extends Omit<Project, 'segments'> {
  segments?: SubtitleSegment[];
}

export interface ProgressResponse {
  status?: string;
  progress?: number;
  message?: string;
}
