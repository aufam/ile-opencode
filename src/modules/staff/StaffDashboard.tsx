import { For, Show, createResource, createSignal, onCleanup, Switch, Match } from "solid-js";
import { useAuth } from "../../stores/auth";
import { Shell } from "../../components/shell";
import { Button, Card, EmptyState, ErrorState, LoadingBlock, StatCard, StatusBadge } from "../../components/ui";
import { transactionsService } from "../../api/services/transactions.service";
import { realtime } from "../../api/ws";
import { money, relative } from "../../lib/format";
import { A } from "@solidjs/router";

export function StaffDashboard() {
  const auth = useAuth();
  const [tab, setTab] = createSignal<"active" | "all">("active");

  const [data, { refetch }] = createResource(
    () => ({ branchId: auth.user()?.branchId, tab: tab() }),
    (q: { branchId?: string; tab: "active" | "all" }) =>
      transactionsService.list({
        branchId: q.branchId,
        activeOnly: q.tab === "active" ? true : undefined,
      })
  );

  const cleanUp = realtime.subscribe({
    onEvent: (ev) => {
      if (ev.type === "transaction.created" || ev.type === "transaction.updated") refetch();
    },
  });
  onCleanup(cleanUp);

  const txList = () => (data() ?? []) as Awaited<ReturnType<typeof transactionsService.list>>;
  const activeTx = () => txList().filter((t) => !["completed", "cancelled", "rejected"].includes(t.status));
  const offerSum = () => activeTx().reduce((a, t) => a + t.items.reduce((s, it) => s + (it.quote?.total ?? 0), 0), 0);

  return (
    <Shell
      role="staff"
      nav={[
        { path: "/staff", label: "Antrian Transaksi", icon: "🗂️" },
        { path: "/staff/new", label: "Transaksi Baru", icon: "➕" },
      ]}
      title="Antrian Transaksi"
      sub={auth.user()?.name ?? ""}
    >
      <div class="grid stats-4" style="margin-bottom:18px">
        <StatCard label="Transaksi Aktif" value={String(activeTx().length)} sub="Mayoritas di cabang Anda" />
        <StatCard label="Nilai Tawaran Aktif" value={money(offerSum())} gold sub="Belum final sampai disetujui" />
        <StatCard label="Nama Anda" value={auth.user()?.initials ?? "?"} sub={auth.user()?.jobTitle ?? ""} />
        <div class="stat-card gold" style="justify-content:center; align-items:center; gap:8px">
          <span class="k" style="align-self:flex-start">Mulai sekarang</span>
          <A class="btn gold lg" href="/staff/new" style="width:100%">
            ➕ Transaksi Baru
          </A>
        </div>
      </div>

      <Card
        pad={false}
        title="Daftar Transaksi"
        actions={
          <div style="display:flex; gap:6px">
            <Button tone={tab() === "active" ? "primary" : "ghost"} onClick={() => setTab("active")}>
              Aktif
            </Button>
            <Button tone={tab() === "all" ? "primary" : "ghost"} onClick={() => setTab("all")}>
              Semua
            </Button>
          </div>
        }
      >
        <Switch>
          <Match when={data.loading}>
            <LoadingBlock />
          </Match>
          <Match when={data.error}>
            <ErrorState message={data.error instanceof Error ? data.error.message : undefined} onRetry={() => refetch()} />
          </Match>
          <Match when={txList().length === 0}>
            <EmptyState icon="🪙" title="Belum ada transaksi" hint="Pelanggan telah datang. Buat transaksi baru untuk memulai alur penilaian.">
              <div style="margin-top: 12px">
                <A class="btn" href="/staff/new">
                  Buat transaksi
                </A>
              </div>
            </EmptyState>
          </Match>
          <Match when={true}>
            <div class="card-body">
              <div class="queue-list">
                <For each={txList()}>
                  {(t) => (
                    <A class="tx-card" href={`/staff/transactions/${t.id}`}>
                      <div style="min-width:0; flex:1">
                        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
                          <span class="code">{t.code}</span>
                          <StatusBadge status={t.status} />
                        </div>
                        <div class="who" style="margin-top:3px">
                          {t.customer.name} · {t.items.length} perhiasan · {relative(t.createdAt)}
                        </div>
                      </div>
                      <div>
                        <div class="amt num">{money(t.items.reduce((s, it) => s + (it.quote?.total ?? 0), 0))}</div>
                        <div class="device-hint">{t.lastDevice ?? `Counter ${t.counterId}`}</div>
                      </div>
                    </A>
                  )}
                </For>
              </div>
              <p class="hint" style="margin-top:12px">
                Tip: buka kode transaksi yang sama di iPad maupun iPhone — data langsung tersinkron.
              </p>
            </div>
          </Match>
        </Switch>
      </Card>
    </Shell>
  );
}
