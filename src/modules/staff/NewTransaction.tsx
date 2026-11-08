import { createResource, For, Show, createEffect, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../../stores/auth";
import { Shell } from "../../components/shell";
import { Button, Card, Field, LoadingBlock } from "../../components/ui";
import { branchesService } from "../../api/services/branches.service";
import { transactionsService } from "../../api/services/transactions.service";
import { deviceLabel } from "../../stores/sync";
import { pushToast } from "../../stores/toast";
import type { Customer } from "../../lib/types";

export function NewTransaction() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [branches] = createResource(() => branchesService.list());

  const [branchId, setBranchId] = createSignal("");
  const [counterId, setCounterId] = createSignal("");
  const [name, setName] = createSignal("");
  const [phone, setPhone] = createSignal("");
  const [address, setAddress] = createSignal("");
  const [idType, setIdType] = createSignal<Customer["idType"]>("ktp");
  const [idNumber, setIdNumber] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");

  createEffect(() => {
    const list = branches();
    const user = auth.user();
    if (list && user && !branchId() && user.branchId) {
      setBranchId(user.branchId);
      setCounterId(user.counterId ?? "");
    }
  });

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const tx = await transactionsService.create({
        customer: {
          name: name().trim(),
          phone: phone().trim() || undefined,
          address: address().trim() || undefined,
          idType: idType(),
          idNumber: idNumber().trim() || undefined,
        },
        branchId: branchId(),
        counterId: counterId(),
      });
      await transactionsService.patch(tx.id, { lastDevice: deviceLabel() });
      pushToast(`Transaksi ${tx.code} dibuat.`, "success");
      navigate(`/staff/transactions/${tx.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat transaksi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      role="staff"
      nav={[
        { path: "/staff", label: "Antrian Transaksi", icon: "🗂️" },
        { path: "/staff/new", label: "Transaksi Baru", icon: "➕" },
      ]}
      title="Transaksi Baru"
      sub="Sapa pelanggan, lalu lengkapi data singkat"
    >
      <div class="new-tx-wrap">
        <Card title="Data Pelanggan">
          <Show when={error()}>
            <div class="form-error">{error()}</div>
          </Show>
          <form class="form-grid" onSubmit={submit}>
            <div class="field" style="grid-column: 1/-1">
              <span class="lbl">Nama Pelanggan *</span>
              <input class="input" required placeholder="cth. Ibu Harwati" value={name()} onInput={(e) => setName(e.currentTarget.value)} />
            </div>
            <Field label="Nomor Telepon">
              <input class="input" inputmode="tel" placeholder="+62…" value={phone()} onInput={(e) => setPhone(e.currentTarget.value)} />
            </Field>
            <Field label="Jenis ID">
              <select class="select" value={idType()} onChange={(e) => setIdType(e.currentTarget.value as Customer["idType"])}>
                <option value="ktp">KTP</option>
                <option value="sim">SIM</option>
                <option value="passport">Paspor</option>
                <option value="none">Tidak membawa</option>
              </select>
            </Field>
            <Field label="Nomor ID">
              <input class="input" value={idNumber()} onInput={(e) => setIdNumber(e.currentTarget.value)} />
            </Field>
            <Field label="Alamat (opsional)">
              <input class="input" value={address()} onInput={(e) => setAddress(e.currentTarget.value)} />
            </Field>
          </form>
        </Card>

        <Card title="Lokasi Layanan">
          <Show when={branches()} fallback={<LoadingBlock />}>
            {(list) => (
              <>
                <div class="form-grid">
                  <Field label="Cabang *">
                    <select
                      class="select"
                      value={branchId()}
                      onChange={(e) => {
                        setBranchId(e.currentTarget.value);
                        setCounterId("");
                      }}
                    >
                      <option value="" disabled>
                        Pilih cabang…
                      </option>
                      <For each={list()}>{(br) => <option value={br.id}>{br.name}</option>}</For>
                    </select>
                  </Field>
                  <Field label="Counter *">
                    <select class="select" value={counterId()} onChange={(e) => setCounterId(e.currentTarget.value)}>
                      <option value="" disabled>
                        Pilih counter…
                      </option>
                      <For each={list().find((x) => x.id === branchId())?.counters ?? []}>
                        {(c) => <option value={c.id}>{c.name}</option>}
                      </For>
                    </select>
                  </Field>
                </div>
                <div style="margin-top:16px; display:flex; gap:10px; justify-content:flex-end">
                  <Button tone="ghost" onClick={() => navigate("/staff")}>
                    Batal
                  </Button>
                  <Button tone="gold" disabled={busy() || !name() || !branchId() || !counterId()} onClick={(e) => void submit(e)}>
                    {busy() ? "Membuat…" : "Buat & Mulai Alur"}
                  </Button>
                </div>
              </>
            )}
          </Show>
          <Show when={busy()}>
            <LoadingBlock label="Menciptakan transaksi…" />
          </Show>
        </Card>
      </div>
    </Shell>
  );
}
