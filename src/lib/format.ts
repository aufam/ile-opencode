const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function money(n: number | undefined | null): string {
  return idr.format(Math.round(n ?? 0));
}

export function gram(n: number | undefined | null): string {
  return `${(n ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })} g`;
}

export function pct(n: number | undefined | null): string {
  return `${Math.round(n ?? 0)}%`;
}

const dtf = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", ...opts });

export function timeHM(iso?: string): string {
  if (!iso) return "—";
  return dtf({ hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function dateFull(iso?: string): string {
  if (!iso) return "—";
  return dtf({ day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function dateTime(iso?: string): string {
  if (!iso) return "—";
  return `${dateFull(iso)} · ${timeHM(iso)}`;
}

export function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.round(h / 24);
  return `${d} hari lalu`;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_appraisal: "Penilaian",
  awaiting_decision: "Menunggu Keputusan",
  accepted: "Diterima",
  rejected: "Ditolak",
  payment_processing: "Pembayaran",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}

export const JEWELRY_TYPE_LABELS: Record<string, string> = {
  ring: "Cincin",
  necklace: "Kalung",
  bracelet: "Gelang",
  pendant: "Liontin",
  earrings: "Anting",
  chain: "Rantai",
  other: "Lainnya",
};

export function jewelryTypeLabel(t: string): string {
  return JEWELRY_TYPE_LABELS[t] ?? t;
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
