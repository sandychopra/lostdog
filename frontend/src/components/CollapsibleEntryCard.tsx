import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

interface CollapsibleEntryCardProps {
  title: string;
  summary?: ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onRemove?: () => void;
  onSave?: () => void;
  variant?: "default" | "nested";
  children: ReactNode;
}

// Content stays mounted (forceMount, hidden via CSS rather than conditionally rendered) so a
// collapsed entry's react-hook-form-registered fields keep their values
// instead of being unmounted and silently dropped from the form state.
export default function CollapsibleEntryCard({
  title,
  summary,
  collapsed,
  onToggleCollapsed,
  onRemove,
  onSave,
  variant = "default",
  children,
}: CollapsibleEntryCardProps) {
  const nested = variant === "nested";

  return (
    <Collapsible
      open={!collapsed}
      onOpenChange={onToggleCollapsed}
      className={
        nested
          ? "space-y-2 rounded-md border border-input/60 bg-muted/30 p-3"
          : "space-y-3 rounded-md border border-input p-4"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0" />
          )}
          <span
            className={nested ? "truncate text-sm font-medium" : "truncate text-sm font-semibold"}
          >
            {title}
          </span>
          {collapsed && summary && (
            <span className="flex flex-wrap items-center gap-1">{summary}</span>
          )}
        </CollapsibleTrigger>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Remove entry"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <CollapsibleContent
        forceMount
        className={collapsed ? "hidden" : nested ? "space-y-2" : "space-y-3"}
      >
        {children}
        {onSave && (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onSave}>
              Collapse
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
