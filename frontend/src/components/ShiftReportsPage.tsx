import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { api } from "../lib/api";
import { catOptionLabel, useCatOptions } from "../lib/useCatOptions";
import { Button, buttonVariants } from "./ui/button";
import { Label } from "./ui/label";
import ShiftReportsTable, { REPORTS_PAGE_SIZE } from "./ShiftReportsTable";
import Navbar from "./Navbar";

const fieldClassName =
  "flex h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function ShiftReportsPage() {
  const [catId, setCatId] = useState("");
  const [kennelId, setKennelId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(REPORTS_PAGE_SIZE);

  const { data: cats } = useCatOptions();
  const { data: kennels } = useQuery({
    queryKey: ["kennels"],
    queryFn: async () => {
      const { data } = await api.get<{ kennels: { id: number; number: number }[] }>("/api/kennels");
      return data.kennels;
    },
  });

  const filters = {
    ...(catId && { catId: Number(catId) }),
    ...(kennelId && { kennelId: Number(kennelId) }),
    ...(from && { from }),
    ...(to && { to }),
  };
  const hasFilters = Object.keys(filters).length > 0;

  function resetPaging<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setLimit(REPORTS_PAGE_SIZE);
    };
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Shift Reports</h1>
          <Link to="/shift-reports/new" className={buttonVariants({ variant: "default" })}>
            <Plus className="mr-1 h-4 w-4" />
            New Report
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="filterCat">Cat</Label>
            <select
              id="filterCat"
              className={fieldClassName}
              value={catId}
              onChange={(e) => resetPaging(setCatId)(e.target.value)}
            >
              <option value="">All cats</option>
              {cats?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {catOptionLabel(cat)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="filterKennel">Kennel</Label>
            <select
              id="filterKennel"
              className={fieldClassName}
              value={kennelId}
              onChange={(e) => resetPaging(setKennelId)(e.target.value)}
            >
              <option value="">All kennels</option>
              {kennels?.map((kennel) => (
                <option key={kennel.id} value={kennel.id}>
                  Kennel {kennel.number}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="filterFrom">From</Label>
            <input
              id="filterFrom"
              type="date"
              className={fieldClassName}
              value={from}
              onChange={(e) => resetPaging(setFrom)(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filterTo">To</Label>
            <input
              id="filterTo"
              type="date"
              className={fieldClassName}
              value={to}
              onChange={(e) => resetPaging(setTo)(e.target.value)}
            />
          </div>
          {hasFilters && (
            <Button
              variant="secondary"
              onClick={() => {
                setCatId("");
                setKennelId("");
                setFrom("");
                setTo("");
                setLimit(REPORTS_PAGE_SIZE);
              }}
            >
              Clear
            </Button>
          )}
        </div>
        {hasFilters && (
          <p className="-mt-3 mb-4 text-sm text-muted-foreground">
            Filtered results show submitted reports only.
          </p>
        )}

        <ShiftReportsTable
          filters={filters}
          limit={limit}
          onLoadMore={() => setLimit((l) => l + REPORTS_PAGE_SIZE)}
        />
      </main>
    </>
  );
}
