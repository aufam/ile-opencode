import type {
  Appraisal,
  GoldPrices,
  JewelryItem,
  JewelryType,
  Karat,
  Quote,
  QuoteLine,
  StaffEvaluation,
  TranscriptSegment,
  Transaction,
} from "../../lib/types";
import { uuid } from "../../lib/id";

export const KARATS: Karat[] = [24, 22, 18, 14];

export function effectivePerGram(prices: GoldPrices, karat: Karat): number {
  return Math.round(prices[24] * (karat / 24));
}

export function computeQuote(
  appraisal: Appraisal,
  type: JewelryType,
  prices: GoldPrices,
  priceListId: string
): Quote {
  const karat = appraisal.karat;
  const price24 = prices[24];
  const eff = effectivePerGram(prices, karat);
  const base = appraisal.weightG * eff;
  const breakdown: QuoteLine[] = [];

  breakdown.push({
    label: "Nilai Emas",
    detail: `${appraisal.weightG.toLocaleString("id-ID", { maximumFractionDigits: 2 })} g × ${karat}K (${eff.toLocaleString("id-ID")}/g)`,
    amount: Math.round(base),
    kind: "base",
  });

  let deductions = 0;

  const admin = base * 0.02;
  breakdown.push({
    label: "Biaya Administrasi",
    detail: "2% dari nilai emas",
    amount: -Math.round(admin),
    kind: "deduction",
  });
  deductions += admin;

  const smeltingPerG = 1000;
  const smelting = Math.min(appraisal.weightG * smeltingPerG, 25000);
  breakdown.push({
    label: "Biaya Peleburan",
    detail: `${smeltingPerG.toLocaleString("id-ID")}/g, maksimal 25.000`,
    amount: -Math.round(smelting),
    kind: "deduction",
  });
  deductions += smelting;

  if (type === "earrings" || type === "pendant") {
    const stone = base * 0.03;
    breakdown.push({
      label: "Pengurangan Batu",
      detail: "3% est. batu non-emas",
      amount: -Math.round(stone),
      kind: "deduction",
    });
    deductions += stone;
  }

  const total = Math.round((base - deductions) / 100) * 100;

  return {
    karat,
    goldPricePerGram24: price24,
    effectivePricePerGram: eff,
    breakdown,
    subtotal: Math.round(base),
    deductions: -Math.round(deductions),
    total,
    calculatedAt: new Date().toISOString(),
    priceListId,
  };
}

function hashScore(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const span = max - min + 1;
  return min + (h % span);
}

const TOPIC_MAP: { key: StaffEvaluation["criteria"][number]["key"]; label: string }[] = [
  { key: "greeting", label: "Kualitas Salam Pembuka" },
  { key: "clarity", label: "Kejelasan Penjelasan Harga" },
  { key: "professionalism", label: "Profesionalisme" },
  { key: "engagement", label: "Keterlibatan Pelanggan" },
  { key: "compliance", label: "Kepatuhan Prosedur" },
];

export function createEvaluation(
  staffId: string,
  staffName: string,
  transaction: Transaction,
  segments: TranscriptSegment[]
): StaffEvaluation {
  const text = segments.map((s) => s.text.toLowerCase()).join(" ");
  const greeted = /selamat|pagi|siang|malam|halo/.test(text);
  const explained = /harga|gram|karat|murni|potongan|biaya|penawaran/.test(text);
  const offeredChoice = /mungkin|mau|boleh|silakan|pikir|pilih/.test(text);
  const closedPolitely = /terima kasih|kesempatan|kembali lagi/.test(text);

  const base = segments.length >= 4 ? 78 : segments.length >= 2 ? 72 : 66;

  const scores = {
    greeting: base + (greeted ? hashScore(transaction.id + "g", 9, 18) : -8),
    clarity: base + (explained ? hashScore(transaction.id + "c", 7, 21) - 2 : -6),
    professionalism: base + hashScore(transaction.id + "p", 4, 16),
    engagement: base + (offeredChoice ? hashScore(transaction.id + "e", 6, 17) : -4),
    compliance: base + (closedPolitely ? hashScore(transaction.id + "x", 7, 22) - 5 : -3),
  };

  const criteria = TOPIC_MAP.map((t) => ({
    key: t.key,
    label: t.label,
    score: Math.max(48, Math.min(98, Math.round(scores[t.key]))),
  }));

  const strengths: string[] = [];
  const improvements: string[] = [];
  if (greeted) strengths.push("Salam pembuka disampaikan dengan ramah dan tepat.");
  else improvements.push("Awali percakapan dengan menyapa pelanggan secara langsung.");
  if (explained) strengths.push("Rincian harga dan potongan dijelaskan dengan bahasa sederhana.");
  else improvements.push("Jelaskan dasar pembentukan harga kepada pelanggan sebelum menawar.");
  if (offeredChoice) strengths.push("Pelanggan diberi ruang untuk mempertimbangkan tawaran.");
  else improvements.push("Berikan jeda atau tawaran bagi pelanggan untuk bertanya.");
  if (closedPolitely) strengths.push("Percakapan ditutup dengan sopan dan mengundang kunjungan kembali.");
  else improvements.push("Akhiri percakapan dengan ucapan terima kasih.");

  if (strengths.length === 0) strengths.push("Percakapan berjalan singkat dan fokus pada prosedur.");
  if (improvements.length === 0) improvements.push("Pertahankan kualitas komunikasi pada transaksi berikutnya.");

  const overall = Math.round(criteria.reduce((a, c) => a + c.score, 0) / criteria.length);

  return {
    id: `ev-${uuid()}`,
    staffId,
    transactionId: transaction.id,
    overallScore: overall,
    criteria,
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 3),
    segmentsCount: segments.length,
    summaryText: `Penilaian percakapan untuk ${staffName} pada transaksi ${transaction.code} berdasarkan ${segments.length} segmen transkripsi.`,
    createdAt: new Date().toISOString(),
  };
}

export function itemReadyForQuote(item: JewelryItem): boolean {
  return Boolean(item.appraisal && item.appraisal.weightG > 0 && item.appraisal.karat);
}
