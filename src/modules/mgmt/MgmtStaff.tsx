import { For, Show, createResource } from "solid-js";
import { A } from "@solidjs/router";
import { Shell } from "../../components/shell";
import { Card, LoadingBlock, ErrorState, Avatar } from "../../components/ui";
import { managementService } from "../../api/services/management.service";

export function MgmtStaff() {
  const [staff, { refetch }] = createResource(() => managementService.staffList());

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
      title="Kinerja Staf"
      sub="Berdasarkan evaluasi percakapan AI"
    >
      <Show when={!staff.loading} fallback={<LoadingBlock />}>
        <Show when={staff()} fallback={<ErrorState onRetry={() => void refetch()} />}>
          {(list) => (
            <>
              <Card pad={false}>
                <div class="table-wrap" style="border:none; border-radius:0; box-shadow:none">
                  <table class="tbl">
                    <thead>
                      <tr>
                        <th>Staf</th>
                        <th class="num">Melayani</th>
                        <th class="num">Selesai</th>
                        <th class="num">Diterima</th>
                        <th class="num">Ditolak</th>
                        <th class="num">Konversi</th>
                        <th class="num">Skor AI</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={list()}>
                        {(s) => (
                          <tr class="click">
                            <td>
                              <A class="staff-badge-row" href={`/management/staff/${s.staffId}`}>
                                <Avatar initials={s.initials} size={34} />
                                <div>
                                  <b>{s.name}</b>
                                  <div class="hint">{s.jobTitle}</div>
                                </div>
                              </A>
                            </td>
                            <td class="num">{s.served}</td>
                            <td class="num">{s.completed}</td>
                            <td class="num">{s.accepted}</td>
                            <td class="num">{s.rejected}</td>
                            <td class="num">{Math.round(s.conversionRate)}%</td>
                            <td class="num" style={`color:${s.avgOverallScore >= 80 ? "var(--success)" : "var(--warn)"}; font-weight:800`}>
                              {s.avgOverallScore || "—"}
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Card>
              <p class="hint" style="margin-top:12px">
                Skor AI dihitung dari transkripsi percakapan: salam pembuka, kejelasan penjelasan harga, profesionalisme, keterlibatan pelanggan, dan kepatuhan prosedur.
              </p>
            </>
          )}
        </Show>
      </Show>
    </Shell>
  );
}
