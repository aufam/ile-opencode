import { For, createEffect } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../stores/auth";
import { useToast } from "../stores/toast";
import { LoadingBlock } from "./ui";

export function ToastHost() {
  const toast = useToast();
  return (
    <div class="toast-host" role="status" aria-live="polite">
      <For each={toast.toasts()}>{(t) => <div class={`toast ${t.tone}`}>{t.message}</div>}</For>
    </div>
  );
}

export function HomeRedirect() {
  const auth = useAuth();
  const navigate = useNavigate();
  createEffect(() => {
    if (!auth.ready()) return;
    const user = auth.user();
    if (!user) navigate("/login", { replace: true });
    else navigate(user.role === "staff" ? "/staff" : "/management", { replace: true });
  });
  return <LoadingBlock label="Mengarahkan…" />;
}
