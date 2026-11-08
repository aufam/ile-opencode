import type { MockDb, MutationEvent } from "./db-types";
import buildSeed from "./seed";
import { uuid } from "../../lib/id";

const STORAGE_KEY = "aurum.mockdb.v2";

let db: MockDb;
let persistOk = true;

function sanitize(parsed: unknown): MockDb {
  const candidate = parsed as MockDb;
  if (!candidate || !Array.isArray(candidate.transactions) || !Array.isArray(candidate.users)) {
    throw new Error("corrupt mock db");
  }
  // Drop transactions from older schema versions that miss required fields.
  candidate.transactions = candidate.transactions.filter(
    (t) =>
      t &&
      typeof t.id === "string" &&
      typeof t.branchId === "string" &&
      typeof t.staffId === "string" &&
      !!t.customer &&
      Array.isArray(t.items)
  );
  if (!candidate.prices?.prices) throw new Error("corrupt mock db: prices");
  return candidate;
}

function load(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    /* fallthrough to reseed */
  }
  const seeded = buildSeed();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  } catch {
    persistOk = false;
  }
  return seeded;
}

export function getDb(): MockDb {
  return db;
}

export function save(): void {
  if (!persistOk) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    persistOk = false;
  }
}

export function resetDb(): void {
  db = buildSeed();
  save();
  emit({ type: "price.updated", serverTime: nowIso() });
}

export function emit(ev: MutationEvent): void {
  const full: MutationEvent = { ...ev, serverTime: nowIso() };
  for (const fn of subscribers.slice()) fn(full);
  try {
    broadcastChannel?.postMessage(full);
  } catch {
    /* ignore */
  }
}

const subscribers: ((ev: MutationEvent) => void)[] = [];

let broadcastChannel: BroadcastChannel | null = null;

export function subscribeEvents(fn: (ev: MutationEvent) => void): () => void {
  subscribers.push(fn);
  return () => {
    const i = subscribers.indexOf(fn);
    if (i >= 0) subscribers.splice(i, 1);
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

export class MethodNotAllowed extends Error {}

db = load();

if (typeof BroadcastChannel !== "undefined") {
  broadcastChannel = new BroadcastChannel("aurum.mock-sync");
  broadcastChannel.onmessage = (e: MessageEvent<MutationEvent>) => {
    if (e.data?.type === "price.updated") {
      /* refresh from storage to pick up cross-tab changes */
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) db = JSON.parse(raw);
      } catch {
        /* ignore */
      }
    }
    for (const fn of subscribers.slice()) fn({ ...e.data, serverTime: nowIso() });
  };
}

export function newRequestId(): string {
  return uuid();
}
