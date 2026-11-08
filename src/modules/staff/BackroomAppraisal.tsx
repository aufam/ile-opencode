import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { For, Show, createEffect, createResource, createSignal, untrack } from "solid-js";
import { Shell } from "../../components/shell";
import { Button, Card, Field, LoadingBlock, Modal, EmptyState } from "../../components/ui";
import { CameraCapture } from "../../components/camera";
import { SyncPill } from "../../components/sync";
import { useTxResource } from "./tx-data";
import { transactionsService } from "../../api/services/transactions.service";
import { priceService } from "../../api/services/prices.service";
import { deviceLabel } from "../../stores/sync";
import { pushToast } from "../../stores/toast";
import { money } from "../../lib/format";
import { effectivePerGram, KARATS } from "../../api/mock/engine";
import type { JewelryItem, Karat } from "../../lib/types";

export function BackroomAppraisal() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tx, refetch } = useTxResource(() => params.id);
  const [prices] = createResource(() => priceService.getToday());

  const [weight, setWeight] = createSignal("");
  const [karat, setKarat] = createSignal<Karat>(24);
  const [purity, setPurity] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [scalePhoto, setScalePhoto] = createSignal("");
  const [xrfPhoto, setXrfPhoto] = createSignal("");
  const [cameraKind, setCameraKind] = createSignal<null | "scale" | "xrf" | "item">(null);
  const [busy, setBusy] = createSignal("");

  const itemId = () => (typeof searchParams.item === "string" && searchParams.item ? searchParams.item : tx()?.items[0]?.id ?? "");
  const item = () => tx()?.items.find((i) => i.id === itemId());

  function loadItemIntoForm(it: JewelryItem): void {
    setWeight(it ? (it.appraisal?.weightG ? String(it.appraisal.weightG) : "") : "");
    setKarat((it?.appraisal?.karat ?? 24) as Karat);
    setPurity(it?.appraisal?.measuredPurity ? String(it.appraisal.measuredPurity) : "");
    setNotes(it?.appraisal?.notes ?? "");
    setScalePhoto(it?.appraisal?.scalePhoto ?? "");
    setXrfPhoto(it?.appraisal?.xrfPhoto ?? "");
  }

  createEffect(() => {
    const id = itemId();
    if (id && tx()) {
      untrack(() => {
        const target = tx()!.items.find((i) => i.id === id);
        if (target) loadItemIntoForm(target);
      });
    }
  });

  function bumpWeight(delta: number): void {
    const cur = parseFloat(weight().replace(",", ".")) || 0;
    const next = Math.max(0, Math.round((cur + delta) * 100) / 100);
    setWeight(String(next));
  }

  async function saveAppraisal(nextAfterSave = false): Promise<void> {
    const snapshot = tx();
    const current = item();
    if (!current || !snapshot) return;
    const w = parseFloat(weight().replace(",", "."));
    if (!w || w <= 0) {
      pushToast("Catat berat perhiasan terlebih dahulu (gram).", "error");
      return;
    }
    setBusy("save");
    try {
      await transactionsService.patchItem(snapshot.id, current.id, {
        appraisal: {
          weightG: w,
          karat: karat(),
          measuredPurity: purity() ? parseFloat(purity()) : undefined,
          scaleXrfNote: scalePhoto() || xrfPhoto() ? "Difoto dengan timbangan digital & XRF ruang khasanah." : undefined,
          scalePhoto: scalePhoto() || undefined,
          xrfPhoto: xrfPhoto() || undefined,
          notes: notes().trim() || undefined,
        },
      });
      pushToast("Penilaian tersimpan.", "success");
      if (nextAfterSave) {
        const remaining = snapshot.items.filter((it) => it.id !== current.id && !(it.appraisal && it.appraisal.weightG > 0));
        if (remaining.length > 0) setSearchParams({ item: remaining[0]!.id });
        else navigate(`/staff/transactions/${snapshot.id}`);
      }
      void refetch();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal menyimpan penilaian.", "error");
    } finally {
      setBusy("");
    }
  }

  async function retakeItemPhoto(url: string): Promise<void> {
    const target = item()?.id;
    if (!target || !tx()) return;
    setBusy("photo");
    try {
      await transactionsService.uploadPhoto(tx()!.id, { kind: "item", itemId: target, dataUrl: url });
      pushToast("Foto perhiasan diperbarui.", "success");
      refetch();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal memperbarui foto.", "error");
    } finally {
      setBusy("");
    }
  }

  async function computeAll(): Promise<void> {
    if (!tx()) return;
    setBusy("quote");
    try {
      await transactionsService.quote(tx()!.id);
      pushToast("Harga dihitung untuk perhiasan yang lengkap.", "success");
      navigate(`/staff/transactions/${tx()!.id}`);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Perhitungan gagal.", "error");
    } finally {
      setBusy("");
    }
  }

  const allMeasured = () =>
    Boolean(tx() && tx()!.items.length > 0 && tx()!.items.every((it) => (it.appraisal?.weightG ?? 0) > 0 && it.appraisal?.karat));

  return (
    <Shell
      role="staff"
      nav={[
        { path: "/staff", label: "Antrian Transaksi", icon: "🗂️" },
        { path: "/staff/new", label: "Transaksi Baru", icon: "➕" },
      ]}
      title="Ruang Khasanah — Penilaian"
      sub={tx() ? `${tx()!.code} · ${tx()!.customer.name} · ${tx()!.items.length} perhiasan` : undefined}
    >
      <div style="max-width:680px; margin:0 auto" class="appraise-form">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap">
          <SyncPill />
          <span class="badge gold">📱 Perangkat aktif: {deviceLabel()}</span>
        </div>

        <Show when={tx()} fallback={<LoadingBlock label="Memuat transaksi…" />}>
          {(t) => (
            <>
              <Card title="Pilih Perhiasan" pad={false}>
                <div class="card-body">
                  <div class="item-picker">
                    <For each={t().items}>
                      {(it) => (
                        <button class={`item-chip ${it.id === item()?.id ? "sel" : ""}`} onClick={() => setSearchParams({ item: it.id })}>
                          <Show when={it.photo} fallback={<span>💎</span>}>
                            <img src={it.photo!} alt="" />
                          </Show>
                          {it.description.slice(0, 18)}
                          <span class={`badge ${(it.appraisal?.weightG ?? 0) > 0 ? "green" : "gray"}`} style="margin-left:2px">
                            <span class="dot" />
                            {(it.appraisal?.weightG ?? 0) > 0 ? "OK" : "—"}
                          </span>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Card>

              <Show when={item()} fallback={<EmptyState icon="🔍" title="Belum ada perhiasan untuk dinilai" hint="Tambahkan perhiasan dari counter iPad terlebih dahulu." />}>
                {(it) => (
                  <div style="display:flex; flex-direction:column; gap:14px; margin-top:14px">
                    <Card pad={false}>
                      <div class="card-body">
                        <div style="display:flex; gap:14px; align-items:flex-start">
                          <button class="item-thumb" style={it().photo ? `background-image:url(${it().photo}); border:none` : ""} onClick={() => setCameraKind("item")}>
                            <Show when={!it().photo}>📷</Show>
                          </button>
                          <div style="min-width:0; flex:1">
                            <b>{it().description}</b>
                            <div class="hint">
                              Sesi {it().sessionId} · status {it().status}
                            </div>
                            <div style="margin-top:8px">
                              <Button tone="ghost" class="sm" onClick={() => setCameraKind("item")}>
                                📸 Foto ulang perhiasan
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card title="Pengukuran Emas">
                      <div class="form-grid">
                        <Field label="Berat (gram) *">
                          <input
                            class="input"
                            inputmode="decimal"
                            style="font-size:22px; font-weight:700; text-align:center"
                            placeholder="0.00"
                            value={weight()}
                            onInput={(e) => setWeight(e.currentTarget.value)}
                          />
                          <div style="display:flex; gap:8px; margin-top:6px">
                            <Button tone="secondary sm" onClick={() => bumpWeight(-0.5)}>
                              −0,5 g
                            </Button>
                            <Button tone="secondary sm" onClick={() => bumpWeight(0.5)}>
                              +0,5 g
                            </Button>
                          </div>
                        </Field>
                        <Field label="Kemurnian (karat) *">
                          <div class="karat-grid">
                            <For each={KARATS}>
                              {(k) => (
                                <button class={`karat-btn ${karat() === k ? "sel" : ""}`} type="button" onClick={() => setKarat(k)}>
                                  {k}K
                                  <small>{money(effectivePerGram(prices()?.prices ?? { 24: 0, 22: 0, 18: 0, 14: 0 }, k))}/g</small>
                                </button>
                              )}
                            </For>
                          </div>
                        </Field>
                      </div>
                      <div class="divider" />
                      <div class="form-grid">
                        <Field label="Kemurnian XRF (%)" hint="Contoh: 91,6% untuk emas 22K">
                          <input class="input" inputmode="decimal" value={purity()} onInput={(e) => setPurity(e.currentTarget.value)} />
                        </Field>
                        <Field label="Foto Timbangan">
                          <Slot photo={scalePhoto()} label="Timbangan" onPick={() => setCameraKind("scale")} />
                        </Field>
                        <Field label="Foto Mesin XRF">
                          <Slot photo={xrfPhoto()} label="Mesin XRF" onPick={() => setCameraKind("xrf")} />
                        </Field>
                      </div>
                      <Field label="Catatan Penilaian">
                        <textarea class="input" rows="3" placeholder="cth. tidak ada retak, klasp masih kuat." value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} />
                      </Field>
                    </Card>

                    <Card title="Tindaklanjut">
                      <div style="display:flex; gap:10px; flex-wrap:wrap">
                        <Button tone="gold lg" disabled={busy() === "save" || busy() === "photo"} onClick={() => void saveAppraisal(true)}>
                          {busy() === "save" ? "Menyimpan…" : "💾 Simpan & Lanjut"}
                        </Button>
                        <Button tone="secondary lg" disabled={busy() === "save" || busy() === "photo"} onClick={() => void saveAppraisal(false)}>
                          Simpan Saja
                        </Button>
                        <Show when={allMeasured()}>
                          <Button tone="dark lg" disabled={busy() === "quote"} onClick={() => void computeAll()}>
                            {busy() === "quote" ? "Menghitung…" : "🧮 Hitung Harga Sekarang"}
                          </Button>
                        </Show>
                        <A class="btn ghost lg" href={`/staff/transactions/${t()!.id}`}>
                          ← Kembali ke Counter
                        </A>
                      </div>
                      <p class="hint" style="margin-top:10px">
                        Perekaman percakapan otomatis berjeda saat di ruang khasanah dan dilanjutkan saat kembali ke pelanggan.
                      </p>
                    </Card>
                  </div>
                )}
              </Show>
            </>
          )}
        </Show>

        <Show when={cameraKind()}>
          <Modal
            title={cameraKind() === "scale" ? "Foto Timbangan Digital" : cameraKind() === "xrf" ? "Foto Mesin XRF" : "Foto Ulang Perhiasan"}
            onClose={() => setCameraKind(null)}
          >
            <CameraCapture
              title="Pastikan angka yang terbaca pada alat terlihat pada foto."
              onCapture={(url) => {
                const kind = cameraKind();
                setCameraKind(null);
                if (kind === "scale") setScalePhoto(url);
                else if (kind === "xrf") setXrfPhoto(url);
                else void retakeItemPhoto(url);
              }}
              onCancel={() => setCameraKind(null)}
            />
          </Modal>
        </Show>
      </div>
    </Shell>
  );
}

function Slot(props: { photo: string; label: string; onPick: () => void }) {
  return (
    <button class="photo-thumb" style={props.photo ? `background-image:url(${props.photo})` : ""} onClick={props.onPick} type="button">
      <Show when={!props.photo}>
        <span style="font-size:26px">📷</span>
      </Show>
      <span class="cap">{props.label}</span>
    </button>
  );
}
