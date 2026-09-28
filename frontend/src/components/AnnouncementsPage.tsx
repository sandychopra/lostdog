import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnnouncementType } from "shared/constants/announcementType.ts";
import { api } from "../lib/api";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Skeleton } from "./ui/skeleton";
import Navbar from "./Navbar";

interface Announcement {
  id: number;
  type: AnnouncementType;
  resolved: boolean;
  createdAt: string;
  cat: {
    id: number;
    name: string;
    status: string;
    kennel: { id: number; number: number } | null;
  } | null;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// NewArrival/ReturnedToRcc never get `resolved` written (see backend/src/routes/
// announcements.ts) — they're purely informational and just age out of the
// default view after 24h, so "Status" for these two reflects that instead of
// the (always-false) resolved flag.
function statusLabel(announcement: Announcement): {
  label: string;
  variant: "secondary" | "warning";
} {
  if (
    announcement.type === AnnouncementType.NewArrival ||
    announcement.type === AnnouncementType.ReturnedToRcc
  ) {
    const recent = Date.now() - new Date(announcement.createdAt).getTime() < TWENTY_FOUR_HOURS_MS;
    return recent
      ? { label: "Recent", variant: "warning" }
      : { label: "Archived", variant: "secondary" };
  }
  return announcement.resolved
    ? { label: "Resolved", variant: "secondary" }
    : { label: "Open", variant: "warning" };
}

const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
  [AnnouncementType.NewArrival]: "New Arrival",
  [AnnouncementType.PendingAdoption]: "Pending Adoption",
  [AnnouncementType.Adopted]: "Adopted",
  [AnnouncementType.BackAvailable]: "Back Available",
  [AnnouncementType.ReturnedToRcc]: "Returned to RCC",
  [AnnouncementType.ChecklistAssigned]: "Kennel Prep Checklist Assigned",
  [AnnouncementType.KennelMoveRequested]: "Kennel Move Requested",
};

export default function AnnouncementsPage() {
  const [viewAll, setViewAll] = useState(false);

  const {
    data: announcements,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["announcements", viewAll],
    queryFn: async () => {
      const { data } = await api.get<{ announcements: Announcement[] }>("/api/announcements", {
        params: viewAll ? { all: "true" } : {},
      });
      return data.announcements;
    },
  });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
          <Button variant="secondary" onClick={() => setViewAll((v) => !v)}>
            {viewAll ? "Show recent" : "View all"}
          </Button>
        </div>
        {error ? (
          <ErrorAlert message="Failed to fetch announcements" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Cat</TableHead>
                <TableHead>Kennel</TableHead>
                <TableHead>Date</TableHead>
                {viewAll && <TableHead>Status</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      {viewAll && (
                        <TableCell>
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                : announcements?.map((announcement) => (
                    <TableRow key={announcement.id}>
                      <TableCell>{ANNOUNCEMENT_TYPE_LABELS[announcement.type]}</TableCell>
                      <TableCell>{announcement.cat?.name ?? "—"}</TableCell>
                      <TableCell>{announcement.cat?.kennel?.number ?? "—"}</TableCell>
                      <TableCell>{new Date(announcement.createdAt).toLocaleString()}</TableCell>
                      {viewAll && (
                        <TableCell>
                          <Badge variant={statusLabel(announcement).variant}>
                            {statusLabel(announcement).label}
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
              {!isLoading && announcements?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={viewAll ? 5 : 4}
                    className="text-center text-muted-foreground"
                  >
                    No announcements to show.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </main>
    </>
  );
}
