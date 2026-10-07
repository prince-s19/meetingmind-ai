import { getToken } from "./auth";
import type { Clarification, DashboardStats, Meeting, Task, User } from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

type ApiResult<T> = T & { message?: string; error?: string; success?: boolean };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = (await response.json().catch(() => ({}))) as ApiResult<T>;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || payload.error || "Something went wrong. Please try again.");
  }
  return payload as T;
}

export type GoogleAuthResponse = {
  authorizationUrl?: string;
  authUrl?: string;
  url?: string;
  redirectUrl?: string;
  message?: string;
  error?: string;
  success?: boolean;
};

export function getGoogleAuthRedirectUrl(response: GoogleAuthResponse | undefined | null) {
  return response?.authorizationUrl || response?.authUrl || response?.url || response?.redirectUrl || "";
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  logout: () =>
    request<{ message?: string }>("/api/auth/logout", { method: "POST" }),
  googleAuth: (code: string, redirectUri?: string) =>
    request<{ token: string; user: User }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({
        code,
        redirect_uri: redirectUri ?? `${window.location.origin}${window.location.pathname}`,
      }),
    }),
  stats: () => request<DashboardStats | { stats: DashboardStats }>("/api/dashboard/stats"),
  meetings: (limit = 20, skip = 0) => request<{ meetings: Meeting[] } | Meeting[]>(`/api/dashboard/meetings?limit=${limit}&skip=${skip}`),
  deleteMeeting: (meetingId: string) => request<void>(`/api/dashboard/${meetingId}`, { method: "DELETE" }),
  upload: (file: File, userPrompt?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (userPrompt) form.append("userPrompt", userPrompt);
    return request<{ meetingId: string }>("/api/upload", { method: "POST", body: form });
  },
  meeting: (meetingId: string) => request<Meeting | { meeting: Meeting }>(`/api/extract/${meetingId}`),
  seedTasks: (meetingId: string, actionItems: Task[]) =>
    request<Meeting>(`/api/extract/${meetingId}`, { method: "POST", body: JSON.stringify({ actionItems }) }),
  updateTask: (meetingId: string, taskIndex: number, changes: Partial<Task>) =>
    request<Meeting>(`/api/extract/${meetingId}/tasks/${taskIndex}`, { method: "PATCH", body: JSON.stringify(changes) }),
  deleteTask: (meetingId: string, taskIndex: number) =>
    request<void>(`/api/extract/${meetingId}/tasks/${taskIndex}`, { method: "DELETE" }),
  clarifications: (meetingId: string) => request<Clarification[] | { clarifications: Clarification[] }>(`/api/clarify/${meetingId}`),
  answerClarification: (meetingId: string, taskIndex: number, answer: string) =>
    request<Meeting>(`/api/clarify/${meetingId}`, { method: "POST", body: JSON.stringify({ taskIndex, answer }) }),
  syncGoogle: (meetingId: string) => request<GoogleAuthResponse>(`/api/google/sync/${meetingId}`, { method: "POST" }),
  googleStatus: () => request<{ isAuthorized: boolean }>('/api/google/status'),
  googleAuthorize: (userId: string) =>
    request<GoogleAuthResponse>("/api/google/oauth/authorize", { method: "POST", body: JSON.stringify({ userId }) }),
};

export function unwrapStats(response: DashboardStats | { stats: DashboardStats } | undefined | null) {
  if (!response) return {} as DashboardStats;
  return "stats" in response ? response.stats : response;
}

export function unwrapMeetings(response: { meetings: Meeting[] } | Meeting[] | undefined | null) {
  if (!response) return [] as Meeting[];
  return Array.isArray(response) ? response : response.meetings ?? [];
}

export function unwrapMeeting(response: Meeting | { meeting: Meeting } | undefined | null) {
  if (!response) return undefined;
  return "meeting" in response ? response.meeting : response;
}

export function unwrapClarifications(response: Clarification[] | { clarifications: Clarification[] } | undefined | null) {
  if (!response) return [] as Clarification[];
  return Array.isArray(response) ? response : response.clarifications ?? [];
}
