import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router";
import { api } from "../lib/api";
import ErrorAlert from "./ErrorAlert";
import { Skeleton } from "./ui/skeleton";
import ShiftReportForm from "./ShiftReportForm";
import type { ShiftReport } from "./ShiftReportsTable";
import AppLayout from "./AppLayout";
import ShiftReportHeader from "./ShiftReportHeader";

export default function ShiftReportFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = id !== undefined;
  // New and edit share this page, so React Router can reuse the same form
  // instance between them. Each "New report" click is a new history entry
  // (new location.key), so keying on it guarantees a blank form; the
  // draft-created URL swap below carries the key forward so the form the
  // volunteer is typing in isn't reset.
  const formKey = (location.state as { formKey?: string } | null)?.formKey ?? location.key;

  const {
    data: report,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["shiftReports", id],
    queryFn: async () => {
      const { data } = await api.get<{ shiftReport: ShiftReport }>(`/api/shift-reports/${id}`);
      return data.shiftReport;
    },
    enabled: isEdit,
  });

  return (
    <AppLayout width="3xl">
      <div className="mb-6">
        {isEdit ? (
          report && <ShiftReportHeader report={report} mode="edit" />
        ) : (
          <h1 className="text-3xl font-bold">New Shift Report</h1>
        )}
      </div>
      {isEdit && isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      {isEdit && error && <ErrorAlert message="Failed to load shift report" />}
      {(!isEdit || report) && (
        <ShiftReportForm
          key={formKey}
          report={report}
          onSuccess={(reportId) => navigate(`/shift-reports/${reportId}`)}
          onDraftCreated={(newReportId) =>
            navigate(`/shift-reports/${newReportId}/edit`, { replace: true, state: { formKey } })
          }
        />
      )}
    </AppLayout>
  );
}
