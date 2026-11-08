import type {
  Branch,
  GoldPrices,
  JewelryType,
  StaffEvaluation,
  Transaction,
  User,
} from "../../lib/types";
import { uuid } from "../../lib/id";
import { computeQuote, createEvaluation } from "./engine";
import type {
  ActivePriceList,
  MockDb,
  PriceHistoryEntry,
  TranscriptRecord
} from "./db-types";
import { PUBLIC_LINK_TTL_MINUTES } from "./db-types";

const BRANCHES: Branch[] = [
  {
    id: "br-jkt-sudirman",
    code: "JKT-SUD",
    name: "Jakarta Sudirman",
    city: "Jakarta Pusat",
    address: "Jl. Jend. Sudirman Kav. 21, RT 09/RW 02",
    phone: "021-753-2911",
    counters: [
      { id: "cnt-jkt-sud-1", name: "Counter 1", device: "iPad" },
      { id: "cnt-jkt-sud-2", name: "Counter 2", device: "iPad" },
      { id: "cnt-jkt-sud-3", name: "Counter 3", device: "iPad" },
    ],
  },
  {
    id: "br-jkt-kemang",
    code: "JKT-KMG",
    name: "Jakarta Kemang",
    city: "Jakarta Selatan",
    address: "Jl. Kemang Raya No. 45, Bangka Mampang",
    phone: "021-719-3380",
    counters: [
      { id: "cnt-jkt-kmg-1", name: "Counter 1", device: "iPad" },
      { id: "cnt-jkt-kmg-2", name: "Counter 2", device: "iPad" },
    ],
  },
  {
    id: "br-bdg-dago",
    code: "BDG-DGO",
    name: "Bandung Dago",
    city: "Bandung",
    address: "Jl. Ir. H. Juanda No. 88, Dago",
    phone: "022-250-1180",
    counters: [
      { id: "cnt-bdg-dgo-1", name: "Counter 1", device: "iPad" },
      { id: "cnt-bdg-dgo-2", name: "Counter 2", device: "iPad" },
    ],
  },
  {
    id: "br-sby-tunjungan",
    code: "SBY-TNJ",
    name: "Surabaya Tunjungan",
    city: "Surabaya",
    address: "Jl. Tunjungan No. 23, Kedungdoro",
    phone: "031-535-2201",
    counters: [
      { id: "cnt-sby-tnj-1", name: "Counter 1", device: "iPad" },
      { id: "cnt-sby-tnj-2", name: "Counter 2", device: "iPad" },
    ],
  },
  {
    id: "br-yog-malioboro",
    code: "YOG-MLB",
    name: "Yogyakarta Malioboro",
    city: "Yogyakarta",
    address: "Jl. Malioboro No. 20, Sosromenduran",
    phone: "0274-560-288",
    counters: [
      { id: "cnt-yog-mlb-1", name: "Counter 1", device: "iPad" },
      { id: "cnt-yog-mlb-2", name: "Counter 2", device: "iPad" },
    ],
  },
  {
    id: "br-mdn-petisah",
    code: "MDN-PTS",
    name: "Medan Petisah",
    city: "Medan",
    address: "Jl. Petisah Hulu No. 12, Petisah Hulu",
    phone: "061-452-7700",
    counters: [{ id: "cnt-mdn-pts-1", name: "Counter 1", device: "iPad" }],
  },
];

interface SeedUser {
  id: string;
  name: string;
  username: string;
  role: "staff" | "management";
  branchId?: string;
  counterId?: string;
  jobTitle: string;
}

