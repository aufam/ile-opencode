import type {
  Appraisal,
  GoldPrices,
  JewelryItem,
  Karat,
  ManagementDashboard,
  PriceHistoryEntry,
  StaffDetailReport,
  StaffPerformanceSummary,
  Transaction,
  User,
} from "../../lib/types";
import { uuid, txnCode, randomToken } from "../../lib/id";
import { computeQuote, createEvaluation, itemReadyForQuote, KARATS, effectivePerGram } from "./engine";
import type { ActivePriceList, MockDb, MutationEvent, TranscriptRecord } from "./db-types";
import { PUBLIC_LINK_TTL_MINUTES } from "./db-types";
import { getDb, save, emit, newRequestId } from "./db";

type Body = unknown;

interface Ctx {
  method: string;
  path: string;
  query: URLSearchParams;
  body: Body;
  token: string | null;
}

interface MockResponse {
  status: number;
  data: unknown;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function authUser(ctx: Ctx): User | null {
  if (!ctx.token) return null;
  const m = /^mock-([^-]+)-/.exec(ctx.token);
  if (!m) return null;
  const user = getDb().users.find((u) => u.id === m[1]);
  return user ? clone(user) : null;
}

function findTx(id: string): Transaction | undefined {
  return getDb().transactions.find((t) => t.id === id);
}

function jakDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function touch(tx: Transaction, actor: string, label: string, detail?: string): void {
  tx.updatedAt = new Date().toISOString();
  tx.history.push({ id: uuid(), at: tx.updatedAt, actor, label, detail });
}

const ALLOWED: Record<Transaction["status"], Transaction["status"][]> = {
  draft: ["in_appraisal", "cancelled"],
  in_appraisal: ["awaiting_decision", "cancelled"],
  awaiting_decision: ["accepted", "rejected", "cancelled"],
  accepted: ["payment_processing", "cancelled"],
  payment_processing: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
};

function canTransition(from: Transaction["status"], to: Transaction["status"]): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

function upsertEvaluation(db: MockDb, tx: Transaction): void {
  const staff = db.users.find((u) => u.id === tx.staffId);
  if (!staff) return;
  const segments = db.transcriptions[tx.id] ?? [];
  const ev = createEvaluation(tx.staffId, staff.name, tx, segments);
  const idx = db.evaluations.findIndex((e) => e.transactionId === tx.id);
  if (idx >= 0) db.evaluations[idx] = ev;
  else db.evaluations.push(ev);
  emit({ type: "evaluation.ready", transactionId: tx.id, payload: { staffId: tx.staffId, evaluationId: ev.id } });
}

function computeQuotes(db: MockDb, tx: Transaction, itemIds?: string[]): number {
  let touched = 0;
  for (const item of tx.items) {
    if (itemIds && !itemIds.includes(item.id)) continue;
    if (!itemReadyForQuote(item)) continue;
    item.quote = computeQuote(
      item.appraisal as Appraisal,
      item.type,
      db.prices.prices,
      db.prices.id
    );
    item.status = "appraised";
    touched++;
  }
  return touched;
}

function txTotal(tx: Transaction): number {
  return tx.items.reduce((a, it) => a + (it.quote?.total ?? 0), 0);
}

const DEVICE_LABEL = "Perangkat";

function publicSnapshot(token: string): MockResponse {
  const tx = getDb().transactions.find((t) => t.publicLink?.token === token);
  if (!tx) return { status: 404, data: { message: "Tautan tidak ditemukan." } };
  const link = tx.publicLink!;
  if (new Date(link.expiresAt).getTime() < Date.now()) {
    return { status: 410, data: { message: "Tautan sudah kedaluwarsa. Silakan minta staf memperbarui tautan." } };
  }
  const db = getDb();
  const branch = db.branches.find((b) => b.id === tx.branchId);
  return {
    status: 200,
    data: {
      code: tx.code,
      status: tx.status,
      branch: branch?.name ?? "—",
      companyName: "AURUM Jewelry Trading",
      goldPrices: db.prices.prices,
      priceEffectiveAt: db.prices.effectiveDate,
      expiresAt: link.expiresAt,
      reviewedAt: new Date().toISOString(),
      acceptHint: "Harga final dihitung saat penawaran di counter.",
      items: tx.items.map((it) => ({
        id: it.id,
        description: it.description,
        type: it.type,
        photo: it.photo,
        weightG: it.appraisal?.weightG ?? 0,
        karat: it.appraisal?.karat ?? null,
        quote: it.quote ?? null,
      })),
      offeredTotal: txTotal(tx),
    },
  };
}

function dashboardData(): ManagementDashboard {
  const db = getDb();
  const now = new Date().toISOString();
  const today = jakDay(now);
  const createdToday = db.transactions.filter((t) => jakDay(t.createdAt) === today);

  const paidToday = db.transactions.filter(
    (t) => t.payment?.paidAt && jakDay(t.payment.paidAt) === today && t.status === "completed"
  );
  const paidAll = db.transactions.filter((t) => t.payment?.paidAt && t.status === "completed");
  const payValue = (list: Transaction[]) => list.reduce((a, t) => a + (t.payment?.amount ?? 0), 0);
  const offerValue = (list: Transaction[]) => list.reduce((a, t) => a + txTotal(t), 0);

  const acceptedLike = (t: Transaction) =>
    ["accepted", "payment_processing", "completed"].includes(t.status);

  const purchaseValueToday = offerValue(createdToday.filter(acceptedLike));

  const dailyTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const day = jakDay(d.toISOString());
    const label = d.toLocaleDateString("id-ID", { weekday: "short", timeZone: "Asia/Jakarta" });
    const list = db.transactions.filter((t) => jakDay(t.createdAt) === day);
    return {
      day,
      label,
      transactions: list.length,
      value: offerValue(list.filter(acceptedLike)),
    };
  });

  const branchStats = db.branches.map((b) => {
    const list = createdToday.filter((t) => t.branchId === b.id);
    const accepted = list.filter(acceptedLike);
    const rejected = list.filter((t) => t.status === "rejected");
    return {
      branchId: b.id,
      transactionsToday: list.length,
      purchaseValueToday: offerValue(accepted),
      completedPayments: list.filter((t) => t.status === "completed").length,
      activeTransactions: db.transactions.filter(
        (t) => t.branchId === b.id && ["draft", "in_appraisal", "awaiting_decision", "accepted", "payment_processing"].includes(t.status)
      ).length,
      customersServed: list.length,
      conversionRate: accepted.length + rejected.length ? (accepted.length / (accepted.length + rejected.length)) * 100 : 0,
      staffIds: db.users.filter((u) => u.branchId === b.id).map((u) => u.id),
    };
  });

  const statusMix = (["draft", "in_appraisal", "awaiting_decision", "accepted", "payment_processing", "completed", "rejected", "cancelled"] as const)
    .map((status) => ({ status, count: db.transactions.filter((t) => t.status === status).length }))
    .filter((s) => s.count > 0);

  return {
    totals: {
      transactionsToday: createdToday.length,
      purchaseValueToday,
      completedPayments: paidToday.length,
      completedPaymentsValue: payValue(paidToday),
      activeTransactions: db.transactions.filter((t) =>
        ["draft", "in_appraisal", "awaiting_decision", "accepted", "payment_processing"].includes(t.status)
      ).length,
      customersServed: createdToday.length,
    },
    dailyTrend,
    branchStats,
    statusMix,
    topStaff: staffPerformanceList(paidAll),
    recentTransactions: db.transactions
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12)
      .map(clone),
  };
}

