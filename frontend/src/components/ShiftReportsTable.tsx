import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ShiftType } from "shared/constants/shiftType.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { FoodAmount } from "shared/constants/foodAmount.ts";
import { SplitShiftPosition } from "shared/constants/splitShiftPosition.ts";
import { ShiftReportStatus } from "shared/constants/shiftReportStatus.ts";
import type { ReportableKennelState } from "shared/constants/kennelState.ts";
import { api } from "../lib/api";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Skeleton } from "./ui/skeleton";

export interface PhotoTag {
  catId: number;
  cat: { id: number; name: string };
}

export interface ShiftReportPhoto {
  id: number;
  uploadedAt: string;
  catEntryId: number | null;
  tags: PhotoTag[];
  uploadedBy: { id: string; name: string };
}

export interface GroupEntryCatDetail {
  id: number;
  catId: number;
  cat: { id: number; name: string };
  wetFoodAmount: FoodAmount | null;
  foodNotes: string | null;
  medicalNotes: string | null;
  otherNotes: string | null;
}

export interface CatEntry {
  id: number;
  entryType: CatEntryType;
  catId: number | null;
  groupId: number | null;
  cat: { id: number; name: string } | null;
  group: { id: number; bonded: boolean; cats: { id: number; name: string }[] } | null;
  fecalScore: number | null;
  pee: boolean;
  peePoopNotes: string | null;
  dryFoodAmount: FoodAmount | null;
  foodNotes: string | null;
  otherNotes: string | null;
  wetFoodAmount: FoodAmount | null;
  medicalNotes: string | null;
  groupDetails: GroupEntryCatDetail[];
  photos: ShiftReportPhoto[];
}

export interface MeetAndGreet {
  id: number;
  note: string;
  cats: { catId: number; cat: { id: number; name: string } }[];
}

export interface PlayGroup {
  id: number;
  note: string;
  cats: { catId: number; cat: { id: number; name: string } }[];
}

export interface ShiftReport {
  id: number;
  authorId: string;
  author: { id: string; name: string };
  shiftType: ShiftType;
  date: string;
  isSplitShift: boolean;
  splitShiftPosition: SplitShiftPosition | null;
  status: ShiftReportStatus;
  submittedAt: string | null;
  cleaningNotes: string | null;
  suppliesNotes: string | null;
  kennelNotes: string | null;
  otherNotes: string | null;
  createdAt: string;
  updatedAt: string;
  catEntries: CatEntry[];
  meetAndGreets: MeetAndGreet[];
  playGroups: PlayGroup[];
  kennelsStatus: {
    kennelId: number;
    reportedState: ReportableKennelState;
    kennel: { id: number; number: number };
  }[];
  photos: ShiftReportPhoto[];
}

// `ShiftReport.date` is a date-only Postgres column, serialized as
// UTC-midnight ISO (e.g. "2026-09-27T00:00:00.000Z"). Parsing that with
// `new Date(...)` and formatting in a timezone behind UTC rolls it back a
// day, so this reads the y/m/d directly instead of going through UTC.
export function formatReportDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString();
}

export default function ShiftReportsTable() {
  const {
    data: shiftReports,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["shiftReports"],
    queryFn: async () => {
      const { data } = await api.get<{ shiftReports: ShiftReport[] }>("/api/shift-reports");
      return data.shiftReports;
    },
  });

  if (error) {
    return <ErrorAlert message="Failed to fetch shift reports" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Shift</TableHead>
          <TableHead>Author</TableHead>
          <TableHead>Split</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
              </TableRow>
            ))
          : shiftReports?.map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  <Link to={`/shift-reports/${report.id}`} className="text-blue hover:underline">
                    {formatReportDate(report.date)}
                  </Link>
                </TableCell>
                <TableCell>{shiftTypeLabel(report.shiftType)}</TableCell>
                <TableCell>{report.author.name}</TableCell>
                <TableCell>
                  {report.isSplitShift ? (
                    <Badge variant="secondary">
                      Split
                      {report.splitShiftPosition
                        ? ` (${splitShiftPositionLabel(report.splitShiftPosition)})`
                        : ""}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={shiftReportStatusBadgeVariant(report.status)}>
                    {SHIFT_REPORT_STATUS_LABELS[report.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}

function shiftTypeLabel(shiftType: ShiftType): string {
  if (shiftType === ShiftType.MidDay) return "Mid-day";
  return shiftType;
}

export function splitShiftPositionLabel(position: SplitShiftPosition): string {
  return position === SplitShiftPosition.First ? "First" : "Second";
}

export const SHIFT_REPORT_STATUS_LABELS: Record<ShiftReportStatus, string> = {
  [ShiftReportStatus.Draft]: "Draft",
  [ShiftReportStatus.Submitted]: "Submitted",
};

export function shiftReportStatusBadgeVariant(status: ShiftReportStatus): "outline" | "default" {
  return status === ShiftReportStatus.Draft ? "outline" : "default";
}