const USERS: SeedUser[] = [
  { id: "u-mgr-1", name: "Bayu Hartono", username: "manager", role: "management", jobTitle: "General Manager" },
  { id: "u-mgr-2", name: "Citra Larasati", username: "citra", role: "management", jobTitle: "Head of Network" },
  { id: "u-st-01", name: "Rani Wijaya", username: "rani", role: "staff", branchId: "br-jkt-sudirman", counterId: "cnt-jkt-sud-2", jobTitle: "Kasir Senior" },
  { id: "u-st-02", name: "Dimas Prakoso", username: "dimas", role: "staff", branchId: "br-jkt-sudirman", counterId: "cnt-jkt-sud-1", jobTitle: "Kasir" },
  { id: "u-st-03", name: "Ayu Lestari", username: "ayu", role: "staff", branchId: "br-jkt-sudirman", counterId: "cnt-jkt-sud-3", jobTitle: "Kasir" },
  { id: "u-st-04", name: "Fajar Nugraha", username: "fajar", role: "staff", branchId: "br-jkt-kemang", counterId: "cnt-jkt-kmg-1", jobTitle: "Kasir Senior" },
  { id: "u-st-05", name: "Sinta Maharani", username: "sinta", role: "staff", branchId: "br-jkt-kemang", counterId: "cnt-jkt-kmg-2", jobTitle: "Kasir" },
  { id: "u-st-06", name: "Budi Santoso", username: "budi", role: "staff", branchId: "br-bdg-dago", counterId: "cnt-bdg-dgo-1", jobTitle: "Kasir Senior" },
  { id: "u-st-07", name: "Nadia Puspita", username: "nadia", role: "staff", branchId: "br-bdg-dago", counterId: "cnt-bdg-dgo-2", jobTitle: "Kasir" },
  { id: "u-st-08", name: "Agus Setyawan", username: "agus", role: "staff", branchId: "br-sby-tunjungan", counterId: "cnt-sby-tnj-1", jobTitle: "Kasir Senior" },
  { id: "u-st-09", name: "Wulan Safitri", username: "wulan", role: "staff", branchId: "br-sby-tunjungan", counterId: "cnt-sby-tnj-2", jobTitle: "Kasir" },
  { id: "u-st-10", name: "Reza Aditya", username: "reza", role: "staff", branchId: "br-yog-malioboro", counterId: "cnt-yog-mlb-1", jobTitle: "Kasir" },
  { id: "u-st-11", name: "Maya Anggraini", username: "maya", role: "staff", branchId: "br-mdn-petisah", counterId: "cnt-mdn-pts-1", jobTitle: "Kasir" },
];

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
}

function toUser(u: SeedUser): User & { password: string } {
  return {
    id: u.id,
    code: u.id.toUpperCase(),
    name: u.name,
    username: u.username,
    role: u.role,
    branchId: u.branchId,
    counterId: u.counterId,
    email: `${u.username}@aurum.co.id`,
    initials: initials(u.name),
    jobTitle: u.jobTitle,
    password: "demo123",
  };
}

function svgPhoto(glyph: string, bg: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f7ead0'/><stop offset='1' stop-color='${bg}'/></linearGradient></defs><rect width='360' height='360' fill='#0e2340'/><rect x='28' y='28' width='304' height='304' rx='46' fill='url(%23g)'/><text x='180' y='218' font-size='150' text-anchor='middle'>${glyph}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/%23/g, "#"))}`;
}

const TYPE_GLYPHS: Record<JewelryType, [string, string]> = {
  ring: ["💍", "#c9a227"],
  necklace: ["📿", "#b9a23c"],
  bracelet: ["🧿", "#3e92cc"],
  pendant: ["⭐", "#d4af37"],
  earrings: ["✨", "#8fb8d8"],
  chain: ["⛓️", "#8899a6"],
  other: ["🔷", "#2f7fb8"],
};

function typesPhoto(type: JewelryType): string {
  const [g, c] = TYPE_GLYPHS[type];
  return svgPhoto(g, c);
}

