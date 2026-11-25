import type { ReactNode } from "react";

export type SectionKey =
  | "kennelStatus"
  | "catEntries"
  | "medicalNotes"
  | "playGroups"
  | "meetAndGreets"
  | "photos"
  | "notes";

interface OutlineItem {
  key: SectionKey;
  label: string;
  count: number;
  anchorId: string;
}

interface ShiftReportFormOutlineProps {
  items: OutlineItem[];
  /** Save status, pinned to the end of the bar so it's always in view. */
  status?: ReactNode;
}

// Sticky mini-nav of section pills with live counts, so a volunteer resuming
// a long form after being away can see what's filled in without scrolling.
export default function ShiftReportFormOutline({ items, status }: ShiftReportFormOutlineProps) {
  return (
    // Page-coloured rather than a white box; still opaque so content scrolling
    // under the sticky bar stays hidden.
    <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 border-b border-input/60 bg-background px-1 py-2">
      {items.map((item) => (
        <a
          key={item.key}
          href={`#${item.anchorId}`}
          className="whitespace-nowrap rounded-full border border-navy bg-white px-3 py-1 text-xs font-medium text-navy transition-colors hover:bg-navy hover:text-white focus-visible:bg-navy focus-visible:text-white focus-visible:outline-none"
        >
          {item.label} ({item.count})
        </a>
      ))}
      {status && <div className="ml-auto text-xs">{status}</div>}
    </div>
  );
}
