import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "./ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

interface CollapsibleSectionProps {
  title: string;
  count: number | string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  anchorId?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}

// Page-level section, distinct from CollapsibleEntryCard (which is styled for
// bordered per-entry cards with remove/save actions). Content stays mounted
// (forceMount, hidden via CSS rather than conditionally rendered) so a
// collapsed section's react-hook-form-registered fields keep their values.
export default function CollapsibleSection({
  title,
  count,
  collapsed,
  onToggleCollapsed,
  anchorId,
  headerExtra,
  children,
}: CollapsibleSectionProps) {
  return (
    <Collapsible asChild open={!collapsed} onOpenChange={onToggleCollapsed}>
      <section id={anchorId} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
            {collapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate text-lg font-semibold">{title}</span>
            <Badge variant="secondary">{count}</Badge>
          </CollapsibleTrigger>
          {headerExtra}
        </div>
        <CollapsibleContent forceMount className={collapsed ? "hidden" : "space-y-3"}>
          {children}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
