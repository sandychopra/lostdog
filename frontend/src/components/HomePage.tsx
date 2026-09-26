import { useEffect, useState } from "react";
import { API_BASE } from "../lib/config";
import Navbar from "./Navbar";

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
