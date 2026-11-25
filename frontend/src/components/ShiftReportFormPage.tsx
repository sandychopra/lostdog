import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
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
  const isEdit = id !== undefined;

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
      <Link to="/shift-reports" className="text-sm text-blue hover:underline">
        ← Back to Shift Reports
      </Link>
      <div className="mt-4 mb-6">
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
          report={report}
          onSuccess={(reportId) => navigate(`/shift-reports/${reportId}`)}
          onDraftCreated={(newReportId) =>
            navigate(`/shift-reports/${newReportId}/edit`, { replace: true })
          }
        />
      )}
    </AppLayout>
  );
}
