import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { ChevronLeft, Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Role } from "shared/constants/role.ts";
import { ShiftReportStatus } from "shared/constants/shiftReportStatus.ts";
import { shiftTypeLabel } from "shared/constants/shiftType.ts";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  formatReportDate,
  splitShiftPositionLabel,
  SHIFT_REPORT_STATUS_LABELS,
  shiftReportStatusBadgeVariant,
  type ShiftReport,
} from "./ShiftReportsTable";

interface ShiftReportHeaderProps {
  report: ShiftReport;
  /** Which page it's on — the button offers the other one. */
  mode: "view" | "edit";
}

/**
 * Title block shared by a report's view and edit pages: a link back to the
 * list, date and shift, status, author, and (top right) a visible button to
 * switch between viewing and editing — kept out of the ⋮ menu so volunteers
 * can find Edit — plus a ⋮ menu holding Delete (Admins) or Discard draft
 * (the author of a draft).
 */
export default function ShiftReportHeader({ report, mode }: ShiftReportHeaderProps) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isAdmin = session?.user.role === Role.Admin;
  const isAuthor = report.authorId === session?.user.id;
  const isDraft = report.status === ShiftReportStatus.Draft;
  const canEdit = isAuthor || isAdmin;
  const canDelete = isAdmin || (isAuthor && isDraft);
  const showEdit = mode === "view" && canEdit;
  const showView = mode === "edit";

  return (
    <div>
      <Link
        to="/shift-reports"
        className="mb-2 inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChevronLeft className="size-4" />
        Shift Reports
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold">
              {formatReportDate(report.date)} — {shiftTypeLabel(report.shiftType)}
            </h1>
            <Badge variant={shiftReportStatusBadgeVariant(report.status)}>
              {SHIFT_REPORT_STATUS_LABELS[report.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "edit" && "Editing · "}By {report.author.name}
            {report.isSplitShift &&
              ` · Split shift${report.splitShiftPosition ? ` (${splitShiftPositionLabel(report.splitShiftPosition)} shift)` : ""}`}
          </p>
        </div>

        {(showEdit || showView || canDelete) && (
          <div className="flex shrink-0 items-center gap-1">
            {showEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/shift-reports/${report.id}/edit`)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            {showView && (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/shift-reports/${report.id}`)}
              >
                <Eye className="h-4 w-4" />
                View report
              </Button>
            )}
            {canDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="More report actions"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirmingDelete(true)}>
                    <Trash2 className="h-4 w-4" />
                    {isDraft ? "Discard draft" : "Delete"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      <DeleteShiftReportDialog
        report={report}
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        onDeleted={() => navigate("/shift-reports")}
      />
    </div>
  );
}

interface DeleteShiftReportDialogProps {
  report: Pick<ShiftReport, "id" | "status">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

/** Confirm-then-delete for a report, worded as "Discard draft" for a Draft. */
export function DeleteShiftReportDialog({
  report,
  open,
  onOpenChange,
  onDeleted,
}: DeleteShiftReportDialogProps) {
  const queryClient = useQueryClient();
  const isDraft = report.status === ShiftReportStatus.Draft;

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/shift-reports/${report.id}`),
    onSuccess: async () => {
      onOpenChange(false);
      onDeleted();
      await queryClient.invalidateQueries({ queryKey: ["shiftReports"] });
    },
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) deleteMutation.reset();
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isDraft ? "Discard Draft" : "Delete Shift Report"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isDraft
              ? "Are you sure you want to discard this draft? This cannot be undone."
              : "Are you sure you want to delete this shift report? This cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteMutation.isError && (
          <ErrorAlert
            error={deleteMutation.error}
            fallback={isDraft ? "Failed to discard draft" : "Failed to delete shift report"}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Keep the dialog open until the delete finishes (or fails).
              event.preventDefault();
              deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
          >
            {isDraft ? "Discard" : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
