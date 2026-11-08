import { mockRequest } from "./mock/backend";

export const USE_MOCK_BACKEND = true;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function rawFetch<T>(method: string, url: string, body?: unknown): Promise<T> {
  // Backend: send this request to the real server at the same relative URL.
  // Every request is relative so the SPA works behind any host.
  // Example shape (see docs/API_CONTRACT.md for the full contract):
  //   Backend: POST /api/transactions creates a transaction and returns its unique transaction ID.
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message =
      (payload as { message?: string } | null)?.message ?? `Permintaan gagal (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export async function http<T>(method: string, url: string, body?: unknown): Promise<T> {
  if (USE_MOCK_BACKEND) {
    const res = await mockRequest(method, url, body, authToken);
    if (res.status >= 400) {
      const message = (res.data as { message?: string } | null)?.message ?? `Permintaan gagal (${res.status})`;
      throw new ApiError(message, res.status);
    }
    return res.data as T;
  }
  return rawFetch<T>(method, url, body);
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
