import { useNavigate } from "react-router";
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
      <span>{session?.user.name}</span>
      <button onClick={handleSignOut}>Sign out</button>
    </nav>
  );
}
