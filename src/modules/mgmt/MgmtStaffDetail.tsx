import { A, useParams } from "@solidjs/router";
import { For, Show, createResource } from "solid-js";
import { Shell } from "../../components/shell";
import { Card, StatCard, LoadingBlock, ErrorState, EmptyState, Avatar, StatusBadge, Modal } from "../../components/ui";
import { managementService } from "../../api/services/management.service";
import { transactionsService } from "../../api/services/transactions.service";
import type { StaffEvaluation } from "../../lib/types";
import { dateTime, money, relative } from "../../lib/format";
import { createSignal } from "solid-js";

export function MgmtStaffDetail() {
  const params = useParams();
  const [detail, { refetch }] = createResource(
    () => params.id,
    (id) => managementService.staffDetail(id)
  );
  const [openTxn, setOpenTxn] = createSignal<string | null>(null);

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
      title="Profil Kinerja"
      sub={detail()?.staff.name}
    >
      <A class="back-link" href="/management/staff">
        ← Daftar staf
      </A>
      <Show when={!detail.loading} fallback={<LoadingBlock />}>
        <Show when={detail()} fallback={<ErrorState onRetry={() => void refetch()} />}>
          {(d) => (
            <>
              <div class="grid stats-3" style="margin:12px 0 18px">
                <Card>
                  <div style="display:flex; gap:14px; align-items:center">
                    <Avatar initials={d().staff.initials} size={54} />
                    <div>
                      <b style="font-size:17px">{d().staff.name}</b>
                      <div class="hint">
                        {d().staff.jobTitle} · {d().branch?.name ?? "—"}
                      </div>
                      <div class="hint">{d().staff.email}</div>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div class="crit-row" style="margin:6px 0">
                    <span class="lbl">Rata-rata skor AI</span>
                    <div class="track">
                      <div class="fill gold" style={`width:${d().summary.avgOverallScore}%`} />
                    </div>
                    <span class="sc num">{d().summary.avgOverallScore || "—"}</span>
                  </div>
                  <div class="hint">Seluruh evaluasi percakapan dalam tindakan staf ini.</div>
                </Card>
                <div style="display:contents">
                  <StatCard label="Pelanggan dilayani" value={String(d().summary.served)} sub={`${d().summary.completed} selesai pembayaran`} />
                </div>
              </div>

              <div class="grid stats-3" style="margin-bottom:18px">
                <StatCard label="Tawaran diterima" value={String(d().summary.accepted)} />
                <StatCard label="Tawaran ditolak" value={String(d().summary.rejected)} />
                <StatCard label="Konversi" value={`${Math.round(d().summary.conversionRate)}%`} gold />
              </div>

              <div class="grid two" style="align-items:start">
                <div style="display:flex; flex-direction:column; gap:16px">
                  <Card title="Riwayat Evaluasi AI">
                    <For each={d().evaluations.slice(0, 8)}>
                      {(ev: StaffEvaluation) => (
                        <div style="margin-bottom:14px">
                          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px">
                            <b style="font-size:13.5px">{ev.transactionId.slice(0, 16)}</b>
                            <span class="badge gold">
                              <span class="dot" />
                              {ev.overallScore}
                            </span>
                          </div>
                          <For each={ev.criteria}>
                            {(c) => (
                              <div class="crit-row">
                                <span class="lbl">{c.label}</span>
                                <div class="track">
                                  <div
                                    class="fill"
                                    style={`width:${c.score}%; background: ${c.score >= 85 ? "var(--success)" : c.score >= 70 ? "var(--blue-500)" : "var(--danger)"}`}
                                  />
                                </div>
                                <span class="sc num">{c.score}</span>
                              </div>
                            )}
                          </For>
                          <Show when={ev.strengths.length}>
                            <div class="hint" style="margin-top:6px">
                              <b>Kelebihan:</b> {ev.strengths.join(" ")}
                            </div>
                          </Show>
                          <Show when={ev.improvements.length}>
                            <div class="hint" style="margin-top:3px">
                              <b>Perbaikan:</b> {ev.improvements.join(" ")}
                            </div>
                          </Show>
                          <div class="hint" style="margin-top:3px">{relative(ev.createdAt)}</div>
                          <div class="divider" style="margin:10px 0" />
                        </div>
                      )}
                    </For>
                    <Show when={d().evaluations.length === 0}>
                      <EmptyState icon="🎙️" title="Belum ada evaluasi" hint="Evaluasi muncul setelah transaksi staf ini menyimpan transkripsi percakapan." />
                    </Show>
                  </Card>
                </div>

                <div style="display:flex; flex-direction:column; gap:16px">
                  <Card pad={false} title="Transaksi Terakhir">
                    <div class="table-wrap" style="border:none; border-radius:0; box-shadow:none">
                      <table class="tbl" style="min-width:0">
                        <thead>
                          <tr>
                            <th>Kode</th>
                            <th>Status</th>
                            <th class="num">Total</th>
                            <th>Perangkat</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={d().recentTransactions}>
                            {(t) => (
                              <tr>
                                <td style="font-weight:700">{t.code}</td>
                                <td>
                                  <StatusBadge status={t.status} />
                                </td>
                                <td class="num">{money(t.items.reduce((a, it) => a + (it.quote?.total ?? 0), 0))}</td>
                                <td class="hint">{t.lastDevice ?? "—"}</td>
                                <td >
                                  <button
                                    class="btn ghost sm"
                                    onClick={() => {
                                      setOpenTxn(t.id);
                                    }}
                                  >
                                    Transkrip
                                  </button>
                                </td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}
        </Show>
      </Show>

      <Show when={openTxn()}>
        <TranscriptModal id={openTxn()!} onClose={() => setOpenTxn(null)} />
      </Show>
    </Shell>
  );
}

function TranscriptModal(props: { id: string; onClose: () => void }) {
  const [segs] = createResource(
    () => props.id,
    (id) => transactionsService.getTranscriptions(id)
  );
  return (
    <Modal title="Transkripsi Percakapan" onClose={props.onClose} wide>
      <Show when={!segs.loading} fallback={<LoadingBlock label="Memuat transkripsi…" />}>
        <div class="transcript-scroll">
          <For each={segs() ?? []}>
            {(seg) => (
              <div class="seg">
                <span class="when">
                  {dateTime(seg.startedAt)} · {seg.speakerHint ?? "mixed"} · {seg.deviceId ?? ""}
                </span>
                {seg.text}
              </div>
            )}
          </For>
          <Show when={(segs() ?? []).length === 0}>
            <EmptyState icon="🎙️" title="Belum ada transkripsi pada transaksi ini" />
          </Show>
        </div>
      </Show>
    </Modal>
  );
}
