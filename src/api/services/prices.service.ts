import type { ActivePriceList, GoldPrices, PriceHistoryEntry } from "../../lib/types";
import { http } from "../client";

export const priceService = {
  // Backend: return the currently active gold price list for the running business day.
  async getToday(): Promise<ActivePriceList> {
    return http<ActivePriceList>("GET", "/api/prices/today");
  },

  // Backend: archived price lists (who changed, when, notes).
  async getHistory(): Promise<PriceHistoryEntry[]> {
    return http<PriceHistoryEntry[]>("GET", "/api/prices/history");
  },

  // Backend: replace today's active price list, record who changed it and archive to history.
  async updateToday(prices: GoldPrices, note?: string): Promise<ActivePriceList> {
    return http<ActivePriceList>("PUT", "/api/prices/today", { prices, note });
  },
};
