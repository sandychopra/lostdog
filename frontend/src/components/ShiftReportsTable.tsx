import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { shiftTypeLabel, type ShiftType } from "shared/constants/shiftType.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { FoodAmount } from "shared/constants/foodAmount.ts";
import { SplitShiftPosition } from "shared/constants/splitShiftPosition.ts";
import { ShiftReportStatus } from "shared/constants/shiftReportStatus.ts";
import type { ReportableKennelState } from "shared/constants/kennelState.ts";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Skeleton } from "./ui/skeleton";
import { Card } from "./ui/card";
import { DesktopOnly, MobileCardList } from "./ResponsiveList";

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
}

export interface CatEntry {
  id: number;
  entryType: CatEntryType;
  catId: number | null;
  groupId: number | null;
  cat: { id: number; name: string } | null;
  group: { id: number; bonded: boolean; cats: { id: number; name: string }[] } | null;
  fecalScores: number[];
  fecalEmpty: boolean;
  pee: boolean;
  peePoopNotes: string | null;
  dryFoodAmount: FoodAmount | null;
  foodNotes: string | null;
  wetFoodAmount: FoodAmount | null;
  groupDetails: GroupEntryCatDetail[];
  photos: ShiftReportPhoto[];
}

export interface MeetAndGreet {
  id: number;
  note: string | null;
  cats: { catId: number; cat: { id: number; name: string } }[];
}

export interface PlayGroup {
  id: number;
  note: string | null;
  cats: { catId: number; cat: { id: number; name: string } }[];
}

export interface MedicalNote {
  id: number;
  catId: number;
  note: string;
  cat: { id: number; name: string };
}

export interface ShiftReport {
  id: number;
  authorId: string;
  author: { id: string; name: string };
  shiftType: ShiftType | null;
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
  medicalNotes: MedicalNote[];
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

export interface ShiftReportFilters {
  catId?: number;
  kennelId?: number;
  from?: string;
  to?: string;
}

export const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;
export const DEFAULT_PAGE_SIZE = 10;

interface ShiftReportsTableProps {
  filters?: ShiftReportFilters;
  /** 1-based. */
  page?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

export default function ShiftReportsTable({
  filters = {},
  page = 1,
  onPageChange,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageSizeChange,
}: ShiftReportsTableProps) {
  const { data, isLoading, isPlaceholderData, error } = useQuery({
    queryKey: ["shiftReports", "list", filters, page, pageSize],
    queryFn: async () => {
      const { data } = await api.get<{ shiftReports: ShiftReport[]; total: number }>(
        "/api/shift-reports",
        {
          params: { ...filters, limit: pageSize, offset: (page - 1) * pageSize },
        },
      );
      return data;
    },
    // Keep showing the current page while the next one loads, instead of
    // flashing back to skeletons.
    placeholderData: keepPreviousData,
  });
  const shiftReports = data?.shiftReports;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  if (error) {
    return <ErrorAlert message="Failed to fetch shift reports" />;
  }

  return (
    <>
      <MobileCardList isLoading={isLoading}>
        {shiftReports?.map((report) => (
          <Link key={report.id} to={`/shift-reports/${report.id}`} className="block">
            <Card className="gap-1 px-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-medium text-blue">
                  {formatReportDate(report.date)} · {shiftTypeLabel(report.shiftType)}
                </span>
                <Badge variant={shiftReportStatusBadgeVariant(report.status)}>
                  {SHIFT_REPORT_STATUS_LABELS[report.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span>{report.author.name}</span>
                {report.isSplitShift && <SplitBadge report={report} />}
              </div>
            </Card>
          </Link>
        ))}
      </MobileCardList>
      <DesktopOnly>
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
                      <Link
                        to={`/shift-reports/${report.id}`}
                        className="text-blue hover:underline"
                      >
                        {formatReportDate(report.date)}
                      </Link>
                    </TableCell>
                    <TableCell>{shiftTypeLabel(report.shiftType)}</TableCell>
                    <TableCell>{report.author.name}</TableCell>
                    <TableCell>
                      {report.isSplitShift ? <SplitBadge report={report} /> : "—"}
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
      </DesktopOnly>
      {shiftReports && shiftReports.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No shift reports match.</p>
      )}
      {onPageChange && data && data.total > 0 && (
        <nav
          aria-label="Pagination"
          className={cn(
            "mt-4 flex flex-wrap items-center justify-center gap-3",
            isPlaceholderData && "opacity-60",
          )}
        >
          {totalPages > 1 && (
            <>
              <Button
                variant="secondary"
                disabled={page <= 1 || isPlaceholderData}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {Math.min(page, totalPages)} of {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages || isPlaceholderData}
                onClick={() => onPageChange(page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {onPageSizeChange && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Per page
              <NativeSelect
                aria-label="Reports per page"
                className="w-20"
                value={String(pageSize)}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <NativeSelectOption key={size} value={String(size)}>
                    {size}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          )}
        </nav>
      )}
    </>
  );
}

function SplitBadge({ report }: { report: ShiftReport }) {
  return (
    <Badge variant="secondary">
      Split
      {report.splitShiftPosition ? ` (${splitShiftPositionLabel(report.splitShiftPosition)})` : ""}
    </Badge>
  );
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
