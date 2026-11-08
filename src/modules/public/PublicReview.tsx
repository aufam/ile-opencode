import { useParams } from "@solidjs/router";
import { For, Show, createResource, createSignal, onCleanup, onMount } from "solid-js";
import { publicService } from "../../api/services/public.service";
import { LoadingBlock, EmptyState } from "../../components/ui";
import { money, gram, jewelryTypeLabel, dateTime, relative, timeHM } from "../../lib/format";

const TINTS = ["#3e92cc", "#c9a227", "#1f8f5f", "#b96a00", "#2f7fb8", "#8a63d2"];

export function PublicReview() {
  const params = useParams();
  const [snap] = createResource(
    () => params.token,
    (token) => publicService.getReview(token)
  );
  const [now, setNow] = createSignal(Date.now());

  let timer: number | null = null;
  onMount(() => {
    timer = window.setInterval(() => setNow(Date.now()), 1000);
  });
  onCleanup(() => {
    if (timer !== null) window.clearInterval(timer);
  });

  const expiresIn = () => {
    const exp = snap()?.expiresAt;
    if (!exp) return "";
    const ms = Math.max(0, new Date(exp).getTime() - now());
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return h > 23 ? dateTime(exp) : `${h}j ${m}m ${s}d`;
  };

  const expired = () => snap()?.expiresAt ? new Date(snap()!.expiresAt).getTime() < now() : false;

  return (
    <div class="public-page">
      <div class="public-wrap">
        <div class="public-head">
          <img src="/logo.png" alt="AURUM" />
          <b>AURUM</b>
        </div>

        <Show
          when={!snap.loading && !snap.error}
          fallback={
            <div class="pub-card">
              <Show when={snap.loading}>
                <LoadingBlock label="Memuat hasil penilaian…" />
              </Show>
              <Show when={snap.error}>
                <EmptyState
                  icon="⏰"
                  title="Tautan tidak aktif"
                  hint={snap.error instanceof Error ? snap.error.message : undefined}
                />
                <p class="pub-foot">
                  Meminta tautan baru? Hubungi staf di cabang — tautan dapat dibuat ulang dalam hitungan detik.
                </p>
              </Show>
            </div>
          }
        >
          <Show when={snap()}>
            {(s) => (
              <>
                <div class="pub-card pub-hero">
                  <div class="hi">Halo! Berikut hasil penilaian perhiasan Anda di {s().branch}</div>
                  <div class="code">{s().code}</div>
                  <div class="pub-timer">
                    ⏳ {expired() ? "Tautan sudah kedaluwarsa" : `Tautan aktif ${expiresIn()} lagi`}
                  </div>
                </div>

                <For each={s().items}>
                  {(it, i) => (
                    <div class="pub-card">
                      <div class="pub-item">
                        <div
                          class="pub-thumb"
                          style={it.photo ? `background-image:url(${it.photo})` : `background:linear-gradient(135deg, ${TINTS[i() % TINTS.length]}22, ${TINTS[i() % TINTS.length]}44)`}
                        >
                          <Show when={!it.photo}>💎</Show>
                        </div>
                        <div style="flex:1; min-width:0">
                          <b style="font-size:15px">{it.description}</b>
                          <div class="hint">{jewelryTypeLabel(it.type)} · Sesi {i() + 1}</div>
                          <div class="divider" />
                          <div class="kv">
                            <span class="k">Berat</span>
                            <span class="v num">{gram(it.weightG)}</span>
                          </div>
                          <div class="kv">
                            <span class="k">Kemurnian</span>
                            <span class="v num">{it.karat ? `${it.karat}K` : "—"}</span>
                          </div>
                          <Show when={it.quote}>
                            <For each={it.quote!.breakdown}>
                              {(line) => (
                                <div class="kv">
                                  <span class="k">{line.label}{line.detail && <span class="hint" style="margin-left:4px">{line.detail}</span>}</span>
                                  <span class="v num" style={line.kind === "deduction" ? "color:var(--danger)" : ""}>
                                    {line.kind === "deduction" ? "−" : ""}
                                    {money(Math.abs(line.amount))}
                                  </span>
                                </div>
                              )}
                            </For>
                            <div class="kv">
                              <span class="k" style="font-weight:700">Tawaran butir ini</span>
                              <span class="v num" style="color:var(--blue-700)">{money(it.quote!.total)}</span>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </div>
                  )}
                </For>

                <div class="pub-total">
                  <div class="lbl">Total Tawaran Keseluruhan</div>
                  <div class="amt num">{money(s().offeredTotal)}</div>
                  <div class="note">
                    {s().acceptHint}
                    <br />
                    Diperbarui {relative(s().reviewedAt)} · harga emas hari ini {money(s().goldPrices[24])}/g
                  </div>
                </div>

                <p class="pub-foot">
                  Halaman ini hanya-baca dan tanpa perlu masuk akun. Tautan otomatis kedaluwarsa pada
                  {" "}
                  <b>{timeHM(s().expiresAt)}</b>
                  {" "}
                  {dateTime(s().expiresAt)}. Sempat keraguan? Hubungi staf kami di {s().branch}.
                </p>
              </>
            )}
          </Show>
        </Show>
      </div>
    </div>
  );
}
