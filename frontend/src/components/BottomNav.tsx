import { useState, type ComponentType } from "react";
import { Link, NavLink, useLocation } from "react-router";
import {
  Camera,
  Cat,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  Plus,
  UserCog,
} from "lucide-react";
import { Role } from "shared/constants/role.ts";
import { authClient } from "../lib/auth-client";
import { cn } from "../lib/utils";
import { useSignOut } from "./Navbar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

const MORE_ITEMS: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}[] = [
  { to: "/kennels", label: "Kennels", icon: LayoutGrid },
  { to: "/photos", label: "Photos", icon: Camera },
  { to: "/users", label: "Users", icon: UserCog, adminOnly: true },
];

const tabClass =
  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const activeTabClass = "font-bold text-navy";

function isReportFormPath(pathname: string) {
  return pathname === "/shift-reports/new" || /^\/shift-reports\/\d+\/edit$/.test(pathname);
}

/** Phone navigation: four tabs plus a raised gold "New report" button in the middle. */
export default function BottomNav() {
  const { data: session } = authClient.useSession();
  const { pathname } = useLocation();
  const signOut = useSignOut();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!session) return null;
  const isAdmin = session.user.role === Role.Admin;
  const moreItems = MORE_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const moreActive = moreItems.some((item) => pathname.startsWith(item.to));
  const onReportForm = isReportFormPath(pathname);

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-1 pt-1 pb-1">
          <NavLink
            to="/notifications"
            className={({ isActive }) => cn(tabClass, isActive && activeTabClass)}
          >
            <Megaphone className="size-6" />
            Updates
          </NavLink>
          <NavLink
            to="/cats"
            className={({ isActive }) => cn(tabClass, isActive && activeTabClass)}
          >
            <Cat className="size-6" />
            Cats
          </NavLink>
          <Link
            to="/shift-reports/new"
            aria-current={onReportForm ? "page" : undefined}
            className={cn(tabClass, "font-bold text-navy")}
          >
            <span className="-mt-7 grid size-14 place-content-center rounded-full border-4 border-white bg-gold text-navy shadow-[0_6px_14px_-6px_rgb(0_31_112/0.6)]">
              <Plus className="size-7" strokeWidth={2.5} />
            </span>
            New report
          </Link>
          <NavLink
            to="/shift-reports"
            className={() =>
              cn(tabClass, pathname.startsWith("/shift-reports") && !onReportForm && activeTabClass)
            }
          >
            <ClipboardList className="size-6" />
            Reports
          </NavLink>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(tabClass, "cursor-pointer", moreActive && activeTabClass)}
          >
            <Menu className="size-6" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pr-[env(safe-area-inset-right)] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)]"
        >
          <SheetHeader>
            <SheetTitle className="text-navy">{session.user.name}</SheetTitle>
            <SheetDescription className="sr-only">More pages</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col px-2">
            {moreItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-12 items-center gap-3 rounded-lg px-3 text-base text-navy",
                    isActive && "bg-muted font-bold",
                  )
                }
              >
                <Icon className="size-5 text-blue" />
                {label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                void signOut();
              }}
              className="mt-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-t px-3 text-base text-navy"
            >
              <LogOut className="size-5 text-blue" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
