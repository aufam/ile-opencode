export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function randomToken(bytes = 18): string {
  const raw = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(raw);
  } else {
    for (let i = 0; i < bytes; i++) raw[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(raw, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function txnCode(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const seq = Date.now().toString(36).slice(-4).toUpperCase();
  return `AUM-${ymd}-${seq}`;
}
