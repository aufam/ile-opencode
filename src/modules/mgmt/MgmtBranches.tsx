import { For, Show, createResource } from "solid-js";
import { A, useSearchParams } from "@solidjs/router";
import { Shell } from "../../components/shell";
import { Card, LoadingBlock, ErrorState } from "../../components/ui";
import { managementService } from "../../api/services/management.service";
import { money } from "../../lib/format";

export function MgmtBranches() {
  const [searchParams] = useSearchParams();
  const focus = () => (typeof searchParams.focus === "string" ? searchParams.focus : "");

  const [board] = createResource(() => managementService.branchBoard());
  const [staffList] = createResource(() => managementService.staffList());

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
      title="Cabang"
      sub="Kondisi operasional seluruh cabang"
    >
      <Show when={!board.loading} fallback={<LoadingBlock />}>
        <Show when={board()} fallback={<ErrorState onRetry={() => undefined} />}>
          {(data) => (
            <div class="grid three">
              <For each={data().branches}>
                {(b, i) => {
                  const stat = data().stats.find((s) => s.branchId === b.id);
                  const isFocus = focus() === b.id;
                  return (
                    <Card class="branch-card" style={isFocus ? "outline: 2px solid var(--blue-400)" : ""}>
                      <div class="top">
                        <div class="icon-badge">{b.code.slice(0, 3)}</div>
                        <div style="min-width:0">
                          <b>{b.name}</b>
                          <div class="hint">
                            {b.city} · {b.phone}
                          </div>
                        </div>
                        <div style="flex:1" />
                        <A class="btn ghost sm" href={`/management/transactions?branch=${b.id}`}>
                          Transaksi
                        </A>
                      </div>
                      <div class="branch-stats">
                        <div>
                          <b>{stat?.transactionsToday ?? 0}</b>
                          <span>Transaksi</span>
                        </div>
                        <div>
                          <b>{stat?.completedPayments ?? 0}</b>
                          <span>Lunas</span>
                        </div>
                        <div>
                          <b>{stat?.activeTransactions ?? 0}</b>
                          <span>Aktif</span>
                        </div>
                        <div>
                          <b class="num">{money(stat?.purchaseValueToday ?? 0).replace("Rp", "")}</b>
                          <span>Setuj. nilai</span>
                        </div>
                      </div>
                      <div>
                        <div class="hint" style="margin-bottom:6px">
                          Counter ({b.counters.length}) &amp; staf
                        </div>
                        <div class="staff-chips">
                          <For each={b.counters.map((c) => `🖥️ ${c.name}`)}>
                            {(c) => <span class="chip">{c}</span>}
                          </For>
                          <For each={(stat?.staffIds ?? []).map((sid) => (staffList() ?? []).find((x) => x.staffId === sid))}>
                            {(member) => (
                              <Show when={member}>
                                <A class="chip" href={`/management/staff/${member!.staffId}`}>
                                  {member!.name}
                                </A>
                              </Show>
                            )}
                          </For>
                        </div>
                      </div>
                      <div class="hint">
                        #{i() + 1} · tingkat konversi {Math.round(stat?.conversionRate ?? 0)}%
                      </div>
                    </Card>
                  );
                }}
              </For>
            </div>
          )}
        </Show>
      </Show>
      <p class="hint" style="margin-top:14px">
        Perbandingan kinerja antar cabang dapat ditinjau di Ringkasan pada grafik cabang.
      </p>
    </Shell>
  );
}
