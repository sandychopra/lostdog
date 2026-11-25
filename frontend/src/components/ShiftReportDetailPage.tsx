import { formatFecalScore } from "shared/constants/fecalScore.ts";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { api } from "../lib/api";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { Card } from "./ui/card";
import AuthenticatedImage from "./AuthenticatedImage";
import ShiftReportHeader from "./ShiftReportHeader";
import type { CatEntry, ShiftReport } from "./ShiftReportsTable";
import AppLayout from "./AppLayout";

function CatEntrySummary({ entry }: { entry: CatEntry }) {
  const title =
    entry.entryType === CatEntryType.Individual
      ? entry.cat?.name
      : entry.group?.cats.map((c) => c.name).join(" / ");

  return (
    <Card size="sm" className="gap-2 p-4 text-base">
      <div className="flex items-center gap-2">
        <span className="font-medium">{title}</span>
        <Badge variant="secondary">{entry.entryType}</Badge>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Fecal score</dt>
        <dd>{formatFecalScore(entry) ?? "Not recorded"}</dd>
        <dt className="text-muted-foreground">Pee</dt>
        <dd>{entry.pee ? "Yes" : "No"}</dd>
        {entry.peePoopNotes && (
          <>
            <dt className="text-muted-foreground">Pee/Poop notes</dt>
            <dd>{entry.peePoopNotes}</dd>
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
      </dl>
      {entry.entryType === CatEntryType.Group && entry.groupDetails.length > 0 && (
        <div className="space-y-2">
          {entry.groupDetails.map((detail) => (
            <div key={detail.id} className="rounded-md bg-muted/40 p-2 text-sm">
              <p className="font-medium">{detail.cat.name}</p>
              <p className="text-muted-foreground">Wet food: {detail.wetFoodAmount ?? "—"}</p>
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
    </Card>
  );
}

export default function ShiftReportDetailPage() {
  const { id } = useParams();

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

  return (
    <AppLayout width="3xl">
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
          <div className="mt-4">
            <ShiftReportHeader report={report} mode="view" />
          </div>

          {report.kennelsStatus.length > 0 && (
            <section className="mt-6 space-y-2">
              <h2 className="text-lg font-semibold">Kennel Status</h2>
              <div className="flex flex-wrap gap-2">
                {report.kennelsStatus.map((k) => (
                  <Badge key={k.kennelId} variant="secondary">
                    #{k.kennel.number}: {k.reportedState}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6 space-y-3">
            <h2 className="text-lg font-semibold">Food &amp; Fecal Score</h2>
            {report.catEntries.length === 0 && (
              <p className="text-sm text-muted-foreground">No cat entries logged.</p>
            )}
            {report.catEntries.map((entry) => (
              <CatEntrySummary key={entry.id} entry={entry} />
            ))}
          </section>

          {report.medicalNotes.length > 0 && (
            <section className="mt-6 space-y-2">
              <h2 className="text-lg font-semibold">Medical Notes</h2>
              {report.medicalNotes.map((m) => (
                <Card key={m.id} size="sm" className="gap-0 p-3">
                  <p className="font-medium">{m.cat.name}</p>
                  <p className="whitespace-pre-line">{m.note}</p>
                </Card>
              ))}
            </section>
          )}

          {report.playGroups.length > 0 && (
            <section className="mt-6 space-y-2">
              <h2 className="text-lg font-semibold">Play Groups</h2>
              {report.playGroups.map((playGroup) => (
                <Card key={playGroup.id} size="sm" className="gap-0 p-3">
                  <p className="font-medium">{playGroup.cats.map((c) => c.cat.name).join(", ")}</p>
                  {playGroup.note && <p>{playGroup.note}</p>}
                </Card>
              ))}
            </section>
          )}

          {report.meetAndGreets.length > 0 && (
            <section className="mt-6 space-y-2">
              <h2 className="text-lg font-semibold">Meet & Greets</h2>
              {report.meetAndGreets.map((mg) => (
                <Card key={mg.id} size="sm" className="gap-0 p-3">
                  <p className="font-medium">{mg.cats.map((c) => c.cat.name).join(", ")}</p>
                  {mg.note && <p>{mg.note}</p>}
                </Card>
              ))}
            </section>
          )}

          {(report.cleaningNotes || report.suppliesNotes || report.otherNotes) && (
            <section className="mt-6 space-y-2">
              <h2 className="text-lg font-semibold">Overall Notes</h2>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
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
        </>
      )}
    </AppLayout>
  );
}
