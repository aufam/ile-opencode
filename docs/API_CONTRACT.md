# AURUM API Contract (v1)

All URLs are relative to the deployment origin, e.g. `POST /api/auth/login`.
Mock backend: `src/api/mock/backend.ts` (browser-only, mirrors this contract).
WebSocket endpoint (mock simulation): see [WebSocket](#websocket-events).

## Conventions

- **Auth** — endpoints marked 🔒 require the `Authorization: Bearer <token>` header from `POST /api/auth/login`.
- **Roles** — `staff` or `management`. Endpoints marked 👥 accept either; endpoints marked 🧑‍💼 restrict to management.
- **Errors** — non-2xx JSON: `{ "error": { "code": string, "message": string } }`.
- **Money** — integer rupiah, no decimals.
- **Timestamps** — ISO 8601 strings (`createdAt`, `ts`).

---

## Endpoints

### Auth

| Method | Endpoint | Access | Purpose | Body / Returns |
|---|---|---|---|---|
| POST | `/api/auth/login` | public | Login by username/password | Body `{username, password}` → `{token, issuedAt, expiresAt, user}` |
| GET | `/api/auth/me` | 🔒 | Validate token, refresh user snapshot | `{user}` |
| POST | `/api/auth/logout` | 🔒 | Invalidate token | `{ok: true}` |

### Branches & prices

| Method | Endpoint | Access | Purpose | Returns |
|---|---|---|---|---|
| GET | `/api/branches` | 👥 | List branches with counters | `Branch[]` |
| GET | `/api/prices/today` | 🔒 | Active gold price list for today | `ActivePriceList` (`{priceListId, effectiveDate, prices: {24,22,18,14}, changedBy, changedAt, note?}`) |
| PUT | `/api/prices/today` | 🧑‍💼 | Replace today's prices, archive old list | Body `{prices, note?}` → updated `ActivePriceList` |
| GET | `/api/prices/history` | 🧑‍💼 | Archived price lists (who/when/note) | `PriceHistoryEntry[]` |

### Transactions

| Method | Endpoint | Access | Purpose | Body / Returns |
|---|---|---|---|---|
| GET | `/api/transactions` | 🔒 | Filterable list. Params: `staffId`, `branchId`, `status`, `customerId`, `createdFrom`, `createdTo` | `Transaction[]` |
| POST | `/api/transactions` | 🔒 | Create draft (customer info captured before items) | Body `{customerId, branchId, counterId, staffId}` → `Transaction` (status `draft`) |
| GET | `/api/transactions/:id` | 🔒 | Retrieve single transaction (realtime refetch uses this) | `Transaction` |
| DELETE | `/api/transactions/:id` | 🔒 staff owner | Cancel draft (status → `cancelled`) | `{ok: true}` |
| PATCH | `/api/transactions/:id` | 🔒 | Generic edit (customers, notes) | Partial → `Transaction` |

Status flow: `draft → in_appraisal → awaiting_decision → accepted / rejected → payment_processing → completed`, plus `cancelled` from `draft`. Invalid transitions return 409.

### Items, photos, appraisal

| Method | Endpoint | Access | Purpose | Body / Returns |
|---|---|---|---|---|
| POST | `/api/transactions/:id/items` | 🔒 | Add item (serializes concurrent edits server-side) | Body `{name, creator, karat, gram, type, noteScale?}` → item |
| PATCH | `/api/transactions/:id/items/:itemId` | 🔒 | Save backroom measurement & update/replace quote | Body `{measuredPurity?, scalePhotoDataUrl?, xrfPhotoDataUrl?, notes?}` → transaction |
| DELETE | `/api/transactions/:id/items/:itemId` | 🔒 | Remove item | `{ok: true}` |
| POST | `/api/transactions/:id/items/:itemId/photos` | 🔒 | Upload photo (base64 data URL, ≤ ~1280px) | Body `{kind: "item" | "scale" | "xrf", dataUrl}` → updated transaction |
| DELETE | `/api/transactions/:id/items/:itemId/photos` | 🔒 | Remove a photo by `id` | `{ok: true}` |

Computing the quote:
| POST | `/api/transactions/:id/quote` | 🔒 | Compute deductions & final price per item using active price list + `weight × purity` | Body optional `{pricesOverride}` → transaction (`status: awaiting_decision`, quote per item) |

Decisions & payment:
| POST | `/api/transactions/:id/decision` | 🔒 (customer-facing device driven by staff) | `accept` or `reject` final offer | Body `{decision: "accepted" | "rejected"}` → transaction |
| POST | `/api/transactions/:id/payment` | 🔒 | Record method/amount/receipt photo then mark completed | Body `{method, amount, receiptPhotoDataUrl?}` → transaction |
| POST | `/api/transactions/:id/cancel` | 🔒 | Cancel transaction with reason | Body `{reason}` → transaction |

### Evaluation (AI-driven scoring)

| Method | Endpoint | Access | Purpose | Body / Returns |
|---|---|---|---|---|
| POST | `/api/transactions/:id/evaluation` | 🔒 internal | Score transcripts (`greeting`, `clarity`, `professionalism`, `engagement`, `compliance`) & accredit badges | Body `{transcriptId}` → `Evaluation` |
| DELETE | `/api/transactions/:id/evaluation` | 🔒 internal | Remove evaluation |

### Public links

| Method | Endpoint | Access | Purpose | Returns |
|---|---|---|---|---|
| POST | `/api/transactions/:id/public-link` | 🔒 | Generate read-only summary link (expires in `PUBLIC_LINK_TTL_MINUTES` = 24h) | `{token, url, expiresAt}` |
| GET | `/api/transactions/:id/public-link` | 🔒 | Reuse existing link or regenerate | same as POST |
| GET | `/api/public/reviews/:token` | public | Read-only public view; expires → 410 | `{transaction, pricing, validUntil}` |

### Transcription

| Method | Endpoint | Access | Purpose | Body / Returns |
|---|---|---|---|---|
| POST | `/api/transactions/:id/transcriptions` | 🔒 | Append transcript segments (auto chunk from WebSpeech on pause; manual notes labeled from staff/user) | Body `{startedAt, segments, deviceId}` → `TranscriptRecord` |
| GET | `/api/transactions/:id/transcriptions` | 🔒 | List all transcripts for review | `TranscriptRecord[]` |

### Management (🧑‍💼)

| Method | Endpoint | Purpose | Returns |
|---|---|---|---|
| GET | `/api/management/dashboard` | KPI summary (today & 30d), time series, branch aggregates, top staff, recent tx | `DashboardOverview` |
| GET | `/api/management/staff` | Staff performance table w/ score, conversion, avg payment | `StaffPerformance[]` |
| GET | `/api/management/staff/:id` | Detail: profile, evaluations, tx history, transcripts | `{staff, evaluations, transactions, transcripts}` |
| GET | `/api/management/branches` | Per-branch KPI cards + counters | `{branches, stats}` |
| GET | `/api/management/reports` | Downloadable report rows (JSON; exportable as CSV in future) | rows keyed by output |

---

## WebSocket events

Realtime channel is the single source of truth for cross-device updates. Mock simulation subscribes to the same event bus the mock backend emits into (`db.subscribeEvents`), plus simulated heartbeats.

`RealtimeClient` states: `online` → `reconnecting` → `offline`. Events:

| Event | When | Payload |
|---|---|---|
| `hello` | On connect | `{deviceId, since, connections: number}` |
| `heartbeat` | Periodic | `{ts}` |
| `transaction.created` | New transaction created | `{transaction}` |
| `transaction.updated` | Items/quote/decision/payment/status changed | `{transaction}` |
| `price.updated` | Gold price list replaced | `{priceListId, effectiveAt, by}` |
| `transcription.appended` | New transcript chunk saved | `{transactionId, startedAt, segmentCount}` |
| `evaluation.ready` | AI evaluation persisted | `{transactionId, evaluation}` |

Delivery semantics: at-least-once per subscribed device; clients reconcile by refetching from the GET endpoints listed above. A missed snapshot (client offline > heartbeat window) triggers a full refetch on reconnect.
