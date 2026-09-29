import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/utils";

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto rounded-lg border border-border">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-secondary", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:bg-secondary/50", className)} {...props} />;
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("px-4 py-3 text-left font-semibold text-navy", className)} {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3", className)} {...props} />;
}

interface SortableTableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  active: boolean;
  direction: "asc" | "desc";
  onSort: () => void;
}

// No table library in this repo — a small client-side sortable header, used by
// AnnouncementsPage, that flips asc/desc on click and shows which column (if
// any) the currently-loaded rows are sorted by.
export function SortableTableHead({
  active,
  direction,
  onSort,
  className,
  children,
  ...props
}: SortableTableHeadProps) {
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ChevronUp : ChevronDown;
  return (
    <TableHead
      className={cn("cursor-pointer select-none", className)}
      onClick={onSort}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    </TableHead>
  );
}
