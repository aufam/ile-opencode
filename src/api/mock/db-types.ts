import type {
  ActivePriceList,
  Branch,
  GoldPrices,
  PriceHistoryEntry,
  StaffEvaluation,
  Transaction,
  TranscriptSegment,
  User,
} from "../../lib/types";

export const PUBLIC_LINK_TTL_MINUTES = 24 * 60;

export type { ActivePriceList, TranscriptSegment, PriceHistoryEntry, Branch };

export interface TranscriptRecord extends TranscriptSegment {
  transactionId: string;
}

export interface MockDb {
  users: (User & { password: string })[];
  branches: Branch[];
  prices: ActivePriceList;
  priceHistory: PriceHistoryEntry[];
  transactions: Transaction[];
  transcriptions: Record<string, TranscriptRecord[]>;
  evaluations: StaffEvaluation[];
}

export interface MutationEvent {
  type:
    | "transaction.created"
    | "transaction.updated"
    | "price.updated"
    | "transcription.appended"
    | "evaluation.ready"
    | "heartbeat";
  transactionId?: string;
  payload?: unknown;
  serverTime?: string;
}
