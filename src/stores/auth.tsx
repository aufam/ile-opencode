import { createContext, createSignal, type ParentProps, useContext } from "solid-js";
import type { AuthSession, Role, User } from "../lib/types";
import { authService, loadPersistedSession } from "../api/services/auth.service";

interface AuthContextValue {
  session: () => AuthSession | null;
  user: () => User | null;
  role: () => Role | null;
  ready: () => boolean;
  login: (username: string, password: string) => Promise<AuthSession>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>();

const [session, setSession] = createSignal<AuthSession | null>(loadPersistedSession());
const [ready, setReady] = createSignal(false);

async function bootVerify(): Promise<void> {
  if (!session()) {
    setReady(true);
    return;
  }
  try {
    const user = await authService.me();
    setSession((s) => (s ? { ...s, user } : s));
  } catch {
    authService.logout();
    setSession(null);
  }
  setReady(true);
}

void bootVerify();

export function AuthProvider(props: ParentProps) {
  const value: AuthContextValue = {
    session,
    user: () => session()?.user ?? null,
    role: () => session()?.user.role ?? null,
    ready,
    async login(username, password) {
      const s = await authService.login(username, password);
      setSession(s);
      return s;
    },
    logout() {
      authService.logout();
      setSession(null);
    },
  };
  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
