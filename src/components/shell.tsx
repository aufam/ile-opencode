import { A, useLocation, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, For, Show, type JSX } from "solid-js";
import { useAuth } from "../stores/auth";
import { deviceLabel } from "../stores/sync";
import { Avatar } from "./ui";
import { SyncPill } from "./sync";
import type { Role } from "../lib/types";
import { requestAutoPause, requestAutoResume } from "./recorder";

export interface NavItem {
  path: string;
  label: string;
  icon: string;
}

export function Shell(props: { role: Role; nav: NavItem[]; title: string; sub?: string; children: JSX.Element }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = createSignal(false);

  createEffect(() => {
    if (props.role === "staff") {
      const path = location.pathname;
      if (path.includes("/backroom")) {
        requestAutoPause();
      } else {
        requestAutoResume();
      }
    }
  });

  const active = (item: NavItem) => {
    const p = location.pathname;
    if (item.path === p) return true;
    return p.startsWith(`${item.path}/`);
  };

  const home = () => (props.role === "staff" ? "/staff" : "/management");

  return (
    <div class="app-shell">
      <aside class="shell-side" classList={{ open: menuOpen() }}>
        <A class="shell-brand" href={home()}>
          <img src="/logo.png" alt="Logo AURUM" />
          <div>
            <b>AURUM</b>
            <span>Appraisal &amp; Trading</span>
          </div>
        </A>
        <div style="display:flex;flex-direction:column;gap:4px">
          <For each={props.nav}>
            {(item) => (
              <A class="nav-item" href={item.path} classList={{ active: active(item) }} onClick={() => setMenuOpen(false)}>
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </A>
            )}
          </For>
        </div>
        <div class="nav-gap" />
        <div class="shell-user">
          <Avatar initials={auth.user()?.initials ?? "?"} />
          <div class="who">
            <b>{auth.user()?.name ?? ""}</b>
            <span>
              {auth.user()?.jobTitle ?? ""} · {props.role === "staff" ? "Staf Cabang" : "Manajemen"}
            </span>
          </div>
          <button
            class="btn ghost sm"
            style="margin-left:auto;color:#fff;border-color:rgba(255,255,255,.35)"
            onClick={() => {
              auth.logout();
              navigate("/login", { replace: true });
            }}
          >
            Keluar
          </button>
        </div>
      </aside>
      <div class="shell-main">
        <header class="topbar">
          <div>
            <h1>{props.title}</h1>
            {props.sub && <div class="sub">{props.sub}</div>}
          </div>
          <div class="spacer" />
          <SyncPill />
          <span class="pill" title="Perangkat aktif">
            {deviceLabel().startsWith("iPad") ? "🖥️" : "📱"} {deviceLabel()}
          </span>
        </header>
        <main class="page">{props.children}</main>
      </div>
    </div>
  );
}
