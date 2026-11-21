import { Link, NavLink, useNavigate } from "react-router";
import { LogOut, Plus } from "lucide-react";
import { Role } from "shared/constants/role.ts";
import { authClient } from "../lib/auth-client";
import { useStartReportPath } from "../lib/useStartReportPath";
import { cn } from "../lib/utils";
import { buttonVariants } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export const NAV_ITEMS = [
  { to: "/announcements", label: "Announcements" },
  { to: "/shift-reports", label: "Shift Reports" },
  { to: "/cats", label: "Cats" },
  { to: "/kennels", label: "Kennels" },
  { to: "/photos", label: "Photos" },
  { to: "/users", label: "Users", adminOnly: true },
];

export function initialsOf(name: string | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function useSignOut() {
  const navigate = useNavigate();
  return async () => {
    await authClient.signOut();
    navigate("/login", { replace: true });
  };
}

const todayLabel = () =>
  new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

/**
 * The navy banner with a gold rule, framed like the foundation's logo. On
 * phones it only identifies the app and the day (navigation is the bottom
 * bar); from md up it also carries the nav links and "Start report".
 */
export default function Navbar() {
  const { data: session } = authClient.useSession();
  const signOut = useSignOut();
  const startReportPath = useStartReportPath();

  const items = session
    ? NAV_ITEMS.filter((item) => !item.adminOnly || session.user.role === Role.Admin)
    : [];

  return (
    <header className="border-b-4 border-gold bg-navy pt-[env(safe-area-inset-top)] text-white">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-4 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:px-6">
        <Link
          to="/announcements"
          className="flex shrink-0 items-center gap-3 rounded-md focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
        >
          <img src="/logo.png" alt="" className="h-11 w-11" />
          <span className="flex flex-col leading-tight md:hidden lg:flex">
            <span className="font-display text-[1.05rem] font-semibold tracking-tight">
              Lost Dog &amp; Cat Rescue
            </span>
            <span className="text-xs text-white/70">{todayLabel()}</span>
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/shift-reports"}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-3 py-1.5 text-sm whitespace-nowrap text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
                  isActive && "bg-white/15 font-bold text-white",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {session && (
            <Link
              to={startReportPath}
              className={cn(
                buttonVariants(),
                "hidden bg-gold font-bold text-navy hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none md:inline-flex",
              )}
            >
              <Plus className="size-4" />
              Start report
            </Link>
          )}
          {session && (
            <>
              <span
                aria-hidden="true"
                className="grid size-9 place-content-center rounded-full bg-white/15 text-sm font-bold md:hidden"
              >
                {initialsOf(session.user.name)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Account menu for ${session.user.name}`}
                  className="hidden size-9 cursor-pointer place-content-center rounded-full bg-white/15 text-sm font-bold hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none md:grid"
                >
                  {initialsOf(session.user.name)}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-2 py-1.5 text-sm font-bold text-navy">{session.user.name}</div>
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
