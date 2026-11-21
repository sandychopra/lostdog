import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import BottomNav from "./BottomNav";
import Navbar from "./Navbar";
import OfflineBanner from "./OfflineBanner";

const WIDTHS = {
  sm: "max-w-sm",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
} as const;

interface AppLayoutProps {
  children: ReactNode;
  width?: keyof typeof WIDTHS;
  className?: string;
}

/** Page shell for every signed-in screen: header, offline banner, and a padded main column. */
export default function AppLayout({ children, width = "5xl", className }: AppLayoutProps) {
  return (
    <>
      <Navbar />
      <OfflineBanner />
      <main
        className={cn(
          // Phones leave room at the bottom for the fixed BottomNav.
          "mx-auto w-full px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8 md:pb-8",
          WIDTHS[width],
          className,
        )}
      >
        {children}
      </main>
      <BottomNav />
    </>
  );
}
