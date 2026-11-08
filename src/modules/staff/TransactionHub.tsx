import { A, useNavigate, useParams } from "@solidjs/router";
import { For, Match, Show, Switch, createEffect, createResource, createSignal } from "solid-js";
import QRCode from "qrcode";
import { Shell } from "../../components/shell";
import { Button, Card, EmptyState, Field, LoadingBlock, Modal, StatusBadge, ErrorState } from "../../components/ui";
import { RecordingPanel } from "../../components/recorder";
import { CameraCapture } from "../../components/camera";
import { transactionsService } from "../../api/services/transactions.service";
import { priceService } from "../../api/services/prices.service";
import { deviceLabel } from "../../stores/sync";
import { pushToast } from "../../stores/toast";
import { useTxResource, itemTotal, itemsAppraised, itemsQuoted } from "./tx-data";
import { dateTime, jewelryTypeLabel, money, relative, statusLabel } from "../../lib/format";
import type { JewelryType } from "../../lib/types";

const JEWELRY_TYPES: JewelryType[] = ["ring", "necklace", "bracelet", "pendant", "earrings", "chain", "other"];

interface LinkInfo {
  url: string;
  token: string;
  expiresAt: string;
  ttlMinutes: number;
}

export function TransactionHub() {
  const params = useParams();
  const navigate = useNavigate();
  const { tx, refetch } = useTxResource(() => params.id);
  const [goldPrices] = createResource(() => priceService.getToday());

  const [addModal, setAddModal] = createSignal<null | "photo" | "details">(null);
  const [pendingPhoto, setPendingPhoto] = createSignal<string>("");
  const [photoForItem, setPhotoForItem] = createSignal<string | null>(null);
  const [confirmRemove, setConfirmRemove] = createSignal<string | null>(null);
  const [rejectModal, setRejectModal] = createSignal(false);
  const [qrModal, setQrModal] = createSignal(false);
  const [recorderOpen, setRecorderOpen] = createSignal(false);
  const [busy, setBusy] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [jtype, setJtype] = createSignal<JewelryType>("ring");
  const [link, setLink] = createSignal<LinkInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = createSignal("");
  const [rejectNote, setRejectNote] = createSignal("");

  const quoteSum = () => itemTotal(tx());
  const allQuoted = () => itemsQuoted(tx());
  const someQuoted = () => tx()?.items.some((it) => it.quote) ?? false;
  const canQuoteNow = () => itemsAppraised(tx()) && !tx()?.items.every((it) => it.quote);

  async function doQuote(): Promise<void> {
    if (!tx()) return;
    setBusy("quote");
    try {
      const updated = await transactionsService.quote(tx()!.id);
      pushToast(`Perhitungan selesai. Total ${money(itemTotal(updated))}.`, "success");
      refetch();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Perhitungan gagal.", "error");
    } finally {
      setBusy("");
    }
  }

  async function acceptOffer(): Promise<void> {
    if (!tx()) return;
    setBusy("accept");
    try {
      await transactionsService.decide(tx()!.id, { accepted: true });
      pushToast("Penawaran diterima. Lanjut ke pembayaran.", "success");
      navigate(`/staff/transactions/${tx()!.id}/payment`);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal mencatat keputusan.", "error");
    } finally {
      setBusy("");
    }
  }

  async function rejectOffer(): Promise<void> {
    if (!tx()) return;
    setBusy("reject");
    try {
      await transactionsService.decide(tx()!.id, { accepted: false, note: rejectNote() || undefined });
      pushToast("Penawaran ditolak. Transaksi ditandai.", "info");
      setRejectModal(false);
      refetch();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal mencatat keputusan.", "error");
    } finally {
      setBusy("");
    }
  }

  async function addItem(): Promise<void> {
    if (!tx()) return;
    setBusy("additem");
    try {
      await transactionsService.addItem(tx()!.id, {
        description: description().trim() || "Perhiasan",
        type: jtype(),
        photo: pendingPhoto() || undefined,
      });
      setAddModal(null);
      setPendingPhoto("");
      setDescription("");
      pushToast("Perhiasan ditambahkan ke transaksi.", "success");
      refetch();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal menambah perhiasan.", "error");
    } finally {
      setBusy("");
    }
  }

  async function retakeItem(itemId: string, url: string): Promise<void> {
    setBusy(`photo-${itemId}`);
    try {
      await transactionsService.uploadPhoto(tx()!.id, { kind: "item", itemId, dataUrl: url });
      pushToast("Foto diperbarui.", "success");
      refetch();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal memperbarui foto.", "error");
    } finally {
      setBusy("");
    }
  }

  async function removeItem(itemId: string): Promise<void> {
    if (!tx()) return;
    setBusy(`del-${itemId}`);
    try {
      await transactionsService.removeItem(tx()!.id, itemId);
      setConfirmRemove(null);
      refetch();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal menghapus perhiasan.", "error");
    } finally {
      setBusy("");
    }
  }

  async function openQr(): Promise<void> {
    setQrModal(true);
    try {
      const res = await transactionsService.createPublicLink(tx()!.id);
      setLink(res);
      const target = `${location.origin}${res.url}`;
      setQrDataUrl(await QRCode.toDataURL(target, { width: 480, margin: 1, color: { dark: "#0b1f3a", light: "#ffffff" } }));
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal membuat tautan.", "error");
      setQrModal(false);
    }
  }

  async function regenerate(): Promise<void> {
    try {
      const res = await transactionsService.createPublicLink(tx()!.id, true);
      setLink(res);
      setQrDataUrl(await QRCode.toDataURL(`${location.origin}${res.url}`, { width: 480, margin: 1, color: { dark: "#0b1f3a", light: "#ffffff" } }));
      pushToast("Tautan baru dibuat; tautan lama batal.", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal memperbarui tautan.", "error");
    }
  }

  const percentDone = () => {
    const items = tx()?.items ?? [];
    if (!items.length) return 10;
    const steps = items.filter((i) => i.appraisal && i.appraisal.weightG > 0).length;
    const quoted = items.filter((i) => i.quote).length;
    return Math.round(((steps + quoted) / (items.length * 2)) * 100);
  };

  return (
    <Shell
      role="staff"
      nav={[
        { path: "/staff", label: "Antrian Transaksi", icon: "🗂️" },
        { path: "/staff/new", label: "Transaksi Baru", icon: "➕" },
      ]}
      title={tx() ? `Transaksi ${tx()!.code}` : "Memuat transaksi…"}
      sub={tx() ? `${tx()!.customer.name} · ${statusLabel(tx()!.status)} · diperbarui ${relative(tx()!.updatedAt)}` : undefined}
    >
      <Show when={!tx.loading} fallback={<LoadingBlock label="Memuat transaksi…" />}>
        <Show when={tx()} fallback={<EmptyState icon="🧾" title="Transaksi tidak ditemukan" hint="Periksa kembali kode transaksi atau mulai dari antrian." />}>
          {(t) => (
            <>
              <div class="stepper" style="margin-bottom:16px">
                <div class="step done">
                  <span class="idx">✓</span> Pelanggan
                </div>
                <div class={`step ${(t().items.length ?? 0) > 0 ? "done" : "current"}`}>
                  <span class="idx">{t().items.length > 0 ? "✓" : "2"}</span> Daftar Perhiasan
                </div>
                <div class={`step ${itemsAppraised(t()) ? "done" : t().items.length > 0 ? "current" : ""}`}>
                  <span class="idx">{itemsAppraised(t()) ? "✓" : "3"}</span> Penilaian
                </div>
                <div class={`step ${allQuoted() ? "done" : canQuoteNow() ? "current" : ""}`}>
                  <span class="idx">{allQuoted() ? "✓" : "4"}</span> Harga
                </div>
                <div class={`step ${["accepted", "payment_processing", "completed"].includes(t().status) ? "done" : allQuoted() ? "current" : ""}`}>
                  <span class="idx">{["accepted", "payment_processing", "completed"].includes(t().status) ? "✓" : "5"}</span> Keputusan &amp; Bayar
                </div>
              </div>

              <div class="hub-columns">
                <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
                  <Card
                    title={`Perhiasan (${t().items.length})`}
                    actions={
                      <Show when={t().status !== "completed" && t().status !== "cancelled"}>
                        <Button tone="gold" onClick={() => { setAddModal("photo"); setPendingPhoto(""); }}>
                          ➕ Tambah Perhiasan
                        </Button>
                      </Show>
                    }
                  >
                    <Show when={t().items.length === 0}>
                      <EmptyState icon="💍" title="Belum ada perhiasan" hint="Fotografikan perhiasan pelanggan, lalu tambahkan ke transaksi." />
                    </Show>
                    <div style="display:flex;flex-direction:column;gap:12px">
                      <For each={t().items}>
                        {(item) => (
                          <div class="item-card">
                            <button
                              class="item-thumb"
                              style={item.photo ? `background-image:url(${item.photo});border:none` : ""}
                              title="Ganti foto"
                              onClick={() => setPhotoForItem(item.id)}
                            >
                              <Show when={!item.photo}>{item.photo ? "" : "📷"}</Show>
                            </button>
                            <div class="item-rows">
                              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                                <b>{item.description}</b>
                                <span class="badge gray">{jewelryTypeLabel(item.type)}</span>
                                <span class={`badge ${item.quote ? "green" : item.appraisal ? "amber" : "gray"}`}>
                                  <span class="dot" />
                                  {item.quote ? "Harga siap" : item.appraisal ? "Penilaian berjalan" : "Belum dinilai"}
                                </span>
                              </div>
                              <div class="meta num">
                                <Show when={item.appraisal} fallback="Berat & kemurnian diisi di ruang khasanah (iPhone).">
                                  Berat {item.appraisal!.weightG} g · {item.appraisal!.karat}K · {money(item.quote?.total ?? 0)}
                                </Show>
                              </div>
                              <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
                                <A class="btn secondary sm" href={`/staff/transactions/${t()!.id}/backroom?item=${item.id}`}>
                                  📱 Nilai di Ruang Khasanah
                                </A>
                                <Show when={t().status !== "completed"}>
                                  <Button tone="ghost" class="sm" onClick={() => setConfirmRemove(item.id)}>
                                    Hapus
                                  </Button>
                                </Show>
                              </div>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Card>

                  <Card title="Perekaman Percakapan & Evaluasi AI" actions={<Button tone="ghost" class="sm" onClick={() => setRecorderOpen(!recorderOpen())}>{recorderOpen() ? "Sembunyikan" : "Tampilkan"}</Button>}>
                    <Show when={recorderOpen()} fallback={<p class="hint">Rekam percakapan staf–pelanggan untuk evaluasi komunikasi. Perekaman otomatis berjeda saat kembali ke ruang khasanah.</p>}>
                      <RecordingPanel transactionId={t().id} />
                    </Show>
                  </Card>

                  <Card title="Riwayat Transaksi">
                    <div style="display:flex;flex-direction:column;gap:10px">
                      <For each={[...t().history].reverse()}>
                        {(h) => (
                          <div style="display:flex;gap:10px">
                            <span style="color:var(--blue-500);margin-top:3px">•</span>
                            <div>
                              <b style="font-size:13.5px">{h.label}</b>
                              {h.detail && <div class="hint">{h.detail}</div>}
                              <div class="hint">
                                {dateTime(h.at)} · {h.actor}
                              </div>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Card>
                </div>

                <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
                  <Card pad={false}>
                    <div class="card-body">
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
                        <StatusBadge status={t().status} />
                        <span class="hint">
                          {t().lastDevice ? `Terakhir disunting dari ${t().lastDevice}` : ""}
                        </span>
                      </div>
                      <div class="divider" />
                      <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
                        <div>
                          <div class="hint">Total Tawaran</div>
                          <div style="font-size:30px;font-weight:800" class="num">
                            {money(quoteSum())}
                          </div>
                        </div>
                        <div style="flex:1" />
                        <div class="hint" style="text-align:right">
                          Harga emas hari ini ≥ 24K
                          <br />
                          <b class="num">{money(goldPrices()?.prices[24] ?? 0)}/g</b>
                        </div>
                      </div>
                      <div style="margin-top:12px">
                        <div class="track" style="height:9px;background:#edf2f7;border-radius:99px;overflow:hidden">
                          <div class="fill" style={`height:100%;width:${percentDone()}%;background:linear-gradient(90deg,var(--blue-400),var(--blue-700));border-radius:99px`} />
                        </div>
                        <div class="hint" style="margin-top:6px">Progres alur {percentDone()}%</div>
                      </div>
                    </div>
                  </Card>

                  <Card title="Aksi Alur Kerja">
                    <div class="wf-actions">
                      <Button class="lg block" disabled={!canQuoteNow()} onClick={() => void doQuote()}>
                        {busy() === "quote" ? "Menghitung…" : "🧮 Hitung Harga dari Penilaian"}
                      </Button>
                      <A class="btn block lg" href={`/present/${t()!.id}`} style={!someQuoted() ? "pointer-events:none;opacity:.5" : ""}>
                        🖥️ Mode Presentasi Pelanggan
                      </A>
                      <Button class="block" onClick={() => void openQr()}>
                        🔗 Tautan &amp; QR Pelanggan
                      </Button>
                      <Switch>
                        <Match when={t().status === "awaiting_decision"}>
                          <p class="wf-note">Pelanggan sudah melihat penawaran. Catat keputusannya:</p>
                          <div style="display:flex;gap:8px">
                            <Button tone="gold" disabled={busy() === "accept"} onClick={() => void acceptOffer()}>
                              ✅ Diterima
                            </Button>
                            <Button tone="danger" onClick={() => setRejectModal(true)}>
                              ⛔ Ditolak
                            </Button>
                          </div>
                        </Match>
                        <Match when={t().status === "rejected"}>
                          <span class="badge red">
                            <span class="dot" />
                            Ditolak{t().rejectNote ? ` — ${t().rejectNote}` : ""}
                          </span>
                        </Match>
                        <Match when={["accepted", "payment_processing"].includes(t().status)}>
                          <p class="wf-note">
                            Penawaran diterima pada {dateTime(t().decision?.decidedAt)}. Lanjutkan ke pembayaran.
                          </p>
                        </Match>
                        <Match when={true}>
                          <p class="wf-note">Selesaikan penilaian semua perhiasan, lalu hitung harga untuk membuka langkah keputusan pelanggan.</p>
                        </Match>
                      </Switch>
                      <Show when={["accepted", "payment_processing"].includes(t().status)}>
                        <A class="btn gold block lg" href={`/staff/transactions/${t()!.id}/payment`}>
                          💰 Proses Pembayaran
                        </A>
                      </Show>
                      <Show when={t().status === "completed"}>
                        <div class="badge green" style="justify-content:center;padding:10px">
                          <span class="dot" /> Transaksi selesai pada {dateTime(t().payment?.confirmedAt)}
                        </div>
                      </Show>
                    </div>
                  </Card>

                  <Card title="Cara Sinkron Antar Perangkat">
                    <p class="hint">
                      Buka transaksi yang sama di iPhone (ruang khasanah) atau iPad atas. Setiap perubahan disimpan ke server lewat API dan disebarkan ke semua perangkat yang membuka transaksi ini secara waktu-nyata (WebSocket).
                    </p>
                    <p class="hint" style="margin-top:6px">
                      Perangkat saat ini: <b>{deviceLabel()}</b>
                    </p>
                  </Card>
                </div>
              </div>

              <Show when={addModal() === "photo"}>
                <Modal title="Foto Perhiasan" onClose={() => setAddModal(null)}>
                  <CameraCapture
                    title="Gunakan kamera iPad counter. Pastikan perhiasan pada bidang fokus."
                    onCapture={(url) => {
                      setPendingPhoto(url);
                      setAddModal("details");
                    }}
                    onCancel={() => setAddModal(null)}
                  />
                </Modal>
              </Show>

              <Show when={addModal() === "details"}>
                <Modal
                  title="Detail Perhiasan"
                  onClose={() => setAddModal(null)}
                  footer={
                    <Button tone="gold" disabled={busy() === "additem"} onClick={() => void addItem()}>
                      {busy() === "additem" ? "Menyimpan…" : "Tambah ke Transaksi"}
                    </Button>
                  }
                >
                  <div style="display:grid;grid-template-columns:110px 1fr;gap:14px;align-items:start">
                    <img src={pendingPhoto()} alt="Foto perhiasan" style="width:110px;height:110px;object-fit:cover;border-radius:12px;border:1px solid var(--line)" />
                    <div class="field" style="gap:12px">
                      <label class="field">
                        <span class="lbl">Deskripsi</span>
                        <input class="input" placeholder="cth. Cincin emas kuning 7g" value={description()} onInput={(e) => setDescription(e.currentTarget.value)} />
                      </label>
                      <label class="field">
                        <span class="lbl">Jenis</span>
                        <select class="select" value={jtype()} onChange={(e) => setJtype(e.currentTarget.value as JewelryType)}>
                          <For each={JEWELRY_TYPES}>{(jt) => <option value={jt}>{jewelryTypeLabel(jt)}</option>}</For>
                        </select>
                      </label>
                      <Button tone="ghost" class="sm" onClick={() => setAddModal("photo")}>
                        Ambil ulang foto
                      </Button>
                    </div>
                  </div>
                </Modal>
              </Show>

              <Show when={photoForItem()}>
                <Modal title="Perbarui Foto Perhiasan" onClose={() => setPhotoForItem(null)}>
                  <CameraCapture
                    onCapture={(url) => {
                      const target = photoForItem()!;
                      setPhotoForItem(null);
                      void retakeItem(target, url);
                    }}
                    onCancel={() => setPhotoForItem(null)}
                  />
                </Modal>
              </Show>

              <Show when={confirmRemove()}>
                <Modal
                  title="Hapus perhiasan ini?"
                  onClose={() => setConfirmRemove(null)}
                  footer={
                    <Button tone="danger" onClick={() => void removeItem(confirmRemove()!)}>
                      Hapus
                    </Button>
                  }
                >
                  <p>Perhiasan beserta penilaian dan harganya akan dihapus dari transaksi.</p>
                </Modal>
              </Show>

              <Show when={rejectModal()}>
                <Modal
                  title="Catat Penolakan"
                  onClose={() => setRejectModal(false)}
                  footer={
                    <Button tone="danger" onClick={() => void rejectOffer()}>
                      Simpan Penolakan
                    </Button>
                  }
                >
                  <Field label="Alasan pelanggan (opsional)">
                    <textarea class="input" placeholder="cth. harga masih di bawah harapan" value={rejectNote()} onInput={(e) => setRejectNote(e.currentTarget.value)} />
                  </Field>
                </Modal>
              </Show>

              <Show when={qrModal()}>
                <Modal title="Tautan Pelanggan" onClose={() => setQrModal(false)}>
                  <div class="mgmt-qr">
                    <Show when={qrDataUrl()} fallback={<LoadingBlock label="Menyiapkan kode QR…" />}>
                      <img src={qrDataUrl()} alt="QR Code" />
                    </Show>
                    <div style="flex:1;min-width:240px">
                      <p class="hint">
                        Pelanggan dapat memindai QR ini untuk melihat hasil penilaian di ponselnya sendiri — tanpa perlu masuk, hanya-baca, berlaku {(link()?.ttlMinutes ?? 0) / 60} jam.
                      </p>
                      <div style="margin-top:10px" class="kv">
                        <span class="k">Tautan</span>
                        <span class="v" style="word-break:break-all">{link()?.url ?? "-"}</span>
                      </div>
                      <div class="kv">
                        <span class="k">Berlaku hingga</span>
                        <span class="v">{dateTime(link()?.expiresAt)}</span>
                      </div>
                      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
                        <Button tone="secondary" class="sm" onClick={() => void regenerate()}>
                          Buat tautan baru
                        </Button>
                        <Button
                          tone="ghost" class="sm"
                          onClick={() => {
                            void navigator.clipboard?.writeText(`${location.origin}${link()?.url ?? ""}`);
                            pushToast("Tautan disalin.", "success");
                          }}
                        >
                          Salin tautan
                        </Button>
                        <A class="btn ghost sm" href={link()?.url ?? "#"} target="_blank">
                          Buka pratinjau
                        </A>
                      </div>
                    </div>
                  </div>
                </Modal>
              </Show>
            </>
          )}
        </Show>
      </Show>
    </Shell>
  );
}
