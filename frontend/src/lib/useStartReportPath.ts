import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/**
 * Where "Start report" should go: the signed-in user's unsubmitted draft if
 * they have one, otherwise a new report. Falls back to a new report while the
 * lookup is loading or if it fails, so the button always works.
 */
export function useStartReportPath(): string {
  const { data: draftId } = useQuery({
    // Under "shiftReports" so the form's existing invalidation refreshes it.
    queryKey: ["shiftReports", "my-draft"],
    queryFn: async () => {
      const { data } = await api.get<{ shiftReport: { id: number } | null }>(
        "/api/shift-reports/my-draft",
      );
      return data.shiftReport?.id ?? null;
    },
  });
  return draftId ? `/shift-reports/${draftId}/edit` : "/shift-reports/new";
}
