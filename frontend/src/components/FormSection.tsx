import type { ReactNode } from "react";
import { Badge } from "./ui/badge";

interface FormSectionProps {
  title: string;
  count: number | string;
  /** Target for the summary bar's jump links. */
  anchorId?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}

/** A titled section of the shift report form. Always open — nothing collapses. */
export default function FormSection({
  title,
  count,
  anchorId,
  headerExtra,
  children,
}: FormSectionProps) {
  return (
    <section id={anchorId} className="scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2">
          <span className="truncate text-lg font-semibold">{title}</span>
          <Badge variant="secondary">{count}</Badge>
        </h2>
        {headerExtra}
      </div>
      {children}
    </section>
  );
}
