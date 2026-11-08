import type { GoldPrices, JewelryType, Quote, TxStatus } from "../../lib/types";
import { http } from "../client";

export interface PublicReview {
  code: string;
  status: TxStatus;
  branch: string;
  companyName: string;
  goldPrices: GoldPrices;
  priceEffectiveAt: string;
  expiresAt: string;
  reviewedAt: string;
  acceptHint: string;
  items: {
    id: string;
    description: string;
    type: JewelryType;
    photo?: string;
    weightG: number;
    karat: number | null;
    quote: Quote | null;
  }[];
  offeredTotal: number;
}

export const publicService = {
  // Backend: read-only public snapshot by token (no authentication), rejects expired tokens.
  async getReview(token: string): Promise<PublicReview> {
    return http<PublicReview>("GET", `/api/public/reviews/${token}`);
  },
};
