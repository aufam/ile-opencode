export type Role = "staff" | "management";

export interface User {
  id: string;
  code: string;
  name: string;
  username: string;
  role: Role;
  branchId?: string;
  counterId?: string;
  email: string;
  initials: string;
  jobTitle: string;
}

export interface AuthSession {
  token: string;
  user: User;
  issuedAt: string;
  expiresAt: string;
}

export interface Counter {
  id: string;
  name: string;
  device: "iPad" | "iPhone";
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  counters: Counter[];
}

export type Karat = 24 | 22 | 18 | 14;

export interface GoldPrices {
  24: number;
  22: number;
  18: number;
  14: number;
}

export interface ActivePriceList {
  id: string;
  effectiveDate: string;
  prices: GoldPrices;
  changedBy: string;
  changedAt: string;
  note?: string;
}

export interface PriceHistoryEntry extends ActivePriceList {
  listId: string;
  replacedAt: string;
}

export type TxStatus =
  | "draft"
  | "in_appraisal"
  | "awaiting_decision"
  | "accepted"
  | "rejected"
  | "payment_processing"
  | "completed"
  | "cancelled";

export interface Customer {
  name: string;
  phone?: string;
  address?: string;
  idType?: "ktp" | "sim" | "passport" | "none";
  idNumber?: string;
}

export type JewelryType = "ring" | "necklace" | "bracelet" | "pendant" | "earrings" | "chain" | "other";

export type PhotoKind = "item" | "scale" | "xrf" | "receipt" | "id_document";

export interface QuoteLine {
  label: string;
  detail?: string;
  amount: number;
  kind: "base" | "deduction" | "adjustment";
}

export interface Quote {
  karat: Karat;
  goldPricePerGram24: number;
  effectivePricePerGram: number;
  breakdown: QuoteLine[];
  subtotal: number;
  deductions: number;
  total: number;
  calculatedAt: string;
  priceListId: string;
}

export interface Appraisal {
  weightG: number;
  karat: Karat;
  measuredPurity?: number;
  scaleXrfNote?: string;
  scalePhoto?: string;
  xrfPhoto?: string;
  notes?: string;
  appraisedAt: string;
}

export interface JewelryItem {
  id: string;
  sessionId: string;
  description: string;
  type: JewelryType;
  photo?: string;
  photoUrl?: string;
  status: "registered" | "appraising" | "appraised";
  appraisal?: Appraisal;
  quote?: Quote;
  createdAt: string;
}

export interface PublicLink {
  token: string;
  path: string;
  expiresAt: string;
  ttlMinutes: number;
  createdAt: string;
}

export interface PaymentRecord {
  method: "cash" | "transfer" | "ewallet";
  amount: number;
  receiptPhoto?: string;
  receiptUrl?: string;
  reference?: string;
  paidAt: string;
  confirmedAt?: string;
}

export interface HistoryEvent {
  id: string;
  at: string;
  actor: string;
  label: string;
  detail?: string;
}

export interface Transaction {
  id: string;
  code: string;
  branchId: string;
  counterId: string;
  staffId: string;
  customer: Customer;
  status: TxStatus;
  createdAt: string;
  updatedAt: string;
  statusChangedAt?: string;
  items: JewelryItem[];
  decision?: { accepted: boolean; decidedAt: string; note?: string };
  payment?: PaymentRecord;
  publicLink?: PublicLink;
  history: HistoryEvent[];
  lastDevice?: string;
  rejectNote?: string;
}

export interface TranscriptSegment {
  id: string;
  startedAt: string;
  durationMs: number;
  text: string;
  confidence?: number;
  speakerHint?: "staff" | "customer" | "mixed";
  deviceId?: string;
  interim?: boolean;
}

export type EvalCriterionKey = "greeting" | "clarity" | "professionalism" | "engagement" | "compliance";

export interface EvalCriterion {
  key: EvalCriterionKey;
  label: string;
  score: number;
}

export interface StaffEvaluation {
  id: string;
  staffId: string;
  transactionId: string;
  overallScore: number;
  criteria: EvalCriterion[];
  strengths: string[];
  improvements: string[];
  segmentsCount: number;
  summaryText: string;
  createdAt: string;
}

export interface BranchStats {
  branchId: string;
  transactionsToday: number;
  purchaseValueToday: number;
  completedPayments: number;
  activeTransactions: number;
  customersServed: number;
  conversionRate: number;
  staffIds: string[];
}

export interface ManagementDashboard {
  totals: {
    transactionsToday: number;
    purchaseValueToday: number;
    completedPayments: number;
    completedPaymentsValue: number;
    activeTransactions: number;
    customersServed: number;
  };
  dailyTrend: { day: string; label: string; transactions: number; value: number }[];
  branchStats: BranchStats[];
  statusMix: { status: TxStatus; count: number }[];
  topStaff: StaffPerformanceSummary[];
  recentTransactions: Transaction[];
}

export interface StaffPerformanceSummary {
  staffId: string;
  name: string;
  branchId: string;
  jobTitle: string;
  initials: string;
  served: number;
  completed: number;
  accepted: number;
  rejected: number;
  conversionRate: number;
  avgOverallScore: number;
}

export interface StaffDetailReport {
  staff: User;
  branch: Branch;
  summary: StaffPerformanceSummary;
  evaluations: StaffEvaluation[];
  recentTransactions: Transaction[];
  transcriptHighlights: TranscriptSegment[];
}

export type WsEventName =
  | "hello"
  | "heartbeat"
  | "transaction.updated"
  | "transaction.created"
  | "price.updated"
  | "transcription.appended"
  | "evaluation.ready";

export interface WsEvent<P = unknown> {
  type: WsEventName;
  transactionId?: string;
  payload: P;
  serverTime: string;
}

export interface ApiResponse<T> {
  data: T;
  requestId?: string;
}
