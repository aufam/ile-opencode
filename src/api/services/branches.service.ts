import type { Branch } from "../../lib/types";
import { http } from "../client";

export const branchesService = {
  // Backend: list all company branches with their service counters.
  async list(): Promise<Branch[]> {
    return http<Branch[]>("GET", "/api/branches");
  },

  // Backend: return one branch (used for staff-side context validation).
  async get(id: string): Promise<Branch> {
    return http<Branch>("GET", `/api/branches/${id}`);
  },
};
