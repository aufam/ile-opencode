import type {
  Appraisal,
  AuthSession,
  Customer,
  JewelryItem,
  PaymentRecord,
  PublicLink,
  Quote,
  StaffEvaluation,
  Transaction,
  TranscriptSegment,
} from "../../lib/types";
import { http, qs } from "../client";
import type { TranscriptRecord } from "../mock/db-types";

type Method = "cash" | "transfer" | "ewallet";

export interface TxListQuery {
  branchId?: string;
  staffId?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  activeOnly?: boolean;
}

export const transactionsService = {
  // Backend: search/list transactions with filters; ordered newest first.
  async list(query: TxListQuery): Promise<Transaction[]> {
    return http<Transaction[]>("GET", `/api/transactions${qs({ ...query, activeOnly: query.activeOnly ? "true" : undefined })}`);
  },

  // Backend: create a transaction for the authenticated staff at a branch + counter; returns unique code/id.
  async create(payload: { customer: Customer; branchId: string; counterId: string }): Promise<Transaction> {
    return http<Transaction>("POST", "/api/transactions", payload);
  },

  // Backend: fetch the full transaction aggregate (items, appraisal, payment, history).
  async get(id: string): Promise<Transaction> {
    return http<Transaction>("GET", `/api/transactions/${id}`);
  },

  // Backend: patch customer data, counter, or transaction status with transition validation.
  async patch(id: string, patch: Partial<{ status: Transaction["status"]; customer: Partial<Customer>; lastDevice: string; rejectNote: string }>): Promise<Transaction> {
    return http<Transaction>("PATCH", `/api/transactions/${id}`, patch);
  },

  // Backend: append a jewelry item to the transaction (photo + initial description).
  async addItem(id: string, payload: { description: string; type: JewelryItem["type"]; photo?: string }): Promise<JewelryItem> {
    return http<JewelryItem>("POST", `/api/transactions/${id}/items`, payload);
  },

  // Backend: update appraisal data or item metadata; recalculates state and emits sync events.
  async patchItem(id: string, itemId: string, patch: Partial<{ description: string; type: JewelryItem["type"]; photo: string; appraisal: Partial<Appraisal> }>): Promise<JewelryItem> {
    return http<JewelryItem>("PATCH", `/api/transactions/${id}/items/${itemId}`, patch);
  },

  // Backend: remove a mis-registered jewelry item from the transaction.
  async removeItem(id: string, itemId: string): Promise<{ removedId: string }> {
    return http<{ removedId: string }>("DELETE", `/api/transactions/${id}/items/${itemId}`);
  },

  // Backend: upload/replace a photo attachment for an item (kind: item | scale | xrf).
  async uploadPhoto(id: string, payload: { kind: "item" | "scale" | "xrf"; itemId: string; dataUrl: string }): Promise<{ ok: boolean }> {
    return http<{ ok: boolean }>("POST", `/api/transactions/${id}/photos`, payload);
  },

  // Backend: compute purchase quotes for appraised items using today's price list + company rules.
  async quote(id: string, itemIds?: string[]): Promise<Transaction> {
    return http<Transaction>("POST", `/api/transactions/${id}/quote`, { itemIds });
  },

  // Backend: record the customer decision (accepted/rejected) for the presented offer.
  async decide(id: string, payload: { accepted: boolean; note?: string }): Promise<Transaction> {
    return http<Transaction>("POST", `/api/transactions/${id}/decision`, payload);
  },

  // Backend: record payment method + amount; moves transaction into payment processing.
  async pay(id: string, payload: { method: Method; amount: number; reference?: string }): Promise<Transaction> {
    return http<Transaction>("POST", `/api/transactions/${id}/payment`, payload);
  },

  // Backend: attach payment receipt photo; confirm payment and complete the transaction.
  async attachReceipt(id: string, payload: { dataUrl?: string; confirm?: boolean }): Promise<Transaction> {
    return http<Transaction>("POST", `/api/transactions/${id}/receipt`, payload);
  },

  // Backend: generate (or reuse valid) temporary public review link, returns relative URL + expiry.
  async createPublicLink(id: string, regenerate = false): Promise<{ url: string; token: string; expiresAt: string; ttlMinutes: number }> {
    return http<{ url: string; token: string; expiresAt: string; ttlMinutes: number }>(
      "POST",
      `/api/transactions/${id}/public-link`,
      { regenerate }
    );
  },

  // Backend: return transcription segments captured for this transaction.
  async getTranscriptions(id: string): Promise<TranscriptRecord[]> {
    return http<TranscriptRecord[]>("GET", `/api/transactions/${id}/transcriptions`);
  },

  // Backend: append/replace transcription segments; timestamp + speaker context preserved.
  async postTranscriptions(id: string, segments: Array<Partial<TranscriptRecord>>): Promise<{ appended: number; total: number }> {
    return http<{ appended: number; total: number }>("POST", `/api/transactions/${id}/transcriptions`, { segments });
  },

  // Backend: AI conversation evaluation for the transaction (mocked result object).
  async getEvaluation(id: string): Promise<{ evaluation: StaffEvaluation | null; transcriptionCount: number }> {
    return http<{ evaluation: StaffEvaluation | null; transcriptionCount: number }>("GET", `/api/transactions/${id}/evaluation`);
  },
};

export type { AuthSession, PublicLink, Quote, PaymentRecord };
