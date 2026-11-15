import type { ReactNode } from "react";
import { Skeleton } from "./ui/skeleton";

// Wide tables become stacked cards on phones: render a MobileCardList (hidden
// from md up) next to the existing table wrapped in DesktopOnly.

export function MobileCardList({
  isLoading,
  children,
}: {
  isLoading?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 md:hidden">
      {isLoading
        ? Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        : children}
    </div>
  );
}

export function DesktopOnly({ children }: { children: ReactNode }) {
  return <div className="hidden md:block">{children}</div>;
}