function staffPerformanceList(paidAll?: Transaction[]): StaffPerformanceSummary[] {
  const db = getDb();
  const paidSet = paidAll ?? db.transactions.filter((t) => t.payment && t.status === "completed");
  return db.users
    .filter((u) => u.role === "staff")
    .map((u) => {
      const txs = db.transactions.filter((t) => t.staffId === u.id);
      const accepted = txs.filter((t) => t.status === "accepted" || t.status === "payment_processing" || t.status === "completed").length;
      const rejected = txs.filter((t) => t.status === "rejected").length;
      const completed = paidSet.filter((t) => t.staffId === u.id).length;
      const evs = db.evaluations.filter((e) => e.staffId === u.id);
      return {
        staffId: u.id,
        name: u.name,
        branchId: u.branchId ?? "",
        jobTitle: u.jobTitle,
        initials: u.initials,
        served: txs.length,
        completed,
        accepted,
        rejected,
        conversionRate: accepted + rejected ? (accepted / (accepted + rejected)) * 100 : 0,
        avgOverallScore: evs.length ? Math.round(evs.reduce((a, e) => a + e.overallScore, 0) / evs.length) : 0,
      };
    })
    .sort((a, b) => b.avgOverallScore - a.avgOverallScore || b.served - a.served);
}

