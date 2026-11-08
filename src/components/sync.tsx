import { Show } from "solid-js";
import { syncStatus } from "../stores/sync";

export function SyncPill() {
  const s = () => syncStatus();
  const label = () => {
    switch (s().state) {
      case "online":
        return "Live • tersinkron";
      case "connecting":
        return "Menyambung…";
      case "reconnecting":
        return "Menyambung ulang…";
      default:
        return "Tidak tersambung";
    }
  };
  return (
    <span
      class={`pill ${s().state === "online" ? "live" : ""} ${s().state === "offline" ? "offline" : ""} ${
        s().state === "connecting" || s().state === "reconnecting" ? "connecting" : ""
      }`}
      title={`Perangkat: ${s().deviceId}`}
    >
      <span class="dot" />
      {label()}
      <span style="opacity:0.6; font-weight:500">· {s().deviceId}</span>
    </span>
  );
}

export function DeviceBanner(props: { kind: "ipad" | "iphone"; hint: string }) {
  return (
    <div class="sync-hero">
      <span>{props.kind === "ipad" ? "🖥️" : "📱"}</span>
      <span>
        <b>{props.kind === "ipad" ? "Mode Counter (iPad)" : "Mode Ruang Khasanah (iPhone)"}</b> — {props.hint}
      </span>
    </div>
  );
}
