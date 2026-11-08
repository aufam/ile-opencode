import type { MutationEvent } from "./mock/db-types";
import { subscribeEvents, emit, resetDb } from "./mock/db";

export type ConnectionState = "connecting" | "online" | "reconnecting" | "offline";

export interface RealtimeStatus {
  state: ConnectionState;
  lastEventAt: number | null;
  deviceId: string;
}

export interface RealtimeListener {
  onEvent: (ev: MutationEvent) => void;
  onStateChange?: (s: RealtimeStatus) => void;
}

const HEARTBEAT_INTERVAL_MS = 12000;
const HEARTBEAT_TIMEOUT_MS = 30000;

function makeDeviceId(): string {
  const platform = /iPad/.test(navigator.userAgent)
    ? "iPad"
    : /iPhone/.test(navigator.userAgent)
      ? "iPhone"
      : "Browser";
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${platform}-${rand}`;
}

export class RealtimeClient {
  #listeners = new Map<RealtimeListener, () => void>();
  #status: RealtimeStatus = { state: "connecting", lastEventAt: null, deviceId: deviceInitial() };
  #heartbeatTimer: number | null = null;
  #unsubRemote: (() => void) | null = null;
  #connected = false;

  connect(): void {
    if (this.#connected) return;
    this.#connected = true;
    this.#setStatus("connecting");
    window.setTimeout(() => this.#setStatus("online"), 500);
    this.#unsubRemote = subscribeEvents((ev: MutationEvent) => {
      this.#status.lastEventAt = Date.now();
      this.#dispatch(ev);
    });
    this.#heartbeatTimer = window.setInterval(() => this.#heartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  #heartbeat(): void {
    if (!this.#connected) return;
    const stale =
      this.#status.lastEventAt !== null && Date.now() - this.#status.lastEventAt > HEARTBEAT_TIMEOUT_MS;
    if (stale) {
      this.#setStatus("reconnecting");
      window.setTimeout(() => this.#setStatus("online"), 900);
    }
    this.#dispatch({
      type: "heartbeat",
      payload: { deviceId: this.#status.deviceId, at: new Date().toISOString() },
      serverTime: new Date().toISOString(),
    });
  }

  #setStatus(state: ConnectionState): void {
    this.#status = { ...this.#status, state };
    for (const l of this.#listeners.keys()) l.onStateChange?.(this.snapshot());
  }

  snapshot(): RealtimeStatus {
    return { ...this.#status };
  }

  subscribe(listener: RealtimeListener): () => void {
    this.#listeners.set(listener, () => undefined);
    this.connect();
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #dispatch(ev: MutationEvent): void {
    for (const l of this.#listeners.keys()) l.onEvent(ev);
  }

  disconnect(): void {
    if (this.#heartbeatTimer !== null) window.clearInterval(this.#heartbeatTimer);
    this.#unsubRemote?.();
    this.#unsubRemote = null;
    this.#connected = false;
    this.#setStatus("offline");
  }
}

function deviceInitial(): string {
  try {
    return makeDeviceId();
  } catch {
    return "Browser";
  }
}

export const realtime = new RealtimeClient();

export { emit, resetDb };

export type { MutationEvent };
