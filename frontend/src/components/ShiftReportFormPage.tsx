import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { shiftTypeLabel } from "shared/constants/shiftType.ts";
import { api } from "../lib/api";
import { MY_DRAFT_QUERY_KEY, useMyDraft } from "../lib/useMyDraft";
import ErrorAlert from "./ErrorAlert";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button, buttonVariants } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import ShiftReportForm from "./ShiftReportForm";
import { formatReportDate, type ShiftReport } from "./ShiftReportsTable";
import AppLayout from "./AppLayout";
import ShiftReportHeader, { DeleteShiftReportDialog } from "./ShiftReportHeader";

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export default function ShiftReportFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isEdit = id !== undefined;
  // New and edit share this page, so React Router can reuse the same form
  // instance between them. Each "New Report" click is a new history entry
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

  // Each user may have only one open draft. A new report is only offered
  // once we know they have none; after that the form stays up even though
  // its own first save makes it "their draft". A 409 from that save (a
  // draft created meanwhile, e.g. in another tab) switches back to the
  // message.
  const { data: myDraft, isPending: myDraftPending, error: myDraftError } = useMyDraft();
  const [newFormAllowed, setNewFormAllowed] = useState(false);
  // Adjusting state while rendering (not in an effect), per React's
  // "storing information from previous renders" pattern.
  if (!isEdit && !newFormAllowed && !myDraftPending && myDraft === null) {
    setNewFormAllowed(true);
  }
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const blockingDraft = !isEdit && !newFormAllowed && myDraft ? myDraft : null;

  return (
    <AppLayout width="3xl">
      <div className="mb-6">
        {isEdit ? (
          report && <ShiftReportHeader report={report} mode="edit" />
        ) : (
          <h1 className="text-3xl font-bold">New Shift Report</h1>
        )}
      </div>
      {isEdit && isLoading && <FormSkeleton />}
      {isEdit && error && <ErrorAlert message="Failed to load shift report" />}
      {!isEdit && myDraftError && <ErrorAlert message="Failed to load shift report" />}
      {!isEdit && !newFormAllowed && myDraftPending && <FormSkeleton />}
      {blockingDraft && (
        <Alert>
          <AlertTitle>You already have a draft in progress</AlertTitle>
          <AlertDescription>
            Your draft for {formatReportDate(blockingDraft.date)} —{" "}
            {shiftTypeLabel(blockingDraft.shiftType)} hasn&apos;t been submitted yet. Submit or
            discard it before starting a new report.
          </AlertDescription>
          {/* Outside AlertDescription, which underlines every link in it. */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={`/shift-reports/${blockingDraft.id}/edit`} className={buttonVariants()}>
              Open draft
            </Link>
            <Button type="button" variant="outline" onClick={() => setConfirmingDiscard(true)}>
              Discard draft
            </Button>
          </div>
        </Alert>
      )}
      {blockingDraft && (
        <DeleteShiftReportDialog
          report={blockingDraft}
          open={confirmingDiscard}
          onOpenChange={setConfirmingDiscard}
          // Once the delete invalidates "myDraft", the page shows a new report.
          onDeleted={() => {}}
        />
      )}
      {(isEdit ? report : newFormAllowed) && (
        <ShiftReportForm
          key={formKey}
          report={report}
          onSuccess={(reportId) => navigate(`/shift-reports/${reportId}`)}
          onDraftCreated={(newReportId) =>
            navigate(`/shift-reports/${newReportId}/edit`, { replace: true, state: { formKey } })
          }
          onDraftConflict={() => {
            setNewFormAllowed(false);
            void queryClient.invalidateQueries({ queryKey: MY_DRAFT_QUERY_KEY });
          }}
        />
      )}
    </AppLayout>
  );
}
