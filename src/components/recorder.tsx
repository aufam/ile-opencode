import { createSignal, onCleanup, onMount, Show, For } from "solid-js";
import { pickTranscriptionProvider, manualProvider, type TranscriptionProvider, type TranscriptDraft } from "../transcription/provider";
import { transactionsService } from "../api/services/transactions.service";
import { deviceLabel } from "../stores/sync";
import { pushToast } from "../stores/toast";
import { timeHM } from "../lib/format";
import { Button } from "./ui";

type RecState = "idle" | "starting" | "recording" | "paused" | "stopped" | "off";

interface ActiveRecorder {
  setAutoPaused: (v: boolean) => void;
  autoPaused: () => boolean;
  pause: () => void;
  resume: () => void;
}

let activeRecorderRef: ActiveRecorder | null = null;

export function requestAutoPause(): void {
  activeRecorderRef?.setAutoPaused(true);
  activeRecorderRef?.pause?.();
}

export function requestAutoResume(): void {
  if (activeRecorderRef?.autoPaused()) {
    activeRecorderRef?.setAutoPaused(false);
    activeRecorderRef?.resume?.();
    pushToast("Perekaman dilanjutkan kembali.", "success");
  }
}

export function RecordingPanel(props: { transactionId: string; onSilence?: () => void }) {
  const [state, setState] = createSignal<RecState>("idle");
  const [elapsed, setElapsed] = createSignal(0);
  const [segments, setSegments] = createSignal<TranscriptDraft[]>([]);
  const [interim, setInterim] = createSignal("");
  const [provider, setProvider] = createSignal<TranscriptionProvider | null>(null);
  const [notice, setNotice] = createSignal<string>("");
  const [fatal, setFatal] = createSignal(false);
  const [manualText, setManualText] = createSignal("");
  const [autoPaused, setAutoPaused] = createSignal(false);
  let timer: number | null = null;
  let lastTick = 0;
  let mounted = false;

  onCleanup(() => {
    mounted = false;
    const p = provider();
    p?.stop();
    if (timer !== null) window.clearInterval(timer);
    if (activeRecorderRef === api) activeRecorderRef = null;
  });

  const api: ActiveRecorder = {
    autoPaused,
    setAutoPaused: setAutoPaused,
    pause() {
      provider()?.pause();
      setState("paused");
    },
    resume() {
      void startEngine();
    },
  };

  onMount(() => {
    mounted = true;
    activeRecorderRef = api;
    const sel = pickTranscriptionProvider();
    setProvider(sel);
    if (sel.id === "manual") {
      setFatal(true);
      setNotice(
        "Pengenalan suara langsung tidak didukung browser ini. Aktifkan Chrome/Edge/Safari terbaru berbahasa Indonesia, atau gunakan catatan manual di bawah."
      );
      setState("off");
    }
  });

  async function startEngine(): Promise<void> {
    const p = provider();
    if (!p) return;
    if (state() === "paused") {
      p.resume();
      setState("recording");
      return;
    }
    setState("starting");
    setFatal(false);
    try {
      await p.start("id-ID", {
        onSegment: (seg) => {
          const enriched: TranscriptDraft = { ...seg, deviceId: deviceLabel() };
          setSegments((s) => [...s, enriched]);
          setInterim("");
          // Backend: persist each finalized transcription segment under this transaction.
          transactionsService
            .postTranscriptions(props.transactionId, [enriched])
            .catch(() => pushToast("Transkripsi gagal tersimpan, akan dicoba lagi nanti.", "error"));
        },
        onInterim: (text) => setInterim(text),
        onError: (err) => {
          setNotice(err.message);
          if (err.fatal) {
            setFatal(true);
            setState("off");
          }
        },
      });
      setState("recording");
      lastTick = Date.now();
      if (timer === null) {
        timer = window.setInterval(() => {
          const now = Date.now();
          setElapsed((e) => e + Math.min(now - lastTick, 2000));
          lastTick = now;
        }, 1000);
      }
    } catch {
      setState("off");
      setNotice("Mikrofon tidak dapat diaktifkan. Berikan izin lalu coba lagi.");
    }
  }

  function pause(): void {
    provider()?.pause();
    setState("paused");
    setAutoPaused(false);
  }

  function stop(): void {
    provider()?.stop();
    setState("stopped");
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    setElapsed(0);
  }

  async function sendManual(): Promise<void> {
    const text = manualText().trim();
    if (!manualText()) return;
    const now = Date.now();
    const seg: TranscriptDraft = {
      id: `seg-${now}-m`,
      text,
      startedAt: new Date(now - Math.max(0, elapsed())).toISOString(),
      durationMs: elapsed(),
      speakerHint: "staff",
      deviceId: deviceLabel(),
    };
    setSegments((s) => [...s, seg]);
    setManualText("");
    try {
      await transactionsService.postTranscriptions(props.transactionId, [seg]);
      pushToast("Catatan dikirim ke backend.", "success");
    } catch {
      pushToast("Catatan gagal tersimpan.", "error");
    }
  }

  const fmt = (ms: number) => new Date(ms).toISOString().substring(14, 19);

  return (
    <div>
      <div class="rec-bar" style="justify-content:space-between; width:100%">
        <div class="rec-metadata rec-state-idle">
          <span class={`t ${state() === "recording" ? undefined : ""}`} data-state={state()}>
            {state() === "recording" && !autoPaused() ? fmt(elapsed()) : state() === "paused" ? fmt(elapsed()) : "Perekaman"}
          </span>
          <span class="s">
            {state() === "recording"
              ? `Menyimak (id-ID) · ${provider()?.label ?? ""}`
              : state() === "paused"
                ? "Jeda — mikrofon dilengsung"
                : state() === "starting"
                  ? "Mengaktifkan mikrofon…"
                  : state() === "stopped"
                    ? "Perekaman diakhiri"
                    : state() === "off"
                      ? "Pengenalan suara tidak tersedia"
                      : "Belum aktif"}
          </span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <Show
            when={state() === "recording"}
            fallback={
              <button
                class="rec-ctl"
                title={state() === "paused" ? "Lanjutkan perekaman" : "Mulai perekaman"}
                disabled={state() === "starting" || state() === "off"}
                onClick={() => (state() === "paused" ? void startEngine() : pause())}
              >
                {state() === "paused" ? "▶" : "⏺"}
              </button>
            }
          >
            <button class="rec-ctl rec" title="Jeda perekaman" onClick={pause}>
              ❙❙
            </button>
          </Show>
          <Show when={state() === "recording" || state() === "paused"}>
            <button class="rec-ctl ghost" title="Akhiri perekaman" onClick={stop}>
              ■
            </button>
          </Show>
        </div>
      </div>

      <Show when={notice()}>
        <p class={fatal() ? "form-error" : "hint"} style={fatal() ? "" : "margin-top:8px"}>
          {notice()}
        </p>
      </Show>

      <div class="transcript-scroll" style="margin-top:12px">
        <For each={segments()}>
          {(seg) => (
            <div class="seg">
              <span class="when">
                {timeHM(seg.startedAt)} · staf & pelanggan · {seg.deviceId}
              </span>
              {seg.text}
            </div>
          )}
        </For>
        <Show when={interim()}>
          <div class="seg interim">
            <span class="when">{timeHM(new Date().toISOString())} · sedang berbicara…</span>
            {interim()}
          </div>
        </Show>
        <Show when={!segments().length && !interim()}>
          <div class="empty" style="padding:14px">
            <p class="hint">Belum ada transkripsi. Rekaman ditampilkan di sini secara waktu-nyata.</p>
          </div>
        </Show>
      </div>

      <Show when={manualProvider()}>
        <div style="display:flex;gap:8px;margin-top:10px">
          <input
            class="input"
            placeholder="Catat pokok pembicaraan sepintas…"
            value={manualText()}
            onInput={(e) => setManualText(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && void sendManual()}
          />
          <Button tone="secondary" onClick={() => void sendManual()}>
            Kirim
          </Button>
        </div>
      </Show>
    </div>
  );
}