const CUSTOMERS = [
  { name: "Ibu Harwati Sari", phone: "+62 812-9901-2280", idType: "ktp" as const, idNumber: "3174056709910002" },
  { name: "Pak Hadiyunarto", phone: "+62 813-2245-6781", idType: "ktp" as const, idNumber: "3273012209821007" },
  { name: "Ibu Siti Rahmawati", phone: "+62 856-1200-8811", idType: "ktp" as const, idNumber: "3578014409870011" },
  { name: "Pak Ahmad Furqon", phone: "+62 811-3390-0455", idType: "sim" as const, idNumber: "S-0942-1184" },
  { name: "Ibu Endang Wuryani", phone: "+62 878-8899-1201", idType: "ktp" as const, idNumber: "3471011106830009" },
  { name: "Pak Robert Sari", phone: "+62 821-7712-3366", idType: "passport" as const, idNumber: "H-2210-887" },
  { name: "Ibu Lisna Irfani", phone: "+62 852-9901-4419", idType: "ktp" as const, idNumber: "3175035509880004" },
  { name: "Pak Sunarto Gendi", phone: "+62 815-7702-5310", idType: "ktp" as const, idNumber: "3374012208790005" },
  { name: "Ibu Kartika Dewi", phone: "+62 819-2210-0933", idType: "ktp" as const, idNumber: "3275015509940006" },
  { name: "Pak Yusuf Bin Talib", phone: "+62 813-9988-0077", idType: "ktp" as const, idNumber: "3178044509850003" },
];

interface SeedTx {
  staffIdx: number;
  customerIdx: number;
  daysAgo: number;
  hour: number;
  minute: number;
  status: Transaction["status"];
  items: {
    description: string;
    type: JewelryType;
    photo?: string;
    weightG?: number;
    karat?: 24 | 22 | 18 | 14;
    status?: "registered" | "appraising" | "appraised";
    appraised?: boolean;
  }[];
  withPayment?: boolean;
  withLink?: boolean;
  acceptedDecision?: boolean;
  lastDevice?: string;
}

