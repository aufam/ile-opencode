import { For, Show, createResource, createSignal, onCleanup } from "solid-js";
import { Shell } from "../../components/shell";
import { Card, LoadingBlock, ErrorState, Field, Button } from "../../components/ui";
import { priceService } from "../../api/services/prices.service";
import { realtime } from "../../api/ws";
import { dateTime, money } from "../../lib/format";
import { KARATS } from "../../api/mock/engine";
import { pushToast } from "../../stores/toast";
import type { GoldPrices } from "../../lib/types";

export function MgmtPrices() {
  const [today] = createResource(() => priceService.getToday());
  const [history] = createResource(() => priceService.getHistory());
  const [form, setForm] = createSignal<GoldPrices | null>(null);
  const [note, setNote] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const cleanUp = realtime.subscribe({
    onEvent: (ev) => {
      if (ev.type === "price.updated") void priceService.getToday();
    },
  });
  onCleanup(cleanUp);

  const editing = () => form() !== null;
  const toggleEdit = () => {
    if (editing()) {
      setForm(null);
    } else {
      setForm({ ...(today()?.prices ?? { 24: 0, 22: 0, 18: 0, 14: 0 }) });
      setNote("");
    }
  };

  async function savePrices(): Promise<void> {
    const f = form();
    if (!f) return;
    setBusy(true);
    try {
      await priceService.updateToday(f, note() || undefined);
      pushToast("Harga hari ini diperbarui dan tersedati ke seluruh cabang.", "success");
      setForm(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal memperbarui harga.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      role="management"
      nav={[
        { path: "/management", label: "Ringkasan", icon: "📊" },
        { path: "/management/transactions", label: "Transaksi", icon: "🧾" },
        { path: "/management/staff", label: "Kinerja Staf", icon: "🏅" },
        { path: "/management/prices", label: "Harga Emas", icon: "🪙" },
        { path: "/management/branches", label: "Cabang", icon: "🏬" },
      ]}
      title="Harga Emas Harian"
      sub="Perubahan hanya berlaku untuk penilaian baru"
    >
      <Show when={!today.loading} fallback={<LoadingBlock />}>
        <Show when={today()} fallback={<ErrorState onRetry={() => void priceService.getToday()} />}>
          {(list) => (
            <>
              <Card
                pad={false}
                title="Daftar Harga Aktif"
                actions={
                  <div style="display:flex; gap:8px; align-items:center">
                    <span class="badge green">
                      <span class="dot" />
                      Aktif sejak {dateTime(list().effectiveDate)}
                    </span>
                    <Button tone={editing() ? "ghost" : "secondary"} onClick={toggleEdit}>
                      {editing() ? "Batal" : "Edit harga"}
                    </Button>
                  </div>
                }
              >
                <div class="card-body">
                  <div class="price-row-inputs">
                    <For each={KARATS}>
                      {(k) => (
                        <Show
                          when={editing() && form()}
                          fallback={
                            <div class="stat-card gold">
                              <span class="k">{k}K per gram</span>
                              <span class="v num">{money(list().prices[k])}</span>
                            </div>
                          }
                        >
                          {(f) => (
                            <Field label={`${k}K per gram (Rp)`}>
                              <input
                                class="input num"
                                inputmode="numeric"
                                value={String(f()[k])}
                                onInput={(e) =>
                                  setForm({
                                    ...(form() as GoldPrices),
                                    [k]: parseInt(e.currentTarget.value.replace(/[^\d]/g, ""), 10) || 0,
                                  })
                                }
                              />
                            </Field>
                          )}
                        </Show>
                      )}
                    </For>
                  </div>
                  <div class="divider" />
                  <div class="kv">
                    <span class="k">Terakhir diubah oleh</span>
                    <span class="v">
                      {list().changedBy} · {dateTime(list().changedAt)}
                    </span>
                  </div>
                  <Show when={list().note}>
                    <div class="kv">
                      <span class="k">Catatan</span>
                      <span class="v">{list().note}</span>
                    </div>
                  </Show>
                  <Show when={editing()}>
                    <div style="margin-top:14px">
                      <Field label="Catatan perubahan">
                        <input class="input" placeholder="cth. sinkron harga sore" value={note()} onInput={(e) => setNote(e.currentTarget.value)} />
                      </Field>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:12px">
                      <Button tone="ghost" onClick={toggleEdit}>
                        Batal
                      </Button>
                      <Button tone="gold" disabled={busy()} onClick={() => void savePrices()}>
                        {busy() ? "Menyimpan…" : "Simpan & Terbitkan"}
                      </Button>
                    </div>
                    <p class="hint" style="margin-top:10px">
                      Transaksi yang sudah selesai mempertahankan harga saat penilaian (harga tersimpan pada tawaran perhiasan).
                    </p>
                  </Show>
                </div>
              </Card>

              <Card title="Riwayat Perubahan Harga">
                <Show when={!history.loading} fallback={<LoadingBlock />}>
                  <For each={history() ?? []}>
                    {(h) => (
                      <div class="history-item">
                        <div>
                          <b>{dateTime(h.replacedAt ?? h.effectiveDate)}</b>
                          <div class="hint">
                            {h.changedBy}
                            {h.note ? ` — ${h.note}` : ""}
                          </div>
                        </div>
                        <div class="num" style="white-space:nowrap">
                          {KARATS.map((k) => `${k}K ${money(h.prices[k])}`).join(" · ")}
                        </div>
                      </div>
                    )}
                  </For>
                  <Show when={(history() ?? []).length === 0}>
                    <p class="hint">Belum ada riwayat perubahan harga.</p>
                  </Show>
                </Show>
              </Card>
            </>
          )}
        </Show>
      </Show>
    </Shell>
  );
}
