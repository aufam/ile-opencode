import type { Branch, ManagementDashboard, StaffDetailReport, StaffPerformanceSummary } from "../../lib/types";
import { http } from "../client";

export const managementService = {
  // Backend: aggregate operating KPIs, trends, branch stats and top staff for the dashboard.
  async dashboard(): Promise<ManagementDashboard> {
    return http<ManagementDashboard>("GET", "/api/management/dashboard");
  },

  // Backend: staff performance summaries across every branch.
  async staffList(): Promise<StaffPerformanceSummary[]> {
    return http<StaffPerformanceSummary[]>("GET", "/api/management/staff");
  },

  // Backend: full staff detail (metrics, evaluations, recent transactions, transcripts).
  async staffDetail(id: string): Promise<StaffDetailReport> {
    return http<StaffDetailReport>("GET", `/api/management/staff/${id}`);
  },

  // Backend: branches with live statistics for the branch management view.
  async branchBoard(): Promise<{ branches: Branch[]; stats: ManagementDashboard["branchStats"] }> {
    return http<{ branches: Branch[]; stats: ManagementDashboard["branchStats"] }>("GET", "/api/management/branches");
  },

  // Backend: periodic report export snapshot.
  async reports(): Promise<ManagementDashboard & { generatedAt: string }> {
    return http<ManagementDashboard & { generatedAt: string }>("GET", "/api/management/reports");
  },
};