const SEED_TXS: SeedTx[] = [
  {
    staffIdx: 0, customerIdx: 0, daysAgo: 0, hour: 9, minute: 40, status: "awaiting_decision",
    items: [
      { description: "Cincin emas kuning lengkung polos", type: "ring", weightG: 7.31, karat: 22, status: "appraised", appraised: true, photo: typesPhoto("ring") },
      { description: "Gelang rantai emas 23 cm", type: "bracelet", weightG: 12.4, karat: 24, status: "appraised", appraised: true, photo: typesPhoto("bracelet") },
    ],
    withLink: true, lastDevice: "iPad · Counter 2",
  },
  {
    staffIdx: 1, customerIdx: 1, daysAgo: 0, hour: 10, minute: 5, status: "in_appraisal",
    items: [
      { description: "Kalung emas putih 45 cm", type: "necklace", weightG: 18.9, karat: 18, status: "appraised", appraised: true, photo: typesPhoto("necklace") },
      { description: "Anting emas pemberat", type: "earrings", weightG: 4.02, karat: 18, status: "registered" },
    ],
    lastDevice: "iPhone · Backroom",
  },
  {
    staffIdx: 0, customerIdx: 2, daysAgo: 0, hour: 10, minute: 48, status: "completed",
    items: [
      { description: "Liontin huruf initials emas 2,2 cm", type: "pendant", weightG: 2.87, karat: 24, status: "appraised", appraised: true, photo: typesPhoto("pendant") },
    ],
    withPayment: true, acceptedDecision: true,
  },
  {
    staffIdx: 3, customerIdx: 3, daysAgo: 0, hour: 11, minute: 22, status: "accepted",
    items: [
      { description: "Gelang emas 8 mm keliling 16,5 cm", type: "bracelet", weightG: 22.15, karat: 24, status: "appraised", appraised: true, photo: typesPhoto("bracelet") },
    ],
  },
  {
    staffIdx: 4, customerIdx: 4, daysAgo: 1, hour: 10, minute: 15, status: "completed",
    items: [
      { description: "Rantai emas kuning 50 cm klasp kunci", type: "chain", weightG: 15.63, karat: 22, status: "appraised", appraised: true, photo: typesPhoto("chain") },
      { description: "Cincin emas mystic 60 mm", type: "ring", weightG: 4.51, karat: 18, status: "appraised", appraised: true, photo: typesPhoto("ring") },
    ],
    withPayment: true, acceptedDecision: true,
  },
  {
    staffIdx: 5, customerIdx: 5, daysAgo: 1, hour: 13, minute: 30, status: "completed",
    items: [
      { description: "Perhiasan gelang anting satu set emas putih", type: "earrings", weightG: 11.9, karat: 18, status: "appraised", appraised: true, photo: typesPhoto("earrings") },
    ],
    withPayment: true, acceptedDecision: true,
  },
  {
    staffIdx: 6, customerIdx: 6, daysAgo: 2, hour: 9, minute: 20, status: "rejected",
    items: [
      { description: "Liontin batu cubic emas 5 mm", type: "pendant", weightG: 1.44, karat: 22, status: "appraised", appraised: true, photo: typesPhoto("pendant") },
    ],
    acceptedDecision: false,
  },
  {
    staffIdx: 7, customerIdx: 7, daysAgo: 2, hour: 14, minute: 10, status: "completed",
    items: [
      { description: "Kalung emas pemberat segment 40 cm", type: "necklace", weightG: 27.5, karat: 24, status: "appraised", appraised: true, photo: typesPhoto("necklace") },
    ],
    withPayment: true, acceptedDecision: true,
  },
  {
    staffIdx: 8, customerIdx: 8, daysAgo: 3, hour: 11, minute: 5, status: "completed",
    items: [
      { description: "Cincin emas mystic 54 mm fintas", type: "ring", weightG: 6.02, karat: 22, status: "appraised", appraised: true, photo: typesPhoto("ring") },
    ],
    withPayment: true, acceptedDecision: true,
  },
  {
    staffIdx: 9, customerIdx: 9, daysAgo: 4, hour: 15, minute: 40, status: "completed",
    items: [
      { description: "Benang rantai emas tanpa klap", type: "chain", weightG: 9.87, karat: 18, status: "appraised", appraised: true, photo: typesPhoto("chain") },
    ],
    withPayment: true, acceptedDecision: true,
  },
  {
    staffIdx: 10, customerIdx: 0, daysAgo: 5, hour: 9, minute: 55, status: "cancelled",
    items: [{ description: "Gelang emas putus 17 cm", type: "bracelet", weightG: 8.4, karat: 24, status: "registered" }],
  },
  {
    staffIdx: 2, customerIdx: 1, daysAgo: 5, hour: 16, minute: 5, status: "draft",
    items: [{ description: "Perhiasan gelang emas 16,5 cm", type: "bracelet", status: "registered" }],
  },
  {
    staffIdx: 3, customerIdx: 5, daysAgo: 6, hour: 10, minute: 50, status: "completed",
    items: [
      { description: "Anting emas box 2,5 cm", type: "earrings", weightG: 5.6, karat: 24, status: "appraised", appraised: true, photo: typesPhoto("earrings") },
    ],
    withPayment: true, acceptedDecision: true,
  },
  {
    staffIdx: 0, customerIdx: 7, daysAgo: 6, hour: 14, minute: 25, status: "completed",
    items: [
      { description: "Cincin emas mystic 65 mm", type: "ring", weightG: 9.4, karat: 22, status: "appraised", appraised: true, photo: typesPhoto("ring") },
      { description: "Liontin strike emas 3,1 cm", type: "pendant", weightG: 3.8, karat: 18, status: "appraised", appraised: true, photo: typesPhoto("pendant") },
    ],
    withPayment: true, acceptedDecision: true,
  },
];

