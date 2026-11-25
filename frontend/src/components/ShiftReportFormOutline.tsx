import type { ReactNode } from "react";

export type SectionKey =
  "kennelStatus" | "catEntries" | "playGroups" | "meetAndGreets" | "photos" | "notes";

interface OutlineItem {
  key: SectionKey;
  label: string;
  count: number;
  anchorId: string;
}

interface ShiftReportFormOutlineProps {
  items: OutlineItem[];
  onBeforeNavigate: (key: SectionKey) => void;
  /** Save status, pinned to the end of the bar so it's always in view. */
  status?: ReactNode;
}

// Sticky mini-nav of section pills with live counts, so a volunteer resuming
// a long form after being away can see what's filled in without scrolling.
export default function ShiftReportFormOutline({
  items,
  onBeforeNavigate,
  status,
}: ShiftReportFormOutlineProps) {
  return (
    <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 border-b border-input bg-white/95 px-1 py-2 backdrop-blur">
      {items.map((item) => (
        <a
          key={item.key}
          href={`#${item.anchorId}`}
          onClick={() => onBeforeNavigate(item.key)}
          className="whitespace-nowrap rounded-full border border-input px-3 py-1 text-xs hover:bg-muted"
        >
          {item.label} ({item.count})
        </a>
      ))}
      {status && <div className="ml-auto text-xs">{status}</div>}
    </div>
  );
}
