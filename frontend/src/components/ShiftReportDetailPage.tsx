import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { Pencil, Trash2 } from "lucide-react";
import { Role } from "shared/constants/role.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
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
import AuthenticatedImage from "./AuthenticatedImage";
import {
  formatReportDate,
  splitShiftPositionLabel,
  type CatEntry,
  type ShiftReport,
} from "./ShiftReportsTable";
import { occupantLabel, type Kennel } from "./KennelsTable";
import Navbar from "./Navbar";

function shiftTypeLabel(shiftType: string): string {
  return shiftType === "MidDay" ? "Mid-day" : shiftType;
}

function CatEntrySummary({ entry }: { entry: CatEntry }) {
  const title =
    entry.entryType === CatEntryType.Individual
      ? entry.cat?.name
      : entry.group?.cats.map((c) => c.name).join(" / ");

  return (
    <div className="space-y-2 rounded-md border border-input p-4">
      <div className="flex items-center gap-2">
        <span className="font-medium">{title}</span>
        <Badge variant="secondary">{entry.entryType}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Fecal score</dt>
        <dd>{entry.fecalScore ?? "None"}</dd>
        <dt className="text-muted-foreground">Pee</dt>
        <dd>{entry.pee ? "Yes" : "No"}</dd>
        {entry.peePooNotes && (
          <>
            <dt className="text-muted-foreground">Pee/Poo notes</dt>
            <dd>{entry.peePooNotes}</dd>
          </>
        )}
        {entry.dryFoodAmount && (
          <>
            <dt className="text-muted-foreground">Dry food</dt>
            <dd>{entry.dryFoodAmount}</dd>
          </>
        )}
        {entry.foodNotes && (
          <>
            <dt className="text-muted-foreground">Food notes</dt>
            <dd>{entry.foodNotes}</dd>
          </>
        )}
        {entry.medicalNotes && (
          <>
            <dt className="text-muted-foreground">Medical notes</dt>
            <dd>{entry.medicalNotes}</dd>
          </>
        )}
        {entry.behaviorNotes && (
          <>
            <dt className="text-muted-foreground">Behavior notes</dt>
            <dd>{entry.behaviorNotes}</dd>
          </>
        )}
        {entry.otherNotes && (
          <>
            <dt className="text-muted-foreground">Other notes</dt>
            <dd>{entry.otherNotes}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Nail trim</dt>
        <dd>{entry.nailTrim ? "Yes" : "No"}</dd>
        {entry.entryType === CatEntryType.Individual && (
          <>
            <dt className="text-muted-foreground">Dewormer given</dt>
            <dd>{entry.dewormerGiven ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">Probiotic given</dt>
            <dd>{entry.probioticGiven ? "Yes" : "No"}</dd>
          </>
        )}
      </dl>
      {entry.entryType === CatEntryType.Group && entry.groupDetails.length > 0 && (
        <div className="space-y-2">
          {entry.groupDetails.map((detail) => (
            <div key={detail.id} className="rounded-md bg-muted/40 p-2 text-sm">
              <p className="font-medium">{detail.cat.name}</p>
              <p className="text-muted-foreground">
                Wet food: {detail.wetFoodAmount ?? "—"} · Dewormer:{" "}
                {detail.dewormerGiven ? "Given" : "No"} · Probiotic:{" "}
                {detail.probioticGiven ? "Given" : "No"} · Nail trim:{" "}
                {detail.nailTrim ? "Yes" : "No"}
              </p>
              {detail.behaviorNotes && <p>{detail.behaviorNotes}</p>}
            </div>
          ))}
        </div>
      )}
      {entry.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entry.photos.map((photo) => (
            <AuthenticatedImage
              key={photo.id}
              photoId={photo.id}
              alt="Cat entry photo"
              className="h-20 w-20 rounded-md object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShiftReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
  });

  // Live kennel state for the Kennel Status section — reflects current
  // occupancy, not occupancy at the time this report was submitted.
  const { data: kennels } = useQuery({
    queryKey: ["kennels"],
    queryFn: async () => {
      const { data } = await api.get<{ kennels: Kennel[] }>("/api/kennels");
      return data.kennels;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/shift-reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shiftReports"] });
      navigate("/shift-reports");
    },
  });

  const isAdmin = session?.user.role === Role.Admin;
  const canEdit = report && (report.authorId === session?.user.id || isAdmin);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link to="/shift-reports" className="text-sm text-blue hover:underline">
          ← Back to Shift Reports
        </Link>

        {isLoading && (
          <div className="mt-4 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {error && <ErrorAlert message="Failed to load shift report" />}

        {report && (
          <>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {formatReportDate(report.date)} — {shiftTypeLabel(report.shiftType)}
                </h1>
                <p className="text-sm text-muted-foreground">
                  By {report.author.name}
                  {report.isSplitShift &&
                    ` · Split shift${report.splitShiftPosition ? ` (${splitShiftPositionLabel(report.splitShiftPosition)} shift)` : ""}`}
                </p>
              </div>
              <div className="flex gap-2">
                {canEdit && (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => navigate(`/shift-reports/${report.id}/edit`)}
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    Edit
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="destructive"
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            </div>

            {kennels && kennels.length > 0 && (
              <section className="mt-6 space-y-2">
                <h2 className="text-lg font-semibold">Kennel Status</h2>
                <div className="flex flex-wrap gap-2">
                  {kennels.map((kennel) => {
                    const hasOccupant = kennel.cats.length > 0 || kennel.groups.length > 0;
                    return (
                      <span
                        key={kennel.id}
                        className="rounded-full border border-input px-2.5 py-0.5 text-xs"
                      >
                        #{kennel.number}: {kennel.state}
                        {hasOccupant ? ` — ${occupantLabel(kennel)}` : ""}
                      </span>
                    );
                  })}
                </div>
              </section>
            )}

            {report.kennelsReset.length > 0 && (
              <section className="mt-6 space-y-2">
                <h2 className="text-lg font-semibold">Kennels Reset</h2>
                <div className="flex flex-wrap gap-2">
                  {report.kennelsReset.map((k) => (
                    <Badge key={k.kennelId}>#{k.kennel.number}</Badge>
                  ))}
                </div>
              </section>
            )}

            {report.kennelsFlagged.length > 0 && (
              <section className="mt-6 space-y-2">
                <h2 className="text-lg font-semibold">Kennels Flagged</h2>
                <div className="flex flex-wrap gap-2">
                  {report.kennelsFlagged.map((k) => (
                    <Badge key={k.kennelId} variant="destructive">
                      #{k.kennel.number}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {report.kennelNotes && (
              <section className="mt-6 space-y-2">
                <h2 className="text-lg font-semibold">Kennel Notes</h2>
                <p className="text-sm">{report.kennelNotes}</p>
              </section>
            )}

            {report.playGroups.length > 0 && (
              <section className="mt-6 space-y-2">
                <h2 className="text-lg font-semibold">Play Groups</h2>
                {report.playGroups.map((playGroup) => (
                  <div key={playGroup.id} className="rounded-md border border-input p-3 text-sm">
                    <p className="font-medium">
                      {playGroup.cats.map((c) => c.cat.name).join(", ")}
                    </p>
                    <p>{playGroup.note}</p>
                  </div>
                ))}
              </section>
            )}

            <section className="mt-6 space-y-3">
              <h2 className="text-lg font-semibold">Cat Entries</h2>
              {report.catEntries.length === 0 && (
                <p className="text-sm text-muted-foreground">No cat entries logged.</p>
              )}
              {report.catEntries.map((entry) => (
                <CatEntrySummary key={entry.id} entry={entry} />
              ))}
            </section>

            {report.meetAndGreets.length > 0 && (
              <section className="mt-6 space-y-2">
                <h2 className="text-lg font-semibold">Meet & Greets</h2>
                {report.meetAndGreets.map((mg) => (
                  <div key={mg.id} className="rounded-md border border-input p-3 text-sm">
                    <p className="font-medium">{mg.cats.map((c) => c.cat.name).join(", ")}</p>
                    <p>{mg.note}</p>
                  </div>
                ))}
              </section>
            )}

            {report.photos.length > 0 && (
              <section className="mt-6 space-y-2">
                <h2 className="text-lg font-semibold">Photos</h2>
                <div className="flex flex-wrap gap-2">
                  {report.photos.map((photo) => (
                    <div key={photo.id} className="w-24">
                      <AuthenticatedImage
                        photoId={photo.id}
                        alt="Shift report photo"
                        className="h-24 w-full rounded-md object-cover"
                      />
                      <p className="truncate text-xs text-muted-foreground">
                        {photo.tags.length > 0
                          ? photo.tags.map((t) => t.cat.name).join(", ")
                          : "Unassigned"}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(report.cleaningNotes || report.suppliesNotes || report.otherNotes) && (
              <section className="mt-6 space-y-2">
                <h2 className="text-lg font-semibold">Overall Notes</h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {report.cleaningNotes && (
                    <>
                      <dt className="text-muted-foreground">Cleaning</dt>
                      <dd>{report.cleaningNotes}</dd>
                    </>
                  )}
                  {report.suppliesNotes && (
                    <>
                      <dt className="text-muted-foreground">Supplies</dt>
                      <dd>{report.suppliesNotes}</dd>
                    </>
                  )}
                  {report.otherNotes && (
                    <>
                      <dt className="text-muted-foreground">Other</dt>
                      <dd>{report.otherNotes}</dd>
                    </>
                  )}
                </dl>
              </section>
            )}
          </>
        )}

        <AlertDialog
          open={confirmingDelete}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmingDelete(false);
              deleteMutation.reset();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Shift Report</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this shift report? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteMutation.isError && (
              <ErrorAlert error={deleteMutation.error} fallback="Failed to delete shift report" />
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate()}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </>
  );
}
