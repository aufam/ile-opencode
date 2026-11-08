import type { AuthSession, User } from "../../lib/types";
import { getAuthToken, http, setAuthToken } from "../client";
import { randomToken } from "../../lib/id";

interface LoginResponse extends AuthSession {}

const SESSION_KEY = "aurum.session.v1";

export function loadPersistedSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    setAuthToken(session.token);
    return session;
  } catch {
    return null;
  }
}

function persistSession(session: AuthSession | null): void {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
  setAuthToken(session?.token ?? null);
}

export const authService = {
  // Backend: validate credentials; issue a bearer token session for the user account.
  async login(username: string, password: string): Promise<AuthSession> {
    const res = await http<LoginResponse>("POST", "/api/auth/login", { username, password });
    persistSession(res);
    return res;
  },

  // Backend: resolve the currently authenticated user from the Authorization token.
  async me(): Promise<User> {
    const res = await http<{ user: User }>("GET", "/api/auth/me");
    return res.user;
  },

  restoreTokenOnlySession(user: User): AuthSession {
    const session: AuthSession = {
      token: getAuthToken() ?? `mock-${user.id}-${randomToken(6)}`,
      user,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    };
    persistSession(session);
    return session;
  },

  logout(): void {
    persistSession(null);
  },
};
