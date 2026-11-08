import { A, useParams } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { Shell } from "../../components/shell";
import { Button, Card, Field, LoadingBlock, EmptyState } from "../../components/ui";
import { CameraCapture } from "../../components/camera";
import { DeviceBanner } from "../../components/sync";
import { useTxResource, itemTotal } from "./tx-data";
import { transactionsService } from "../../api/services/transactions.service";
import { money, dateTime, relative } from "../../lib/format";
import { pushToast } from "../../stores/toast";
import { deviceLabel } from "../../stores/sync";

type Method = "cash" | "transfer" | "ewallet";

const METHODS: { key: Method; label: string; hint: string }[] = [
  { key: "cash", label: "Tunai", hint: "Uang tunai diserahkan langsung" },
  { key: "transfer", label: "Transfer", hint: "Bank/IBT ke rekening cabang" },
  { key: "ewallet", label: "E-wallet", hint: "QRIS/GO-OVK/DANA" },
];

export function PaymentPage() {
  const params = useParams();
  const { tx, refetch } = useTxResource(() => params.id);

  const [method, setMethod] = createSignal<Method>("transfer");
  const [amount, setAmount] = createSignal("");
  const [reference, setReference] = createSignal("");
  const [receiptModal, setReceiptModal] = createSignal(false);
  const [busy, setBusy] = createSignal("");

  const ready = () => tx() && ["accepted", "payment_processing", "completed"].includes(tx()!.status);
  const total = () => itemTotal(tx());

  async function recordPayment(): Promise<void> {
    if (!tx()) return;
    const amt = parseFloat(amount().replace(",", ".")) || total();
    if (amt <= 0) {
      pushToast("Jumlah pembayaran belum valid.", "error");
      return;
    }
    setBusy("pay");
    try {
      await transactionsService.pay(tx()!.id, { method: method(), amount: amt, reference: reference().trim() || undefined });
      pushToast("Pembayaran dicatat. Lengkapi foto struk.", "success");
      refetch();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal mencatat pembayaran.", "error");
    } finally {
      setBusy("");
    }
  }

  async function attachReceipt(url?: string): Promise<void> {
    setReceiptModal(false);
    if (!tx()) return;
    setBusy("receipt");
    try {
      await transactionsService.attachReceipt(tx()!.id, { dataUrl: url, confirm: true });
      await refetch();
      pushToast(url ? "Struk tersimpan dan pembayaran dikonfirmasi." : "Pembayaran dikonfirmasi — transaksi selesai.", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal menyimpan struk.", "error");
    } finally {
      setBusy("");
    }
  }

  const succeeded = () => tx()?.status === "completed";

  return (
    <Shell
      role="staff"
      nav={[
        { path: "/staff", label: "Antrian Transaksi", icon: "🗂️" },
        { path: "/staff/new", label: "Transaksi Baru", icon: "➕" },
      ]}
      title="Pembayaran"
      sub={tx() ? `Transaksi ${tx()!.code} · ${tx()!.customer.name}` : undefined}
    >
      <div style="max-width:620px; margin:0 auto">
        <Show when={tx()} fallback={<LoadingBlock label="Memuat transaksi…" />}>
          {(t) => (
            <div style="display:flex; flex-direction:column; gap:14px">
              <DeviceBanner kind="ipad" hint="Tawaran yang sesuai dengan yang disajikan kepada pelanggan" />
              <Show when={!ready()} fallback={null}>
                <EmptyState icon="⏳" title="Penawaran belum diterima" hint="Kembali ke mode presentasi atau hub untuk mencatat keputusan pelanggan terlebih dahulu.">
                  <A class="btn" style="margin-top:10px" href={`/staff/transactions/${t().id}/present`}>
                    Mode Presentasi
                  </A>
                </EmptyState>
              </Show>
              <Show when={ready()}>
                <Card pad={false}>
                  <div class="card-body">
                    <span class="badge gold">
                      <span class="dot" />
                      {t().status === "completed" ? "Selesai" : t().status === "payment_processing" ? "Pembayaran berlangsung" : "Penawaran diterima"}
                    </span>
                    <div style="display:flex; align-items:flex-end; gap:12px; margin-top:10px; flex-wrap:wrap">
                      <div>
                        <div class="hint">Total Tawaran</div>
                        <div class="num" style="font-size:34px; font-weight:800">
                          {money(total())}
                        </div>
                      </div>
                      <div style="flex:1" />
                      <div class="hint" style="text-align:right">
                        Diterima pada {dateTime(t().decision?.decidedAt)}
                      </div>
                    </div>
                  </div>
                </Card>
              </Show>

              <Show when={ready() && !t().payment}>
                <Card title="Metode & Jumlah Pembayaran">
                  <div class="payment-methods">
                    <For each={METHODS}>
                      {(m) => (
                        <button class={`pm ${method() === m.key ? "sel" : ""}`} onClick={() => setMethod(m.key)}>
                          {m.label}
                          <small>{m.hint}</small>
                        </button>
                      )}
                    </For>
                  </div>
                  <div class="divider" />
                  <div class="form-grid">
                    <Field label="Jumlah Dibayarkan (Rp)">
                      <input
                        class="input num"
                        inputmode="numeric"
                        placeholder={String(total())}
                        value={amount()}
                        onInput={(e) => setAmount(e.currentTarget.value)}
                      />
                    </Field>
                    <Field label="No. Referensi (opsional)">
                      <input class="input" placeholder="cth. TRX983221" value={reference()} onInput={(e) => setReference(e.currentTarget.value)} />
                    </Field>
                  </div>
                  <div style="display:flex; justify-content:flex-end; margin-top:14px">
                    <Button tone="gold lg" disabled={busy() === "pay"} onClick={() => void recordPayment()}>
                      {busy() === "pay" ? "Menyimpan…" : "💾 Catat Pembayaran"}
                    </Button>
                  </div>
                </Card>
              </Show>

              <Show when={t().payment?.paidAt && !succeeded()}>
                <Card title="Struk Pembayaran">
                  <Show when={t().payment?.receiptPhoto} fallback={<EmptyState icon="🧾" title="Foto struk belum tersedia" hint="Foto struk menjadi bukti pembayaran di laporan." />}>
                    <img src={t().payment!.receiptPhoto!} alt="Struk" style="width:100%; max-width:320px; border-radius:12px; border:1px solid var(--line)" />
                  </Show>
                  <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap">
                    <Button tone="gold" onClick={() => setReceiptModal(true)}>
                      📸 {t().payment?.receiptPhoto ? "Ambil ulang foto struk" : "Foto struk pembayaran"}
                    </Button>
                    <A class="btn ghost" href={`/staff/transactions/${t().id}`}>
                      ← Kembali ke Counter
                    </A>
                  </div>
                </Card>
              </Show>

              <Show when={succeeded()}>
                <Card>
                  <div class="success-hero">
                    <div class="mark">✓</div>
                    <h2 style="font-size:20px">Transaksi selesai</h2>
                    <p class="hint" style="margin-top:6px">
                      {t().payment?.method} · {money(t().payment?.amount ?? 0)} · {relative(t().payment?.paidAt ?? "")}
                    </p>
                    <Show when={t().payment?.receiptPhoto}>
                      <img src={t().payment!.receiptPhoto!} alt="Struk" style="width:230px; border-radius:12px; border:1px solid var(--line); margin-top:14px" />
                    </Show>
                  </div>
                  <div style="display:flex; gap:10px; justify-content:center">
                    <A class="btn gold" href="/staff">
                      Antrian transaksi
                    </A>
                    <A class="btn ghost" href={`/staff/transactions/${t().id}`}>
                      Rincian transaksi
                    </A>
                  </div>
                </Card>
              </Show>
            </div>
          )}
        </Show>
        <Show when={receiptModal()}>
          <CameraCapture
            onCapture={(url) => void attachReceipt(url)}
            onCancel={() => setReceiptModal(false)}
          />
        </Show>
      </div>
    </Shell>
  );
}
