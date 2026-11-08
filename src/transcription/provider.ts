export interface TranscriptDraft {
  id: string;
  text: string;
  startedAt: string;
  durationMs: number;
  confidence?: number;
  speakerHint?: "staff" | "customer" | "mixed";
  deviceId?: string;
}

export interface TranscriptionHandlers {
  onSegment: (seg: TranscriptDraft) => void;
  onInterim: (text: string) => void;
  onError: (err: { code: string; message: string; fatal: boolean }) => void;
}

export interface TranscriptionProvider {
  readonly id: string;
  readonly label: string;
  isSupported(): boolean;
  start(lang: string, handlers: TranscriptionHandlers): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
}

export interface SpeechResultAlternative {
  transcript: string;
  confidence?: number;
}

export interface SpeechResult {
  isFinal: boolean;
  length: number;
  0: SpeechResultAlternative;
}

export interface SpeechEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechResult };
}

export interface SpeechErrorLike {
  error: string;
  message?: string;
}

class WebSpeechProvider implements TranscriptionProvider {
  readonly id = "webspeech";
  readonly label = "Pengenalan suara browser (id-ID)";
  #rec: any = null;
  #handlers: TranscriptionHandlers | null = null;
  #lang = "id-ID";
  #state: "idle" | "recording" | "paused" = "idle";
  #shouldRestart = false;
  #restartTimer: number | null = null;
  #segStartAt = 0;

  isSupported(): boolean {
    const w = window as unknown as Record<string, unknown>;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  async start(lang: string, handlers: TranscriptionHandlers): Promise<void> {
    this.#lang = lang;
    this.#handlers = handlers;
    const w = window as unknown as Record<string, any>;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      handlers.onError({ code: "unsupported", message: "Browser tidak menyediakan mesin pengenalan suara.", fatal: true });
      return;
    }
    this.#build(Ctor);
    this.#shouldRestart = true;
    this.#state = "recording";
    this.#segStartAt = Date.now();
    this.#rec.start();
  }

  #build(Ctor: any): void {
    if (this.#rec) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.#lang;
    rec.onresult = (event: SpeechEventLike) => {
      if (!this.#handlers) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? "";
        if (result?.isFinal) {
          const confidence = result[0]?.confidence;
          const now = Date.now();
          if (text.trim()) {
            this.#handlers.onSegment({
              id: `seg-${now}-${Math.random().toString(36).slice(2, 7)}`,
              text: text.trim(),
              startedAt: new Date(this.#segStartAt).toISOString(),
              durationMs: now - this.#segStartAt,
              confidence: typeof confidence === "number" ? confidence : undefined,
              speakerHint: "mixed",
            });
          }
          this.#segStartAt = now;
        } else {
          interim += text;
        }
      }
      this.#handlers.onInterim(interim.trim());
    };
    rec.onerror = (event: SpeechErrorLike) => {
      if (!this.#handlers) return;
      const code = event.error ?? "unknown";
      if (code === "not-allowed" || code === "service-not-allowed") {
        this.#handlers.onError({ code, message: "Akses mikrofon ditolak browser. Periksa izin mikrofon lalu coba mulai lagi.", fatal: true });
        this.#shouldRestart = false;
      } else if (code !== "no-speech" && code !== "aborted") {
        this.#handlers.onError({ code, message: `Pengenalan suara terputus (${code}). Mencoba melanjutkan…`, fatal: false });
      }
    };
    rec.onend = () => {
      if (this.#shouldRestart && this.#state === "recording") {
        this.#restartTimer = window.setTimeout(() => {
          try {
            this.#rec?.start();
          } catch {
            /* start while active */
          }
        }, 250);
      }
    };
    this.#rec = rec;
  }

  pause(): void {
    this.#state = "paused";
    this.#shouldRestart = false;
    try {
      this.#rec?.stop();
    } catch {
      /* ignore */
    }
    this.#handlers?.onInterim("");
  }

  resume(): void {
    this.#state = "recording";
    this.#shouldRestart = true;
    this.#segStartAt = Date.now();
    try {
      this.#rec?.start();
    } catch {
      /* start while active */
    }
  }

  stop(): void {
    this.#state = "idle";
    this.#shouldRestart = false;
    if (this.#restartTimer !== null) window.clearTimeout(this.#restartTimer);
    try {
      this.#rec?.stop();
    } catch {
      /* ignore */
    }
    this.#rec = null;
    this.#handlers?.onInterim("");
    this.#handlers = null;
  }
}

class ManualProvider implements TranscriptionProvider {
  readonly id = "manual";
  readonly label = "Catatan manual (browser tanpa pengenalan suara)";
  #handlers: TranscriptionHandlers | null = null;

  isSupported(): boolean {
    return true;
  }

  async start(_lang: string, handlers: TranscriptionHandlers): Promise<void> {
    this.#handlers = handlers;
    handlers.onError({
      code: "unsupported",
      message: "Pengenalan suara langsung tidak tersedia. Gunakan catatan manual agar evaluasi tetap terdata.",
      fatal: true,
    });
  }

  push(text: string): void {
    if (!text.trim() || !this.#handlers) return;
    const now = Date.now();
    this.#handlers.onSegment({
      id: `seg-${now}-${Math.random().toString(36).slice(2, 7)}`,
      text: text.trim(),
      startedAt: new Date(now).toISOString(),
      durationMs: 0,
      speakerHint: "staff",
    });
  }

  pause(): void {}
  resume(): void {}
  stop(): void {
    this.#handlers = null;
  }
}

let webSpeech: WebSpeechProvider | null = null;
let manual: ManualProvider | null = null;

export function pickTranscriptionProvider(): TranscriptionProvider {
  webSpeech ??= new WebSpeechProvider();
  if (webSpeech.isSupported()) return webSpeech;
  manual ??= new ManualProvider();
  return manual;
}

export function manualProvider(): ManualProvider | null {
  return manual;
}
