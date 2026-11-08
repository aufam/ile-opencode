import { A, useParams } from "@solidjs/router";
import { For, Show, createResource } from "solid-js";
import { Shell } from "../../components/shell";
import { Card, LoadingBlock, EmptyState, StatusBadge } from "../../components/ui";
import { transactionsService } from "../../api/services/transactions.service";
import { money, gram, dateTime, relative, jewelryTypeLabel } from "../../lib/format";

export function MgmtTransactionDetail() {
  const params = useParams();
  const [tx, { refetch }] = createResource(
    () => params.id,
    (id) => transactionsService.get(id)
  );

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
      title="Rincian Transaksi"
      sub={tx()?.code}
    >
      <A class="back-link" href="/management/transactions">
        ← Daftar transaksi
      </A>
      <Show when={!tx.loading} fallback={<LoadingBlock label="Memuat rincian transaksi…" />}>
        <Show when={tx()} fallback={<EmptyState title="Transaksi tidak ditemukan" icon="🧾" />}>
          {(t) => (
            <div class="grid two" style="align-items:start; margin-top:12px">
              <div style="display:flex; flex-direction:column; gap:16px; min-width:0">
                <Card>
                  <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap">
                    <div>
                      <div style="font-weight:800; font-size:18px">{t().code}</div>
                      <div class="hint">
                        {t().branchId.replace("br-", "").toUpperCase()} · dibuat {dateTime(t().createdAt)}
                      </div>
                    </div>
                    <StatusBadge status={t().status} />
                  </div>
                  <div class="divider" />
                  <div class="kv">
                    <span class="k">Pelanggan</span>
                    <span class="v">
                      {t().customer.name}
                      <span class="hint" style="display:block">{t().customer.phone ?? ""}</span>
                    </span>
                  </div>
                  <div class="kv">
                    <span class="k">Tipe ID</span>
                    <span class="v">
                      {t().customer.idType ?? "—"}
                      {t().customer.idNumber ? ` · ${t().customer.idNumber}` : ""}
                    </span>
                  </div>
                  <div class="kv">
                    <span class="k">Terakhir disunting</span>
                    <span class="v">
                      {relative(t().updatedAt)} · {t().lastDevice ?? "perangkat tidak tercatat"}
                    </span>
                  </div>
                  <div class="kv">
                    <span class="k">Total tawaran</span>
                    <span class="v num">{money(t().items.reduce((a, it) => a + (it.quote?.total ?? 0), 0))}</span>
                  </div>
                </Card>

                <Card title={`Butir Perhiasan (${t().items.length})`}>
                  <div style="display:flex; flex-direction:column; gap:12px">
                    <For each={t().items}>
                      {(it) => (
                        <div class="item-card">
                          <div class="item-thumb" style={it.photo ? `background-image:url(${it.photo});border:none` : ""}>
                            {!it.photo ? "💍" : ""}
                          </div>
                          <div class="item-rows">
                            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
                              <b>{it.description}</b>
                              <span class="badge gray">{jewelryTypeLabel(it.type)}</span>
                            </div>
                            <Show when={it.appraisal}>
                              <div class="meta num">
                                {gram(it.appraisal!.weightG)} · {it.appraisal!.karat}K
                                <Show when={it.appraisal!.measuredPurity}> · {it.appraisal!.measuredPurity}% XRF</Show>
                              </div>
                            </Show>
                            <Show when={it.quote}>
                              <div class="meta num" style="color:var(--blue-700); font-weight:700">
                                Tawaran {money(it.quote!.total)} · dasar {money(it.quote!.subtotal)}
                              </div>
                              <div class="hint">
                                Dihitung {dateTime(it.quote!.calculatedAt)} · daftar harga {it.quote!.priceListId}
                              </div>
                            </Show>
                            <Show when={it.appraisal && (it.appraisal.scalePhoto || it.appraisal.xrfPhoto)}>
                              <div class="photos-grid" style="margin-top:8px; max-width:280px">
                                <Show when={it.appraisal?.scalePhoto}>
                                  <div class="photo-thumb" style={`background-image:url(${it.appraisal!.scalePhoto})`}>
                                    <span class="cap">Timbangan</span>
                                  </div>
                                </Show>
                                <Show when={it.appraisal?.xrfPhoto}>
                                  <div class="photo-thumb" style={`background-image:url(${it.appraisal!.xrfPhoto})`}>
                                    <span class="cap">XRF</span>
                                  </div>
                                </Show>
                              </div>
                            </Show>
                            <Show when={it.appraisal?.notes}>
                              <p class="hint" style="margin-top:6px">Catatan: {it.appraisal!.notes}</p>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Card>
              </div>

              <div style="display:flex; flex-direction:column; gap:16px; min-width:0">
                <Card title="Pembayaran">
                  <Show when={t().payment} fallback={<EmptyState icon="💳" title="Belum ada pembayaran tercatat" />}>
                    {(p) => (
                      <>
                        <div class="kv">
                          <span class="k">Metode</span>
                          <span class="v">{p().method}</span>
                        </div>
                        <div class="kv">
                          <span class="k">Jumlah</span>
                          <span class="v num">{money(p().amount)}</span>
                        </div>
                        <div class="kv">
                          <span class="k">Waktu</span>
                          <span class="v">{dateTime(p().paidAt)}</span>
                        </div>
                        <Show when={p().reference}>
                          <div class="kv">
                            <span class="k">Referensi</span>
                            <span class="v">{p().reference}</span>
                          </div>
                        </Show>
                        <Show when={p().receiptPhoto}>
                          <img
                            src={p().receiptPhoto!}
                            alt="Struk pembayaran"
                            style="width:100%; max-width:280px; border-radius:12px; border:1px solid var(--line); margin-top:12px"
                          />
                        </Show>
                      </>
                    )}
                  </Show>
                </Card>

                <Card title="Riwayat Transaksi">
                  <div style="display:flex; flex-direction:column; gap:10px">
                    <For each={[...t().history].reverse()}>
                      {(h) => (
                        <div style="display:flex; gap:10px">
                          <span style="color:var(--blue-500); margin-top:3px">•</span>
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
            </div>
          )}
        </Show>
      </Show>
    </Shell>
  );
}
