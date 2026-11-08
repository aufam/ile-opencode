import { For, Show, createResource } from "solid-js";
import { Shell } from "../../components/shell";
import { Card, StatCard, LoadingBlock, ErrorState, StatusBadge } from "../../components/ui";
import { BarChart, DonutChart, LineChart } from "../../components/charts";
import { managementService } from "../../api/services/management.service";
import { money, relative } from "../../lib/format";
import { A } from "@solidjs/router";
import type { BranchStats } from "../../lib/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "#93a5b4",
  in_appraisal: "#4a9de2",
  awaiting_decision: "#d4af37",
  accepted: "#57c993",
  payment_processing: "#e5cf8e",
  completed: "#1f8f5f",
  rejected: "#d64550",
  cancelled: "#7a8b99",
};

export function MgmtDashboard() {
  const [dash, { refetch }] = createResource(() => managementService.dashboard());

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
      title="Ringkasan Operasional"
      sub="Gambaran lintas cabang hari ini"
    >
      <div class="grid stats-4" style="margin-bottom:16px">
        <StatCard label="Transaksi hari ini" value={dash() ? String(dash()!.totals.transactionsToday) : "—"} sub="Semua cabang" />
        <StatCard label="Nilai penawaran hari ini" value={money(dash()?.totals.purchaseValueToday ?? 0)} gold sub="Tawaran yang disetujui" />
        <StatCard label="Pembayaran selesai" value={dash() ? String(dash()!.totals.completedPayments) : "—"} sub={money(dash()?.totals.completedPaymentsValue ?? 0)} />
        <StatCard label="Transaksi aktif" value={dash() ? String(dash()!.totals.activeTransactions) : "—"} sub={`${dash()?.totals.customersServed ?? 0} pelanggan dilayani hari ini`} />
      </div>

      <Show when={!dash.loading} fallback={<LoadingBlock label="Mengumpulkan statistik…" />}>
        <Show when={dash()} fallback={<ErrorState onRetry={() => void refetch()} />}>
          {(d) => (
            <>
              <div class="grid two" style="margin-bottom:16px">
                <Card title="Tren 7 Hari">
                  <LineChart
                    points={d().dailyTrend.map((x) => ({ label: x.label, value: x.transactions }))}
                    height={190}
                  />
                  <p class="hint" style="margin-top:8px">
                    Total nilai minggu ini {money(d().dailyTrend.reduce((a, x) => a + x.value, 0))} dari {d().dailyTrend.reduce((a, x) => a + x.transactions, 0)} transaksi.
                  </p>
                </Card>
                <Card title="Distribusi Status">
                  <DonutChart
                    items={d().statusMix.map((s) => ({ label: s.status, value: s.count, color: STATUS_COLORS[s.status] ?? "#93a5b4" }))}
                    centerLabel="transaksi"
                  />
                </Card>
              </div>

              <div class="grid two" style="margin-bottom:16px">
                <Card title="Perbandingan Cabang (transaksi hari ini)">
                  <BarChart
                    points={d().branchStats.map((b, i) => ({
                      label: b.branchId.replace("br-", "").toUpperCase(),
                      value: b.transactionsToday,
                      sub: `${money(b.purchaseValueToday)} disetujui`,
                      }))}
                    height={200}
                  />
                  <div style="margin-top:12px; display:flex; flex-direction:column; gap:6px">
                    <For each={d().branchStats}>
                      {(b, i) => <BranchBar stat={b} idx={i()} />}
                    </For>
                  </div>
                </Card>
                <Card title="Staf Terbaik (skor AI rata-rata)">
                  <For each={d().topStaff.slice(0, 6)}>
                    {(s) => (
                      <A class="bar-top" href={`/management/staff/${s.staffId}`}>
                        <span style="width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">{s.name}</span>
                        <div class="track">
                          <div class="fill gold" style={`width:${s.avgOverallScore}%`} />
                        </div>
                        <span class="num">{s.avgOverallScore}</span>
                      </A>
                    )}
                  </For>
                  <p class="hint" style="margin-top:10px">
                    Skor berasal dari evaluasi percakapan AI terhadap rekaman transaksi staf.
                  </p>
                </Card>
              </div>

              <Card pad={false} title="Transaksi Terbaru" actions={<A class="btn ghost sm" href="/management/transactions">Lihat semua</A>}>
                <div class="table-wrap" style="border:none; border-radius:0; box-shadow:none">
                  <table class="tbl">
                    <thead>
                      <tr>
                        <th>Kode</th>
                        <th>Cabang</th>
                        <th>Pelanggan</th>
                        <th>Status</th>
                        <th class="num">Total</th>
                        <th>Waktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={d().recentTransactions}>
                        {(t) => (
                          <tr class="click">
                            <td>
                              <A href={`/management/transactions/${t.id}`}>{t.code}</A>
                            </td>
                            <td>{t.branchId.replace("br-", "").toUpperCase()}</td>
                            <td>{t.customer.name}</td>
                            <td>
                              <StatusBadge status={t.status} />
                            </td>
                            <td class="num">{money(t.items.reduce((a, it) => a + (it.quote?.total ?? 0), 0))}</td>
                            <td>{relative(t.createdAt)}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </Show>
      </Show>
    </Shell>
  );
}

function BranchBar(props: { stat: BranchStats; idx: number }) {
  return (
    <A class="bar-top" href={`/management/branches?focus=${props.stat.branchId}`} style="cursor:pointer">
      <span style="width:130px; color:var(--ink-700); font-size:12.5px; font-weight:650">
        #{props.idx + 1} {props.stat.branchId.replace("br-", "")}
      </span>
      <div class="track">
        <div class="fill" style={`width:${Math.max(4, Math.min(100, props.stat.conversionRate))}%`} />
      </div>
      <span class="num" style="width:110px; font-size:11.5px">
        {props.stat.customersServed} pelanggan
      </span>
    </A>
  );
}
