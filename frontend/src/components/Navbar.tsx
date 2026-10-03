import { Link, useNavigate } from "react-router";
import { Role } from "shared/constants/role.ts";
import { authClient } from "../lib/auth-client";

export default function Navbar() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        borderBottom: "1px solid #ddd",
        fontFamily: "sans-serif",
      }}
    >
      <div className="flex items-center gap-4">
        {session && (
          <Link to="/cats" className="text-sm font-medium text-blue hover:underline">
            Cats
          </Link>
        )}
        {session && (
          <Link to="/kennels" className="text-sm font-medium text-blue hover:underline">
            Kennels
          </Link>
        )}
        {session && (
          <Link to="/shift-reports" className="text-sm font-medium text-blue hover:underline">
            Shift Reports
          </Link>
        )}
        {session && (
          <Link to="/announcements" className="text-sm font-medium text-blue hover:underline">
            Announcements
          </Link>
        )}
        {session?.user.role === Role.Admin && (
          <Link to="/users" className="text-sm font-medium text-blue hover:underline">
            Users
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span>{session?.user.name}</span>
        <button onClick={handleSignOut}>Sign out</button>
      </div>
    </nav>
  );
}
