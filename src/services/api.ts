const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

function getToken(): string | null {
  return localStorage.getItem('vr_token');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server error (HTTP ${res.status})`);
  }
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  return json as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  created_at: string;
}

export const authApi = {
  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: UserProfile }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: UserProfile }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  me: () => request<UserProfile>('/auth/me'),
  updateMe: (data: { name?: string; avatar?: string }) =>
    request<UserProfile>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ── Files ─────────────────────────────────────────────────────────────────────
export interface UploadedFile {
  id: string;
  original_name: string;
  doc_type: 'sop' | 'transcript' | 'offer_letter' | 'other';
  size_bytes: number;
  uploaded_at: string;
}

export const filesApi = {
  upload: (formData: FormData) =>
    request<UploadedFile[]>('/files', { method: 'POST', body: formData }),
  list: () => request<UploadedFile[]>('/files'),
  delete: (id: string) => request<{ ok: boolean }>(`/files/${id}`, { method: 'DELETE' }),
  downloadUrl: (id: string) => `${BASE}/files/${id}/download?token=${getToken() ?? ''}`,
};

// ── Decks ─────────────────────────────────────────────────────────────────────
export interface QuestionDeck {
  id: string;
  name: string;
  visa_type: string;
  file_ids: string[];
  questions: { id: number; category: string; question: string }[];
  created_at: string;
}

export const decksApi = {
  generate: (payload: {
    file_ids: string[];
    visa_type: string;
    name: string;
    extracted_texts?: Record<string, string>;
  }) => request<QuestionDeck>('/decks/generate', { method: 'POST', body: JSON.stringify(payload) }),
  list: () => request<QuestionDeck[]>('/decks'),
  delete: (id: string) => request<{ ok: boolean }>(`/decks/${id}`, { method: 'DELETE' }),
};

// ── Sessions ──────────────────────────────────────────────────────────────────
export interface SessionRecord {
  id: string;
  deck_id: string | null;
  deck_name: string | null;
  visa_type: string;
  answers: unknown[];
  overall_score: number;
  elapsed: number;
  completed_at: string;
}

export interface SessionStats {
  total_sessions: number;
  avg_score: number;
  best_score: number;
  total_time: number;
}

export const sessionsApi = {
  save: (payload: {
    deck_id?: string;
    visa_type: string;
    answers: unknown[];
    overall_score: number;
    elapsed: number;
  }) => request<{ id: string; completed_at: string }>('/sessions', { method: 'POST', body: JSON.stringify(payload) }),
  list: () => request<SessionRecord[]>('/sessions'),
  stats: () => request<SessionStats>('/sessions/stats'),
};

// ── Leaderboard ───────────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string | null;
  rank: number;
  total_sessions: number;
  avg_score: number;
  best_score: number;
  total_time: number;
  isMe: boolean;
}

export const leaderboardApi = {
  get: () => request<LeaderboardEntry[]>('/leaderboard'),
  userProfile: (userId: string) => request<{
    id: string; name: string; avatar: string | null; created_at: string;
    stats: SessionStats;
    recentSessions: { visa_type: string; overall_score: number; elapsed: number; completed_at: string }[];
  }>(`/leaderboard/profile/${userId}`),
};
