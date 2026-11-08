import { A, useNavigate, useParams } from "@solidjs/router";
import { For, Show, createResource, createSignal } from "solid-js";
import { useTxResource, hasSomeQuote, itemTotal } from "./tx-data";
import { transactionsService } from "../../api/services/transactions.service";
import { priceService } from "../../api/services/prices.service";
import { gram, money } from "../../lib/format";
import { pushToast } from "../../stores/toast";

export function Presentation() {
  const params = useParams();
  const navigate = useNavigate();
  const { tx } = useTxResource(() => params.id);
  const [goldPrices] = createResource(() => priceService.getToday());
  const [idx, setIdx] = createSignal(0);
  const [busy, setBusy] = createSignal("");

  const items = () => (tx()?.items ?? []).filter((it) => it.quote);
  const item = () => {
    const list = items();
    if (!list.length) return undefined;
    return list[Math.min(idx(), list.length - 1)];
  };
  const overallTotal = () => itemTotal(tx());
  const firstName = () => (tx()?.customer.name ?? "").split(" ")[0] ?? "";

  function prevItem(): void {
    setIdx((i) => Math.max(0, i - 1));
  }

  function nextItem(): void {
    setIdx((i) => Math.min(items().length - 1, i + 1));
  }

  async function accept(): Promise<void> {
    if (!tx()) return;
    setBusy("accept");
    try {
      await transactionsService.decide(tx()!.id, { accepted: true });
      pushToast("Terima kasih! Tawaran telah dikonfirmasi.", "success");
      navigate(`/staff/transactions/${tx()!.id}/payment`);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal mencatat keputusan.", "error");
      setBusy("");
    }
  }

  async function reject(): Promise<void> {
    if (!tx()) return;
    setBusy("reject");
    try {
      await transactionsService.decide(tx()!.id, { accepted: false, note: "Pelanggan belum sepakat saat presentasi" });
      pushToast("Pilihan pelanggan tercatat.", "info");
      navigate(`/staff/transactions/${tx()!.id}`);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal mencatat keputusan.", "error");
      setBusy("");
    }
  }

  const bg = () => (item()?.photo ? `url(${item()!.photo})` : undefined);

  return (
    <div class="presentation">
      <div class="pres-top">
        <b>AURUM</b>
        <span class="bar" />
        <span>PENAWARAN {tx()?.code ?? ""}</span>
        <span class="bar" />
        <span>Berlaku pada {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long" })}</span>
      </div>

      <Show
        when={tx() && hasSomeQuote(tx())}
        fallback={
          <div class="pres-stage">
            <div class="pres-panel" style="text-align:center; color:rgba(234,242,251,0.85)">
              <h2 style="font-family:var(--serif); font-size:26px; margin-bottom:10px">Belum Ada Tawaran Siap</h2>
              <p>Silakan kembali ke counter dan tanyakan harga akhir untuk melanjutkan.</p>
              <A class="btn gold" style="margin-top:16px" href={`/staff/transactions/${params.id}`}>
                Kembali ke Counter
              </A>
            </div>
          </div>
        }
      >
        <div class="pres-stage pres-enter">
          <div class="pres-photo-wrap">
            <div class="pres-ring-deco" />
            <div class="pres-photo" style={bg() ? `background-image:${bg()}` : undefined}>
              <Show when={!bg()}>
                <div class="fallback">💎</div>
              </Show>
            </div>
          </div>

          <div class="pres-panel">
            <div class="pres-greet">
              Terima kasih, {firstName() || "Ibu/Bapak"} — ini hasil penilaian kami.
            </div>
            <div class="pres-goldstrip">
              <span class="lbl">Harga emas hari ini</span>
              <span class="gp num">
                {money(item()?.quote?.goldPricePerGram24 ?? goldPrices()?.prices[24] ?? 0)}/g · 24K
              </span>
            </div>
            <div class="pres-price-main num">{money(item()?.quote?.total ?? 0)}</div>
            <div class="pres-price-sub">Tawaran untuk perhiasan berikut — dapat dibayar hari ini juga.</div>

            <div class="pres-card">
              <h4>Rincian Perhitungan</h4>
              <div class="pres-line">
                <span class="k">Kondisi Istimewa · {item()?.description}</span>
              </div>
              <div class="pres-line">
                <span class="k">Berat</span>
                <span class="v num">{gram(item()?.appraisal?.weightG ?? 0)}</span>
              </div>
              <div class="pres-line">
                <span class="k">Kemurnian (karat)</span>
                <span class="v num">{item()?.quote?.karat ?? "—"}K</span>
              </div>
              <For each={item()?.quote?.breakdown ?? []}>
                {(line) => (
                  <div class={`pres-line ${line.kind === "deduction" ? "deduct" : ""}`}>
                    <span class="k">
                      {line.label}
                      {line.detail && <span style="opacity:.65; margin-left:6px; font-size:12px">{line.detail}</span>}
                    </span>
                    <span class="v num">
                      {line.kind === "deduction" ? "−" : ""}
                      {money(Math.abs(line.amount))}
                    </span>
                  </div>
                )}
              </For>
              <div class="pres-line total">
                <span class="k">Total keseluruhan ({tx()?.items.length ?? 0} butir)</span>
                <span class="v num">{money(overallTotal())}</span>
              </div>
            </div>

            <Show when={items().length > 1}>
              <div class="pres-nav">
                <button onClick={prevItem} disabled={idx() === 0}>
                  ←
                </button>
                <span class="dots">
                  <For each={items()}>{(_, i) => <i class={i() === idx() ? "on" : ""} onClick={() => setIdx(i())} />}</For>
                </span>
                <button onClick={nextItem} disabled={idx() >= items().length - 1}>
                  →
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <div class="pres-foot">
        <span>Harga berdasarkan penilaian ruang khasanah hari ini.</span>
        <span class="bar" />
        <div class="pres-ctl">
          <A
            class="btn"
            style="color:#eaf2fb; border-color:rgba(255,255,255,0.3); background:rgba(255,255,255,0.06)"
            href={`/staff/transactions/${params.id}`}
          >
            ← Counter
          </A>
          <button class="btn dark" disabled={busy() === "reject"} onClick={() => void reject()} style="background:rgba(255,255,255,0.08)">
            {busy() === "reject" ? "Menyimpan…" : "Belum sepakat"}
          </button>
          <button class="btn gold" disabled={busy() === "accept" || !item()} onClick={() => void accept()}>
            {busy() === "accept" ? "Menyimpan…" : "✅ Sepakat & Lanjutkan Pembayaran"}
          </button>
        </div>
      </div>
    </div>
  );
}
