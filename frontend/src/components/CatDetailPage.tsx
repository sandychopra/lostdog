import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ActivityEntityType } from "shared/constants/activityLog.ts";
import { api } from "../lib/api";
import ActivitySection from "./ActivitySection";
import AuthenticatedImage from "./AuthenticatedImage";
import ErrorAlert from "./ErrorAlert";
import Navbar from "./Navbar";
import { CAT_STATUS_LABELS, catStatusBadgeVariant, type Cat } from "./CatsTable";
import { formatReportDate } from "./ShiftReportsTable";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";

interface NamedCat {
  id: number;
  name: string;
}

interface HistoryEntry {
  id: number;
  entryType: "Individual" | "Group";
  fecalScore: number | null;
  pee: boolean;
  peePoopNotes: string | null;
  dryFoodAmount: string | null;
  wetFoodAmount: string | null;
  foodNotes: string | null;
  medicalNotes: string | null;
  otherNotes: string | null;
  group: { id: number; cats: NamedCat[] } | null;
  groupDetails: {
    wetFoodAmount: string | null;
    foodNotes: string | null;
    medicalNotes: string | null;
    otherNotes: string | null;
  }[];
}

interface NoteGroup {
  id: number;
  note: string;
  cats: { cat: NamedCat }[];
}

interface HistoryReport {
  id: number;
  date: string;
  shiftType: string;
  author: { id: string; name: string };
  catEntries: HistoryEntry[];
  meetAndGreets: NoteGroup[];
  playGroups: NoteGroup[];
  photos: { id: number }[];
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}

function EntryDetails({ entry }: { entry: HistoryEntry }) {
  // A group entry carries shared fields plus this cat's own per-cat details.
  const own = entry.entryType === "Group" ? entry.groupDetails[0] : entry;
  return (
    <div className="space-y-0.5 text-sm">
      {entry.group && (
        <p className="text-muted-foreground">
          Group entry with {entry.group.cats.map((c) => c.name).join(", ")}
        </p>
      )}
      <Detail label="Fecal score" value={entry.fecalScore?.toString()} />
      <Detail label="Pee" value={entry.pee ? "Yes" : null} />
      <Detail label="Pee/poop notes" value={entry.peePoopNotes} />
      <Detail label="Dry food" value={entry.dryFoodAmount} />
      <Detail label="Wet food" value={own?.wetFoodAmount} />
      <Detail label="Food notes" value={own?.foodNotes ?? entry.foodNotes} />
      <Detail label="Medical" value={own?.medicalNotes} />
      <Detail label="Other" value={own?.otherNotes ?? entry.otherNotes} />
    </div>
  );
}

function ageLabel(cat: Cat): string {
  const parts = [
    cat.ageYears ? `${cat.ageYears}y` : null,
    cat.ageMonths ? `${cat.ageMonths}m` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "—";
}

export default function CatDetailPage() {
  const id = Number(useParams().id);

  const catQuery = useQuery({
    queryKey: ["cats", id],
    queryFn: async () =>
      (await api.get<{ cat: Cat & { active: boolean } }>(`/api/cats/${id}`)).data.cat,
  });
  const historyQuery = useQuery({
    queryKey: ["catHistory", id],
    queryFn: async () =>
      (await api.get<{ history: HistoryReport[] }>(`/api/cats/${id}/history`)).data.history,
  });

  const cat = catQuery.data;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl space-y-8 px-6 py-8">
        {catQuery.error ? (
          <ErrorAlert message="Cat not found" />
        ) : !cat ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <section className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{cat.name}</h1>
              <Badge variant={catStatusBadgeVariant(cat.status)}>
                {CAT_STATUS_LABELS[cat.status]}
              </Badge>
              {!cat.active && <Badge variant="outline">Inactive (returned to RCC)</Badge>}
            </div>
            <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
              <Detail label="Age" value={ageLabel(cat)} />
              <Detail label="Sex" value={cat.sex} />
              <Detail label="Color/pattern" value={cat.colorPattern} />
              <Detail label="Collar" value={cat.collarColor} />
              <Detail label="Microchip" value={cat.microchipNumber} />
              <Detail
                label="Kennel"
                value={
                  (cat.kennel ?? cat.group?.kennel)
                    ? `Kennel ${(cat.kennel ?? cat.group?.kennel)!.number}`
                    : null
                }
              />
              <Detail label="Dewormer" value={cat.dewormerStatus} />
              <Detail label="Needs probiotic" value={cat.needsProbiotic ? "Yes" : null} />
              <Detail
                label="Pickup"
                value={cat.pickupAt ? new Date(cat.pickupAt).toLocaleString() : null}
              />
              <Detail label="Bonded pair" value={cat.group?.bonded ? "Yes" : null} />
              <Detail
                label="Siblings"
                value={
                  cat.litter
                    ? cat.litter.cats
                        .filter((c) => c.id !== cat.id)
                        .map((c) => c.name)
                        .join(", ") || null
                    : null
                }
              />
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Report history</h2>
          {historyQuery.error ? (
            <ErrorAlert message="Failed to fetch report history" />
          ) : historyQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : historyQuery.data && historyQuery.data.length > 0 ? (
            historyQuery.data.map((report) => (
              <article key={report.id} className="space-y-2 rounded-md border p-3">
                <header className="flex flex-wrap items-baseline gap-x-3 text-sm">
                  <Link
                    to={`/shift-reports/${report.id}`}
                    className="font-medium text-blue hover:underline"
                  >
                    {formatReportDate(report.date)} · {report.shiftType}
                  </Link>
                  <span className="text-muted-foreground">by {report.author.name}</span>
                </header>
                {report.catEntries.map((entry) => (
                  <EntryDetails key={entry.id} entry={entry} />
                ))}
                {report.meetAndGreets.map((m) => (
                  <p key={`m${m.id}`} className="text-sm">
                    <span className="text-muted-foreground">Meet &amp; greet: </span>
                    {m.note}
                  </p>
                ))}
                {report.playGroups.map((p) => (
                  <p key={`p${p.id}`} className="text-sm">
                    <span className="text-muted-foreground">
                      Play with {p.cats.map((c) => c.cat.name).join(", ")}:{" "}
                    </span>
                    {p.note}
                  </p>
                ))}
                {report.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {report.photos.map((photo) => (
                      <AuthenticatedImage
                        key={photo.id}
                        photoId={photo.id}
                        alt={`Photo of ${cat?.name ?? "cat"}`}
                        className="h-24 w-24 rounded object-cover"
                      />
                    ))}
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No submitted reports mention this cat yet.
            </p>
          )}
        </section>

        <ActivitySection entityType={ActivityEntityType.Cat} entityId={id} />
      </main>
    </>
  );
}