function staffDetail(id: string): MockResponse {
  const db = getDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return { status: 404, data: { message: "Staf tidak ditemukan." } };
  const summaries = staffPerformanceList();
  const summary = summaries.find((s) => s.staffId === id)!;
  const branch = db.branches.find((b) => b.id === user.branchId);
  const txs = db.transactions
    .filter((t) => t.staffId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestTx = txs.find((t) => db.transcriptions[t.id]?.length);
  return {
    status: 200,
    data: {
      staff: clone(user),
      branch: branch ? clone(branch) : null,
      summary,
      evaluations: db.evaluations
        .filter((e) => e.staffId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(clone),
      recentTransactions: txs.slice(0, 10).map(clone),
      transcriptHighlights: latestTx ? db.transcriptions[latestTx.id].slice(0, 12) : [],
    } as StaffDetailReport,
  };
}

function applyPatch(tx: Transaction, patch: Record<string, unknown>, actor: string): string | null {
  if (typeof patch.status === "string") {
    const to = patch.status as Transaction["status"];
    if (!canTransition(tx.status, to)) {
      return `Transisi status tidak valid: ${tx.status} → ${to}`;
    }
    tx.status = to;
    tx.statusChangedAt = new Date().toISOString();
    touch(tx, actor, `Status → ${to}`);
  }
  if (patch.customer && typeof patch.customer === "object") {
    tx.customer = { ...tx.customer, ...(patch.customer as object) } as typeof tx.customer;
    touch(tx, actor, "Data pelanggan diperbarui");
  }
  if (typeof patch.lastDevice === "string") {
    tx.lastDevice = patch.lastDevice;
  }
  if (typeof patch.rejectNote === "string") {
    tx.rejectNote = patch.rejectNote;
  }
  return null;
}

async function handle(ctx: Ctx): Promise<MockResponse> {
  const db = getDb();
  const segs = ctx.path.replace(/^\/+/, "").split("/").filter(Boolean);
  if (segs[0] !== "api") return { status: 404, data: { message: "Not found" } };
  const [, a, b, c, d] = segs;

  if (a === "auth") {
    if (b === "login" && ctx.method === "POST") {
      const body = ctx.body as { username?: string; password?: string };
      const user = db.users.find((u) => u.username === (body.username ?? "").trim());
      if (!user || user.password !== body.password) {
        return { status: 401, data: { message: "Nama pengguna atau kata sandi salah." } };
      }
      const token = `mock-${user.id}-${randomToken(8)}`;
      const publicUser = clone(user);
      delete (publicUser as { password?: string }).password;
      return {
        status: 200,
        data: {
          token,
          user: publicUser,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
        },
      };
    }
    if (b === "me" && ctx.method === "GET") {
      const user = authUser(ctx);
      if (!user) return { status: 401, data: { message: "Sesi tidak valid." } };
      return { status: 200, data: { user } };
    }
    return { status: 404, data: { message: "Not found" } };
  }

  if (a === "branches" && ctx.method === "GET") {
    const list = clone(db.branches);
    if (b) {
      const one = list.find((x) => x.id === b);
      if (!one) return { status: 404, data: { message: "Cabang tidak ditemukan." } };
      return { status: 200, data: one };
    }
    return { status: 200, data: list };
  }

  if (a === "prices" && b === "history" && ctx.method === "GET") {
    return { status: 200, data: clone(db.priceHistory) };
  }

  if (a === "prices" && b === "today") {
    if (ctx.method === "GET") {
      return { status: 200, data: clone(db.prices) };
    }
    if (ctx.method === "PUT") {
      const user = authUser(ctx);
      const body = ctx.body as { prices?: GoldPrices; note?: string };
      const p = body?.prices;
      if (!p || !KARATS.every((k) => typeof p[k] === "number" && p[k] > 0)) {
        return { status: 400, data: { message: "Data harga tidak valid." } };
      }
      const normalized = Object.fromEntries(
        KARATS.map((k) => [k, Math.round(p[k] / 500) * 500])
      ) as unknown as GoldPrices;
      const entry: ActivePriceList = {
        id: `pl-${uuid().slice(0, 8)}`,
        effectiveDate: new Date().toISOString(),
        prices: normalized,
        changedBy: user?.name ?? "Sistem",
        changedAt: new Date().toISOString(),
        note: body.note,
      };
      const historyEntry: PriceHistoryEntry = {
        ...clone(entry),
        listId: entry.id,
        prices: { ...entry.prices },
        replacedAt: entry.effectiveDate,
      };
      db.prices = entry;
      db.priceHistory.unshift(historyEntry);
      save();
      emit({ type: "price.updated", payload: { prices: normalized, changedBy: entry.changedBy } });
      return { status: 200, data: clone(entry) };
    }
  }

  if (a === "transactions" && ctx.method === "GET" && !b) {
    let list = db.transactions.slice();
    const q = ctx.query;
    if (q.get("branchId")) list = list.filter((t) => t.branchId === q.get("branchId"));
    if (q.get("staffId")) list = list.filter((t) => t.staffId === q.get("staffId"));
    if (q.get("status")) list = list.filter((t) => t.status === q.get("status"));
    if (q.get("activeOnly") === "true") {
      list = list.filter((t) =>
        ["draft", "in_appraisal", "awaiting_decision", "accepted", "payment_processing"].includes(t.status)
      );
    }
    if (q.get("from")) list = list.filter((t) => jakDay(t.createdAt) >= q.get("from")!);
    if (q.get("to")) list = list.filter((t) => jakDay(t.createdAt) <= q.get("to")!);
    const search = (q.get("search") ?? "").trim().toLowerCase();
    if (search) {
      list = list.filter(
        (t) =>
          t.code.toLowerCase().includes(search) ||
          t.customer.name.toLowerCase().includes(search) ||
          (t.customer.phone ?? "").toLowerCase().includes(search)
      );
    }
    list.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    return { status: 200, data: list.map(clone) };
  }

  if (a === "transactions" && ctx.method === "POST" && !b) {
    const user = authUser(ctx);
    if (!user || user.role !== "staff") return { status: 403, data: { message: "Hanya staf cabang dapat membuat transaksi." } };
    const body = ctx.body as { customer?: Transaction["customer"]; branchId?: string; counterId?: string };
    const branchId = body.branchId ?? user.branchId;
    const counterId = body.counterId ?? user.counterId;
    if (!branchId || !counterId) return { status: 400, data: { message: "Cabang dan counter wajib diisi." } };
    if (!body.customer?.name) return { status: 400, data: { message: "Nama pelanggan wajib diisi." } };
    const now = new Date().toISOString();
    const tx: Transaction = {
      id: `txn-${uuid().slice(0, 10)}`,
      code: txnCode(),
      branchId,
      counterId,
      staffId: user.id,
      customer: { ...body.customer },
      status: "draft",
      createdAt: now,
      updatedAt: now,
      statusChangedAt: now,
      items: [],
      history: [
        { id: uuid(), at: now, actor: user.name, label: "Transaksi dibuat", detail: `Counter ${counterId}` },
      ],
    };
    db.transactions.unshift(tx);
    save();
    emit({ type: "transaction.created", transactionId: tx.id, payload: { transactionId: tx.id } });
    return { status: 201, data: clone(tx) };
  }

  if (a === "transactions" && b) {
    const tx = findTx(b);
    if (!tx) return { status: 404, data: { message: "Transaksi tidak ditemukan." } };

    if (ctx.method === "GET" && !c) {
      return { status: 200, data: clone(tx) };
    }

    if (ctx.method === "PATCH" && !c) {
      const user = authUser(ctx);
      const patch = ctx.body as Record<string, unknown>;
      const statusErr = applyPatch(tx, patch, user?.name ?? "Sistem");
      if (statusErr) return { status: 409, data: { message: statusErr } };
      save();
      emit({ type: "transaction.updated", transactionId: tx.id, payload: { transaction: clone(tx) } });
      return { status: 200, data: clone(tx) };
    }

    if (ctx.method === "POST" && c === "items") {
      const body = ctx.body as { description?: string; type?: JewelryItem["type"]; photo?: string };
      if (!body.description && !body.photo) return { status: 400, data: { message: "Isi deskripsi atau foto perhiasan." } };
      const now = new Date().toISOString();
      const item: JewelryItem = {
        id: `itm-${uuid().slice(0, 10)}`,
        sessionId: `S${tx.items.length + 1}`,
        description: body.description ?? "Perhiasan",
        type: body.type ?? "other",
        photo: body.photo,
        status: "registered",
        createdAt: now,
      };
      tx.items.push(item);
      touch(tx, authUser(ctx)?.name ?? "Sistem", `Perhiasan ditambahkan (Sesi ${item.sessionId})`);
      if (tx.status === "draft") {
        tx.status = "in_appraisal";
        tx.statusChangedAt = now;
      }
      save();
      emit({ type: "transaction.updated", transactionId: tx.id, payload: { transaction: clone(tx) } });
      return { status: 201, data: clone(item) };
    }

    if (ctx.method === "PATCH" && c === "items" && d) {
      const item = tx.items.find((i) => i.id === d);
      if (!item) return { status: 404, data: { message: "Perhiasan tidak ditemukan." } };
      const body = ctx.body as Record<string, unknown>;
      const user = authUser(ctx)?.name ?? "Sistem";
      if (typeof body.description === "string") item.description = body.description;
      if (typeof body.type === "string") item.type = body.type as JewelryItem["type"];
      if (typeof body.photo === "string") item.photo = body.photo;
      if (body.appraisal && typeof body.appraisal === "object") {
        const ap = body.appraisal as Partial<Appraisal>;
        item.appraisal = {
          weightG: ap.weightG ?? item.appraisal?.weightG ?? 0,
          karat: (ap.karat ?? item.appraisal?.karat ?? 24) as Karat,
          measuredPurity: ap.measuredPurity ?? item.appraisal?.measuredPurity,
          scaleXrfNote: ap.scaleXrfNote ?? item.appraisal?.scaleXrfNote,
          scalePhoto: ap.scalePhoto ?? item.appraisal?.scalePhoto,
          xrfPhoto: ap.xrfPhoto ?? item.appraisal?.xrfPhoto,
          notes: ap.notes ?? item.appraisal?.notes,
          appraisedAt: item.appraisal?.appraisedAt ?? new Date().toISOString(),
        };
        const { weightG, karat } = item.appraisal;
        item.quote = undefined;
        item.status = weightG > 0 && karat ? "appraising" : "appraising";
        touch(tx, user, `Penilaian diperbarui untuk ${item.description}`);
      }
      if (tx.status === "draft" && item.status !== "registered") {
        tx.status = "in_appraisal";
        tx.statusChangedAt = new Date().toISOString();
      }
      save();
      emit({ type: "transaction.updated", transactionId: tx.id, payload: { transaction: clone(tx) } });
      return { status: 200, data: clone(item) };
    }

    if (ctx.method === "DELETE" && c === "items" && d) {
      const idx = tx.items.findIndex((i) => i.id === d);
      if (idx < 0) return { status: 404, data: { message: "Perhiasan tidak ditemukan." } };
      const removed = tx.items.splice(idx, 1)[0];
      touch(tx, authUser(ctx)?.name ?? "Sistem", `Perhiasan dihapus (${removed.description})`);
      save();
      emit({ type: "transaction.updated", transactionId: tx.id, payload: { transaction: clone(tx) } });
      return { status: 200, data: { removedId: d } };
    }

    if (ctx.method === "POST" && c === "photos") {
      const body = ctx.body as { kind?: string; itemId?: string; dataUrl?: string };
      if (!body.dataUrl) return { status: 400, data: { message: "Foto wajib diunggah." } };
      const item = body.itemId ? tx.items.find((i) => i.id === body.itemId) : undefined;
      if (!item) return { status: 404, data: { message: "Perhiasan tidak ditemukan." } };
      if (body.kind === "scale") item.appraisal = { ...(item.appraisal as Appraisal), scalePhoto: body.dataUrl } as Appraisal;
      else if (body.kind === "xrf") item.appraisal = { ...(item.appraisal as Appraisal), xrfPhoto: body.dataUrl } as Appraisal;
      else item.photo = body.dataUrl;
      touch(tx, authUser(ctx)?.name ?? "Sistem", "Foto diperbarui");
      save();
      emit({ type: "transaction.updated", transactionId: tx.id, payload: { transaction: clone(tx) } });
      return { status: 201, data: { ok: true } };
    }

    if (ctx.method === "POST" && c === "quote") {
      const body = ctx.body as { itemIds?: string[] };
      computeQuotes(db, tx, body?.itemIds);
      const allHaveQuote = tx.items.length > 0 && tx.items.every((it) => it.quote);
      if (allHaveQuote && canTransition(tx.status, "awaiting_decision")) {
        tx.status = "awaiting_decision";
        tx.statusChangedAt = new Date().toISOString();
      }
      touch(tx, authUser(ctx)?.name ?? "Sistem", "Perhitungan harga dibuat", `Total tawaran ${txTotal(tx).toLocaleString("id-ID")}`);
      save();
      upsertEvaluation(db, tx);
      emit({ type: "transaction.updated", transactionId: tx.id, payload: { transaction: clone(tx) } });
      return { status: 200, data: clone(tx) };
    }

    if (ctx.method === "POST" && c === "decision") {
      const body = ctx.body as { accepted?: boolean; note?: string };
      const user = authUser(ctx)?.name ?? "Sistem";
      const to = body.accepted ? "accepted" : "rejected";
      if (!canTransition(tx.status, to)) return { status: 409, data: { message: `Status ${tx.status} tidak dapat berubah ke ${to}.` } };
      tx.status = to;
      tx.statusChangedAt = new Date().toISOString();
      if (body.accepted) tx.decision = { accepted: true, decidedAt: tx.statusChangedAt, note: body.note };
      else {
        tx.decision = { accepted: false, decidedAt: tx.statusChangedAt, note: body.note };
        tx.rejectNote = body.note;
      }
      touch(tx, user, body.accepted ? "Penawaran diterima pelanggan" : "Penawaran ditolak pelanggan", body.note);
      save();
      upsertEvaluation(db, tx);
      emit({ type: "transaction.updated", transactionId: tx.id, payload: { transaction: clone(tx) } });
      return { status: 200, data: clone(tx) };
    }

    if (ctx.method === "POST" && c === "payment") {
      const body = ctx.body as { method?: string; amount?: number; reference?: string };
      if (!canTransition(tx.status, "payment_processing")) return { status: 409, data: { message: "Penawaran harus diterima sebelum pembayaran dicatat." } };
      if (!body.method || !(body.amount ?? 0 > 0)) return { status: 400, data: { message: "Metode dan jumlah pembayaran wajib diisi." } };
      tx.payment = {
        method: body.method as "cash" | "transfer" | "ewallet",
        amount: body.amount as number,
        reference: body.reference,
        paidAt: new Date().toISOString(),
      };
      tx.status = "payment_processing";
      tx.statusChangedAt = tx.payment.paidAt;
      touch(tx, authUser(ctx)?.name ?? "Sistem", "Pembayaran dicatat", `${body.method} • ${(body.amount ?? 0).toLocaleString("id-ID")}`);
      save();
      emit({ type: "transaction.updated", transactionId: tx.id, payload: { transaction: clone(tx) } });
      return { status: 200, data: clone(tx) };
    }

    if (ctx.method === "POST" && c === "receipt") {
      const body = ctx.body as { dataUrl?: string; confirm?: boolean };
      if (!tx.payment) return { status: 409, data: { message: "Catat pembayaran terlebih dahulu." } };
      if (body.dataUrl) tx.payment.receiptPhoto = body.dataUrl;
      if (body.confirm !== false) {
        tx.payment.confirmedAt = new Date().toISOString();
        tx.status = "completed";
        tx.statusChangedAt = tx.payment.confirmedAt;
        touch(tx, authUser(ctx)?.name ?? "Sistem", "Pembayaran dikonfirmasi", `Struk ${tx.payment.reference ?? ""}`);
      }
      save();
      emit({ type: "transaction.updated", transactionId: tx.id, payload: { transaction: clone(tx) } });
      return { status: 200, data: clone(tx) };
    }

    if (ctx.method === "POST" && c === "public-link") {
      const regenerate = Boolean((ctx.body as { regenerate?: boolean })?.regenerate);
      const existing = tx.publicLink;
      const stillValid = existing && new Date(existing.expiresAt).getTime() > Date.now() + 30 * 60000;
      if (stillValid && !regenerate) {
        return { status: 200, data: { url: existing!.path, token: existing!.token, expiresAt: existing!.expiresAt, ttlMinutes: existing!.ttlMinutes } };
      }
      const token = `pub-${randomToken(10)}`;
      const path = `/public/review/${token}`;
      tx.publicLink = {
        token,
        path,
        expiresAt: new Date(Date.now() + PUBLIC_LINK_TTL_MINUTES * 60000).toISOString(),
        ttlMinutes: PUBLIC_LINK_TTL_MINUTES,
        createdAt: new Date().toISOString(),
      };
      touch(tx, authUser(ctx)?.name ?? "Sistem", "Tautan pelanggan dibuat", expiresLabel(tx.publicLink.expiresAt));
      save();
      emit({ type: "transaction.updated", transactionId: tx.id, payload: { transaction: clone(tx) } });
      return { status: 201, data: { url: path, token, expiresAt: tx.publicLink.expiresAt, ttlMinutes: PUBLIC_LINK_TTL_MINUTES } };
    }

    if (ctx.method === "GET" && c === "transcriptions") {
      return { status: 200, data: (db.transcriptions[tx.id] ?? []).map(clone) };
    }

    if (ctx.method === "POST" && c === "transcriptions") {
      const body = ctx.body as { segments?: Partial<TranscriptRecord>[] };
      if (!Array.isArray(body.segments)) return { status: 400, data: { message: "Segmen transkripsi wajib dikirim." } };
      const bucket: TranscriptRecord[] = db.transcriptions[tx.id] ?? (db.transcriptions[tx.id] = []);
      let appended = 0;
      for (const raw of body.segments) {
        if (!raw?.id || typeof raw.text !== "string" || !raw.text.trim()) continue;
        const cleaned: TranscriptRecord = {
          id: raw.id,
          transactionId: tx.id,
          startedAt: raw.startedAt ?? new Date().toISOString(),
          durationMs: raw.durationMs ?? 0,
          text: raw.text.trim(),
          confidence: raw.confidence,
          speakerHint: raw.speakerHint ?? "staff",
          deviceId: raw.deviceId ?? DEVICE_LABEL,
        };
        const idx = bucket.findIndex((s) => s.id === cleaned.id);
        if (idx >= 0) bucket[idx] = cleaned;
        else {
          bucket.push(cleaned);
          appended++;
        }
      }
      bucket.sort((x, y) => x.startedAt.localeCompare(y.startedAt));
      if (appended > 0) {
        save();
        emit({
          type: "transcription.appended",
          transactionId: tx.id,
          payload: { count: appended, segments: bucket.slice(-appended).map(clone) },
        });
      }
      return { status: 201, data: { appended, total: bucket.length } };
    }

    if (ctx.method === "GET" && c === "evaluation") {
      const ev = db.evaluations.find((e) => e.transactionId === tx.id);
      return { status: 200, data: { evaluation: ev ? clone(ev) : null, transcriptionCount: (db.transcriptions[tx.id] ?? []).length } };
    }
  }

  if (a === "public" && b === "reviews" && c && ctx.method === "GET") {
    return publicSnapshot(c);
  }

  if (a === "management") {
    const user = authUser(ctx);
    if (!user || user.role !== "management") return { status: 403, data: { message: "Akses manajemen diperlukan." } };
    if (b === "dashboard" && ctx.method === "GET") return { status: 200, data: dashboardData() };
    if (b === "staff" && ctx.method === "GET") {
      if (c) return staffDetail(c);
      return { status: 200, data: staffPerformanceList() };
    }
    if (b === "branches" && ctx.method === "GET") {
      const dash = dashboardData();
      return {
        status: 200,
        data: {
          branches: getDb().branches.map(clone),
          stats: dash.branchStats,
        },
      };
    }
    if (b === "reports" && ctx.method === "GET") {
      const dash = dashboardData();
      return { status: 200, data: { ...dash, generatedAt: new Date().toISOString() } };
    }
  }

  return { status: 404, data: { message: "Not found" } };
}

function expiresLabel(iso: string): string {
  return `Berlaku hingga ${new Date(iso).toLocaleString("id-ID")}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockRequest(
  method: string,
  url: string,
  body?: Body,
  token?: string | null
): Promise<{ status: number; data: unknown; requestId: string }> {
  const target = new URL(url, "http://mock.local");
  const ctx: Ctx = {
    method: method.toUpperCase(),
    path: target.pathname,
    query: target.searchParams,
    body: body ?? null,
    token: token ?? null,
  };
  await sleep(140 + Math.random() * 320);
  const res = await handle(ctx);
  return { status: res.status, data: res.data === undefined ? null : clone(res.data), requestId: newRequestId() };
}

export { effectivePerGram };
