import { createSignal } from "solid-js";
import { realtime, type RealtimeStatus } from "../api/ws";

const [status, setStatus] = createSignal<RealtimeStatus>(realtime.snapshot());

realtime.subscribe({
  onEvent: () => undefined,
  onStateChange: (s) => setStatus(s),
});

realtime.connect();

export { status as syncStatus };

export function deviceLabel(): string {
  return realtime.snapshot().deviceId;
}
