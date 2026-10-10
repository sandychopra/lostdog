import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "../lib/api";
import ErrorAlert from "./ErrorAlert";
import { Skeleton } from "./ui/skeleton";
import ShiftReportForm from "./ShiftReportForm";
import type { ShiftReport } from "./ShiftReportsTable";
import Navbar from "./Navbar";

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
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? "Edit Shift Report" : "New Shift Report"}
          </h1>
          {isEdit && report && (
            <Link to={`/shift-reports/${id}`} className="text-sm text-blue hover:underline">
              View full report →
            </Link>
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
      </main>
    </>
  );
}
