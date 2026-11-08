import { Show, type JSX, type ParentProps } from "solid-js";
import { statusLabel } from "../lib/format";
import { useAuth } from "../stores/auth";
import type { Role, TxStatus } from "../lib/types";
import { useNavigate } from "@solidjs/router";
import { createEffect } from "solid-js";

export const STATUS_TONES: Record<TxStatus, string> = {
  draft: "gray",
  in_appraisal: "blue",
  awaiting_decision: "amber",
  accepted: "green",
  payment_processing: "gold",
  completed: "green",
  rejected: "red",
  cancelled: "gray",
};

export function StatusBadge(props: { status: TxStatus }) {
  const tone = () => STATUS_TONES[props.status] ?? "gray";
  return (
    <span class={`badge ${tone()}`}>
      <span class="dot" />
      {statusLabel(props.status)}
    </span>
  );
}

export function Button(props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: string }) {
  const tokens = () => props.tone?.split(" ") ?? [];
  const cls = () => {
    const extra = props.class ? ` ${props.class}` : "";
    const toneCls = tokens()
      .map((t) => (["primary", "secondary", "ghost", "danger", "gold", "dark", "sm", "lg", "block"].includes(t) ? t : ""))
      .join(" ");
    return `btn ${toneCls}${extra}`.replace(/\s{2,}/g, " ").trim();
  };
  return (
    <button {...props} class={cls()}>
      {props.children}
    </button>
  );
}

export function Card(props: ParentProps<{ class?: string; style?: string } & { title?: string; actions?: JSX.Element; pad?: boolean }>) {
  return (
    <section class={`card ${props.class ?? ""}`} style={props.style}>
      <Show when={props.title || props.actions}>
        <header class="card-head">
          <h3>{props.title}</h3>
          <div class="spacer" />
          {props.actions}
        </header>
      </Show>
      <div class={props.pad === false ? "" : "card-body"}>{props.children}</div>
    </section>
  );
}

export function StatCard(props: { label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div class={`stat-card ${props.gold ? "gold" : ""}`}>
      <span class="k">{props.label}</span>
      <span class="v num">{props.value}</span>
      {props.sub && <span class="trend">{props.sub}</span>}
    </div>
  );
}

export function Field(props: ParentProps<{ label: string; hint?: string }>) {
  return (
    <label class="field">
      <span class="lbl">{props.label}</span>
      {props.children}
      {props.hint && <span class="hint">{props.hint}</span>}
    </label>
  );
}

export function Spinner(props: { size?: "lg" }) {
  return <span class={`spinner ${props.size === "lg" ? "lg" : ""}`} />;
}

export function LoadingBlock(props: { label?: string }) {
  return (
    <div class="loading-block">
      <Spinner size="lg" />
      <span>{props.label ?? "Memuat data…"}</span>
    </div>
  );
}

export function EmptyState(props: { icon?: string; title: string; hint?: string; children?: JSX.Element }) {
  return (
    <div class="empty">
      <div class="icon">{props.icon ?? "—"}</div>
      <h4>{props.title}</h4>
      {props.hint && <p>{props.hint}</p>}
      {props.children}
    </div>
  );
}

export function ErrorState(props: { message?: string; onRetry?: () => void }) {
  return (
    <div class="empty">
      <div class="icon">⚠️</div>
      <h4>Terjadi kendala</h4>
      <p>{props.message ?? "Gagal memuat data. Periksa koneksi lalu coba lagi."}</p>
      <Show when={props.onRetry}>
        <div style="margin-top:12px">
          <Button tone="secondary" onClick={() => props.onRetry?.()}>
            Coba lagi
          </Button>
        </div>
      </Show>
    </div>
  );
}

export function Modal(props: ParentProps<{ title: string; wide?: boolean; onClose: () => void; footer?: JSX.Element }>) {
  return (
    <div class="modal-overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class={`modal ${props.wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={props.title}>
        <div class="modal-head">
          <h3>{props.title}</h3>
          <Button tone="ghost" onClick={props.onClose} aria-label="Tutup">
            ✕
          </Button>
        </div>
        <div class="modal-body">{props.children}</div>
        <Show when={props.footer}>
          <div class="modal-foot">{props.footer}</div>
        </Show>
      </div>
    </div>
  );
}

export function RequireRole(props: { role: Role; children: JSX.Element }) {
  const auth = useAuth();
  const navigate = useNavigate();
  createEffect(() => {
    const s = auth.session();
    if (!s) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
    } else if (s.user.role !== props.role) {
      navigate(s.user.role === "staff" ? "/staff" : "/management", { replace: true });
    }
  });
  return <Show when={auth.ready() && auth.session()?.user.role === props.role}>{props.children}</Show>;
}

export function Avatar(props: { initials: string; size?: number }) {
  return (
    <span class="avatar" style={props.size ? `width:${props.size}px;height:${props.size}px` : undefined}>
      {props.initials}
    </span>
  );
}

export function SectionTitle(props: ParentProps<{ sub?: string }>) {
  return (
    <div style="margin: 22px 0 12px; display:flex; align-items:baseline; gap:10px; flex-wrap: wrap;">
      <h2 style="font-size:16px">{props.children}</h2>
      {props.sub && <span class="hint">{props.sub}</span>}
      <div style="flex:1" />
    </div>
  );
}
