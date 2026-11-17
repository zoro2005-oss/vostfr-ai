export type ProjectStatus = 'Terminé' | 'En cours' | 'En attente' | 'Erreur' | 'pending' | 'processing' | 'completed' | 'error';

export interface User {
  id: number;
  email: string;
  full_name?: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type?: string;
  user?: User;
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
