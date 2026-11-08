import { For, Show, createResource, createSignal } from "solid-js";
import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { Shell } from "../../components/shell";
import { Card, LoadingBlock, ErrorState, StatusBadge, Field } from "../../components/ui";
import { transactionsService } from "../../api/services/transactions.service";
import { branchesService } from "../../api/services/branches.service";
import { managementService } from "../../api/services/management.service";
import { realtime } from "../../api/ws";
import { onCleanup } from "solid-js";
import { money, relative } from "../../lib/format";

function firstStr(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s : undefined;
}

export function MgmtTransactions() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [branches] = createResource(() => branchesService.list());
  const [staffList] = createResource(() => managementService.staffList());

  const [search, setSearch] = createSignal(typeof searchParams.q === "string" ? searchParams.q : "");

  const [rows, { refetch }] = createResource(
    () => ({
      branchId: searchParams.branch ?? "",
      staffId: searchParams.staff ?? "",
      status: searchParams.status ?? "",
      q: typeof searchParams.q === "string" ? searchParams.q : "",
      from: searchParams.from ?? "",
      to: searchParams.to ?? "",
    }),
    (q) =>
      transactionsService.list({
        branchId: firstStr(q.branchId),
        staffId: firstStr(q.staffId),
        status: firstStr(q.status),
        search: firstStr(q.q),
        from: firstStr(q.from),
        to: firstStr(q.to),
      })
  );

  const cleanUp = realtime.subscribe({
    onEvent: (ev) => {
      if (ev.type === "transaction.created" || ev.type === "transaction.updated") refetch();
    },
  });
  onCleanup(cleanUp);

  const setParam = (key: string, value: string) => {
    const next: Record<string, string> = { ...searchParams, [key]: value } as Record<string, string>;
    if (!value) delete next[key];
    setSearchParams(next);
  };

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
      title="Manajemen Transaksi"
      sub="Semua transaksi lintas cabang"
    >
      <Card pad={false}>
        <div class="filter-bar">
          <Field label="Cari">
            <input
              class="input"
              placeholder="Kode / nama / telepon pelanggan…"
              value={search()}
              onInput={(e) => {
                setSearch(e.currentTarget.value);
                setParam("q", e.currentTarget.value);
              }}
            />
          </Field>
          <Field label="Cabang">
            <select class="select" value={searchParams.branch ?? ""} onChange={(e) => setParam("branch", e.currentTarget.value)}>
              <option value="">Semua cabang</option>
              <For each={branches() ?? []}>{(b) => <option value={b.id}>{b.name}</option>}</For>
            </select>
          </Field>
          <Field label="Staf">
            <select class="select" value={searchParams.staff ?? ""} onChange={(e) => setParam("staff", e.currentTarget.value)}>
              <option value="">Semua staf</option>
              <For each={staffList() ?? []}>{(s) => <option value={s.staffId}>{s.name}</option>}</For>
            </select>
          </Field>
          <Field label="Status">
            <select class="select" value={searchParams.status ?? ""} onChange={(e) => setParam("status", e.currentTarget.value)}>
              <option value="">Semua status</option>
              <option value="draft">Draft</option>
              <option value="in_appraisal">Penilaian</option>
              <option value="awaiting_decision">Menunggu keputusan</option>
              <option value="accepted">Diterima</option>
              <option value="payment_processing">Pembayaran</option>
              <option value="completed">Selesai</option>
              <option value="rejected">Ditolak</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </Field>
          <Field label="Dari">
            <input
              type="date"
              class="input"
              value={searchParams.from ?? ""}
              onChange={(e) => setParam("from", e.currentTarget.value)}
            />
          </Field>
          <Field label="Sampai">
            <input
              type="date"
              class="input"
              value={searchParams.to ?? ""}
              onChange={(e) => setParam("to", e.currentTarget.value)}
            />
          </Field>
        </div>
        <div class="divider" style="margin:14px 20px 0" />
        <Show when={!rows.loading} fallback={<LoadingBlock />}>
          <Show when={rows()} fallback={<ErrorState onRetry={() => void refetch()} />}>
            {(list) => (
              <>
                <div class="table-wrap" style="border:none; border-radius:0; box-shadow:none">
                  <table class="tbl">
                    <thead>
                      <tr>
                        <th>Kode</th>
                        <th>Branch</th>
                        <th>Pelanggan</th>
                        <th>Butir</th>
                        <th>Status</th>
                        <th class="num">Tawaran</th>
                        <th class="num">Dibayar</th>
                        <th>Staf</th>
                        <th>Masuk</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={list()}>
                        {(t) => (
                          <tr
                            class="click"
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest("a")) return;
                              navigate(`/management/transactions/${t.id}`);
                            }}
                          >
                            <td>
                              <A href={`/management/transactions/${t.id}`}>{t.code}</A>
                            </td>
                            <td>{t.branchId.replace("br-", "").toUpperCase()}</td>
                            <td>
                              {t.customer.name}
                              <div class="hint">{t.customer.phone ?? ""}</div>
                            </td>
                            <td>{t.items.length}</td>
                            <td>
                              <StatusBadge status={t.status} />
                            </td>
                            <td class="num">{money(t.items.reduce((a, it) => a + (it.quote?.total ?? 0), 0))}</td>
                            <td class="num">{t.payment?.amount ? money(t.payment.amount) : "—"}</td>
                            <td>{(staffList() ?? []).find((s) => s.staffId === t.staffId)?.name ?? t.staffId}</td>
                            <td>{relative(t.createdAt)}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
                <Show when={list().length === 0}>
                  <div class="empty">
                    <h4>Tidak ada transaksi pada filter ini</h4>
                    <p>Ubah filter atau bersihkan pencarian.</p>
                  </div>
                </Show>
              </>
            )}
          </Show>
        </Show>
      </Card>
    </Shell>
  );
}