const SAMPLE_TRANSCRIPTS: Record<string, string[]> = {
  greeting: ["Selamat pagi Ibu, selamat datang di AURUM emas murni.", "Pagi Mas, saya mau tanya tukang emas murni milik ibu ini.", "Silakan Ibu, boleh ibu bawa perhiasannya kesini ya.", "Iya Mas dua perhiasan anak gelang dan cincin.", "Baik, sebelum mulai boleh saya catat nama ibu dulu ya."],
  detail: ["Berat cincin 7,3..., 12,4 gram emas bagus emasnya Rani 22K bagusnya.", "Iya kenapa potongan harganya lumayan besar?", "Potongan ada biaya peleburan dan administrasi bbrp persen Mas.", "Kemudian cara hitung harga muat pakai hari ini harga emas per gram.", "Kalau nanti belum puas boleh dia pikir dulu kesempatan kapan lagi mau lepas."],
};

export function buildSeed(): MockDb {
  const now = new Date();
  const users = USERS.map(toUser);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayIso = today.toISOString();

  const prices: ActivePriceList = {
    id: `pl-${todayIso.slice(0, 10)}`,
    effectiveDate: todayIso,
    prices: { 24: 1348000, 22: 1247000, 18: 1011000, 14: 780000 } as GoldPrices,
    changedBy: "Bayu Hartono",
    changedAt: todayIso,
    note: "Harga mengikuti emas sehari institusi pagi.",
  };

  const history: PriceHistoryEntry[] = [];
  const priceHistorySeeds: [number, string][] = [
    [-1, "Penyesuaian harga harian pagi."],
    [-2, "Penyesuaian mengikuti emas sehari TFBM."],
    [-3, "Koreksi kecil harga 24 karat."],
  ];
  for (const [off, note] of priceHistorySeeds) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + off);
    const dayIso = d.toISOString();
    const factor = 1 + off * -0.007;
    history.push({
      id: `pl-${dayIso.slice(0, 10)}`,
      listId: `pl-${dayIso.slice(0, 10)}`,
      effectiveDate: dayIso,
      prices: {
        24: Math.round((1348000 * factor) / 500) * 500,
        22: Math.round((1247000 * factor) / 500) * 500,
        18: Math.round((1011000 * factor) / 500) * 500,
        14: Math.round((780000 * factor) / 500) * 500,
      } as GoldPrices,
      changedBy: off === -2 ? "Citra Larasati" : "Bayu Hartono",
      changedAt: dayIso,
      note,
      replacedAt: dayIso,
    });
  }

  const transactions: Transaction[] = [];
  const evaluations: StaffEvaluation[] = [];
  const transcriptions: Record<string, TranscriptRecord[]> = {};

  for (let i = 0; i < SEED_TXS.length; i++) {
    const s = SEED_TXS[i];
    // SeedUSERS[0..1] are management accounts; staff accounts start at index 2,
    // so scenario staffIdx (0-based over staff users) must be shifted by 2.
    const staffDef = USERS[s.staffIdx + 2] ?? USERS[2];
    const staff = users.find((u) => u.id === staffDef.id)!;
    const customerBase = CUSTOMERS[s.customerIdx];
    const created = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - s.daysAgo,
      s.hour,
      s.minute
    );
    const createdAt = created.toISOString();

    const items = s.items.map((it, j) => {
      const item: Transaction["items"][number] = {
        id: `itm-${i}-${j}`,
        sessionId: `S${j + 1}`,
        description: it.description,
        type: it.type,
        photo: it.photo,
        status: it.status ?? "registered",
        createdAt,
      };
      if (it.appraised && it.weightG && it.karat) {
        item.appraisal = {
          weightG: it.weightG,
          karat: it.karat,
          measuredPurity: it.karat === 24 ? 93.5 : it.karat === 22 ? 83.2 : it.karat === 18 ? 68.4 : 52.1,
          scaleXrfNote: "Terukur pada timbangan digital 0,01 g & XRF Brucker di ruang analisis.",
          scalePhoto: svgPhoto("⚖️", "#9fc3e0"),
          xrfPhoto: svgPhoto("🔬", "#dcbf83"),
          notes: "Kondisi perhiasan baik, tidak ada retak memanjang.",
          appraisedAt: createdAt,
        };
        item.quote = computeQuote(item.appraisal, it.type, prices.prices, prices.id);
      }
      return item;
    });

    const total = items.reduce((a, it) => a + (it.quote?.total ?? 0), 0);
    const updatedAt = createdAt;

    const tx: Transaction = {
      id: `txn-${1000 + i}`,
      code: `AUM-${createdAt.slice(0, 10).replace(/-/g, "")}-${String(101 + i).padStart(3, "0")}`,
      branchId: staff.branchId ?? "br-jkt-sudirman",
      counterId: staff.counterId ?? "cnt-jkt-sud-1",
      staffId: staff.id,
      customer: { ...customerBase },
      status: s.status,
      createdAt,
      updatedAt,
      statusChangedAt: updatedAt,
      items,
      history: [
        {
          id: `h-${i}-1`,
          at: createdAt,
          actor: staff.name,
          label: "Transaksi dibuat",
          detail: "Pelanggan datang ke counter dan transaksi dibuat.",
        },
      ],
      lastDevice: s.lastDevice,
    };

    if (s.acceptedDecision !== undefined) {
      const decidedAt = new Date(created.getTime() + 45 * 60000).toISOString();
      tx.decision = { accepted: s.acceptedDecision, decidedAt };
      tx.history.push({
        id: `h-${i}-2`,
        at: decidedAt,
        actor: staff.name,
        label: s.acceptedDecision ? "Penawaran diterima" : "Penawaran ditolak",
      });
    }

    if (s.withPayment) {
      const paidAt = new Date(created.getTime() + 55 * 60000).toISOString();
      tx.payment = {
        method: i % 3 === 0 ? "transfer" : i % 3 === 1 ? "ewallet" : "cash",
        amount: total,
        reference: `PAY-${paidAt.slice(0, 10).replace(/-/g, "")}-${1100 + i}`,
        receiptPhoto: svgPhoto("🧾", "#b6cede"),
        paidAt,
        confirmedAt: paidAt,
      };
      tx.status = "completed";
      tx.history.push({ id: `h-${i}-3`, at: paidAt, actor: staff.name, label: "Pembayaran dikonfirmasi", detail: `${tx.payment.method} • ${tx.payment.reference}` });
      tx.statusChangedAt = paidAt;
    }

    if (s.withLink) {
      tx.publicLink = {
        token: `pub-${uuid().slice(0, 12)}`,
        path: `/public/review/pub-${uuid().slice(0, 12)}`,
        expiresAt: new Date(now.getTime() + (PUBLIC_LINK_TTL_MINUTES - 200) * 60000).toISOString(),
        ttlMinutes: PUBLIC_LINK_TTL_MINUTES,
        createdAt: now.toISOString(),
      };
      tx.publicLink.path = `/public/review/${tx.publicLink.token}`;
    }

    const segs: TranscriptRecord[] = [];
    const textPool = SAMPLE_TRANSCRIPTS.greeting.concat(SAMPLE_TRANSCRIPTS.detail);
    for (let k = 0; k < 6; k++) {
      segs.push({
        id: `seg-${i}-${k}`,
        transactionId: tx.id,
        text: textPool[k % textPool.length],
        startedAt: new Date(created.getTime() + (k * 40 + 10) * 60000).toISOString(),
        durationMs: 7000 + ((k * 3650) % 9000),
        confidence: 0.88 + ((k * 7) % 10) / 100,
        speakerHint: k % 3 === 1 ? "customer" : "staff",
        deviceId: `iPad ${(tx.branchId ?? "br").replace("br-", "").toUpperCase()}`,
      });
    }
    transcriptions[tx.id] = segs;

    if (s.status !== "draft" && s.status !== "cancelled") {
      const ev = createEvaluation(staff.id, staff.name, tx, transcriptions[tx.id]);
      ev.createdAt = createdAt;
      evaluations.push(ev);
    }

    transactions.push(tx);
  }

  return {
    users,
    branches: BRANCHES,
    prices,
    priceHistory: history,
    transactions,
    transcriptions,
    evaluations,
  };
}

export default buildSeed;
