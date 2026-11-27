import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, type LucideIcon } from "lucide-react";
import { api } from "./api";
import { authClient } from "./auth-client";
import type { ShiftReport } from "../components/ShiftReportsTable";

// Under "shiftReports" so every invalidation of that key (saves, submits,
// deletes) refreshes it too.
export const MY_DRAFT_QUERY_KEY = ["shiftReports", "myDraft"] as const;

/** The signed-in user's open draft report (each user may have only one), or null. */
export function useMyDraft() {
  const { data: session } = authClient.useSession();
  return useQuery({
    queryKey: MY_DRAFT_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ shiftReport: ShiftReport | null }>(
        "/api/shift-reports/my-draft",
      );
      return data.shiftReport;
    },
    enabled: !!session,
  });
}

/**
 * Where the "New Report" buttons go: back to the open draft when there is
 * one ("Edit Draft"), otherwise a new report.
 */
export function useReportShortcut(): { to: string; label: string; icon: LucideIcon } {
  const { data: draft } = useMyDraft();
  return draft
    ? { to: `/shift-reports/${draft.id}/edit`, label: "Edit Draft", icon: Pencil }
    : { to: "/shift-reports/new", label: "New Report", icon: Plus };
}
