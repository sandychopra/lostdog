import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { Menu } from "lucide-react";
import { Role } from "shared/constants/role.ts";
import { authClient } from "../lib/auth-client";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

const NAV_ITEMS = [
  { to: "/announcements", label: "Announcements" },
  { to: "/shift-reports", label: "Shift Reports" },
  { to: "/cats", label: "Cats" },
  { to: "/kennels", label: "Kennels" },
  { to: "/photos", label: "Photos" },
  { to: "/users", label: "Users", adminOnly: true },
];

export default function Navbar() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await authClient.signOut();
    navigate("/login", { replace: true });
  };

  const items = session
    ? NAV_ITEMS.filter((item) => !item.adminOnly || session.user.role === Role.Admin)
    : [];

  return (
    <header className="border-b bg-white pt-[env(safe-area-inset-top)]">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:px-6">
        <Link to="/announcements" className="flex shrink-0 items-center gap-2">
          <img src="/logo.png" alt="" className="h-9 w-9" />
          <span className="text-lg font-semibold text-navy">Lost Dog Rescue</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium text-blue hover:bg-muted",
                  isActive && "bg-muted text-navy",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <span className="text-sm">{session?.user.name}</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        <Button
          variant="ghost"
          className="h-11 w-11 p-0 md:hidden"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="size-6 text-navy" />
        </Button>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle className="text-navy">{session?.user.name}</SheetTitle>
            <SheetDescription className="sr-only">Main navigation</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col px-2">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-12 items-center rounded-lg px-3 text-base font-medium text-blue",
                    isActive && "bg-muted text-navy",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-auto p-4">
            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
