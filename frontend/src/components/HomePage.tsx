import { useEffect, useState } from "react";
import Navbar from "./Navbar";

const API_BASE = "http://localhost:4000";

export default function HomePage() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <>
      <Navbar />
      <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
        <h1>Lost Dog and Cat Rescue</h1>
        <p>Backend status: {status}</p>
      </main>
    </>
  );
}
