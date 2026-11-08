import { createSignal, Show, onCleanup, onMount } from "solid-js";
import { downscaleToDataUrl, fileToCompressedDataUrl } from "../lib/photo";
import { Button } from "./ui";

export function CameraCapture(props: {
  title?: string;
  onCapture: (dataUrl: string) => void;
  onCancel?: () => void;
}) {
  type Phase = "init" | "live" | "review" | "fallback";
  const [phase, setPhase] = createSignal<Phase>("init");
  const [preview, setPreview] = createSignal<string>("");
  const [notice, setNotice] = createSignal<string>("");
  let video: HTMLVideoElement | undefined;
  let overlay: HTMLDivElement | undefined;
  let stream: MediaStream | null = null;

  async function openStream(): Promise<void> {
    teardown();
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice("Kamera langsung tidak didukung di browser ini. Unggah foto dari berkas.");
      setPhase("fallback");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1600 } },
        audio: false,
      });
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setNotice("");
      setPhase("live");
    } catch (e) {
      setNotice(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Izin kamera ditolak. Izinkan kamera pada pengaturan browser atau unggah berkas."
          : "Kamera tidak dapat diakses. Unggah foto dari berkas sebagai alternatif."
      );
      setPhase("fallback");
    }
  }

  function teardown(): void {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  onCleanup(teardown);

  onMount(() => {
    void openStream();
  });

  function shutter(): void {
    if (!video || video.readyState < 2) return;
    const url = downscaleToDataUrl(video, 1280, 0.78);
    overlay?.classList.add("go");
    window.setTimeout(() => overlay?.classList.remove("go"), 320);
    teardown();
    setPreview(url);
    setPhase("review");
  }

  function retake(): void {
    setPreview("");
    void openStream();
  }

  function confirm(): void {
    props.onCapture(preview());
    teardown();
  }

  async function onFilePick(files: FileList | null): Promise<void> {
    const f = files?.[0];
    if (!f) return;
    try {
      const url = await fileToCompressedDataUrl(f);
      setPreview(url);
      setNotice("");
      setPhase("review");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Gagal memproses berkas.");
    }
  }

  return (
    <div>
      <Show when={props.title}>
        <p class="hint" style="margin-bottom:8px">
          {props.title}
        </p>
      </Show>
      <div class="camera-stage">
        <Show when={phase() === "review"} fallback={<LiveArea />}>
          <img src={preview()} alt="Hasil foto" />
        </Show>
      </div>

      <Show
        when={phase() === "live"}
        fallback={
          <Show when={phase() === "review"}>
            <div class="camera-bar">
              <Button tone="ghost" onClick={retake}>
                Ambil ulang
              </Button>
              <Button tone="gold" onClick={confirm}>
                Gunakan foto ini
              </Button>
            </div>
          </Show>
        }
      >
        <div class="camera-bar">
          <Button tone="ghost" onClick={teardown}>
            Batal
          </Button>
          <Button tone="gold" onClick={shutter}>
            📸 Ambil Foto
          </Button>
        </div>
      </Show>
    </div>
  );

  function LiveArea() {
    return (
      <>
        <video ref={video} autoplay playsinline muted />
        <div ref={overlay} class="camera-flash" />
        <Show
          when={phase() !== "live"}
          fallback={null}
        >
          <div style="position:absolute;inset:0;display:grid;place-items:center;background:#0d1b2a;color:#fff;padding:18px;text-align:center">
            <div>
              <p style="font-size:13px;margin-bottom:12px">
                {phase() === "init" ? "Menyiapkan kamera…" : notice() || "Kamera tidak dapat digunakan."}
              </p>
              <Show when={phase() === "fallback"}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void onFilePick(e.currentTarget.files)}
                  aria-label="Pilih berkas foto"
                />
              </Show>
            </div>
          </div>
        </Show>
      </>
    );
  }
}
