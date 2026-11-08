import { createSignal, Show } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { useAuth } from "../../stores/auth";

export function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = createSignal("rani");
  const [password, setPassword] = createSignal("demo123");
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const goAfterLogin = () => {
    const s = auth.session();
    const next = typeof params.next === "string" ? params.next : "";
    if (next && next.startsWith("/")) navigate(next, { replace: true });
    else if (s?.user.role === "staff") navigate("/staff", { replace: true });
    else navigate("/management", { replace: true });
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await auth.login(username().trim(), password());
      goAfterLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk.");
    } finally {
      setBusy(false);
    }
  };

  const quickFill = (u: string) => {
    setUsername(u);
    setPassword("demo123");
    setError("");
  };

  const demoAccounts = [
    { user: "rani", label: "Rani — Staf JKT Sudirman" },
    { user: "fajar", label: "Fajar — Staf JKT Kemang" },
    { user: "manager", label: "Bayu — Manajemen" },
    { user: "citra", label: "Citra — Manajemen" },
  ];

  return (
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-brand">
          <img src="/logo.png" alt="Logo AURUM" />
          <h1>AURUM</h1>
          <p>Jewelry Appraisal &amp; Trading Management</p>
        </div>

        <Show when={error()}>
          <div class="form-error" role="alert">
            {error()}
          </div>
        </Show>

        <form onSubmit={submit} class="field" style="gap:12px">
          <label class="field">
            <span class="lbl">Nama Pengguna</span>
            <input class="input" value={username()} onInput={(e) => setUsername(e.currentTarget.value)} autocomplete="username" required />
          </label>
          <label class="field">
            <span class="lbl">Kata Sandi</span>
            <input class="input" type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} autocomplete="current-password" required />
          </label>
          <button class="btn lg gold" type="submit" disabled={busy()}>
            {busy() ? "Memproses…" : "Masuk"}
          </button>
        </form>

        <div class="demo-chips">
          {demoAccounts.map((acc) => (
            <button class="chip" type="button" onClick={() => quickFill(acc.user)}>
              {acc.label}
            </button>
          ))}
        </div>
        <p class="hint" style="text-align:center; margin-top:10px">
          Kata sandi semua akun demo: <b>demo123</b>
        </p>
      </div>
    </div>
  );
}
