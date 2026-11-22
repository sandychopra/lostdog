import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { api } from "../lib/api";
import { catOptionLabel, useCatOptions } from "../lib/useCatOptions";
import { Button, buttonVariants } from "./ui/button";
import { Label } from "./ui/label";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Input } from "./ui/input";
import ShiftReportsTable, { REPORTS_PAGE_SIZE } from "./ShiftReportsTable";
import AppLayout from "./AppLayout";

export default function ShiftReportsPage() {
  const [catId, setCatId] = useState("");
  const [kennelId, setKennelId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(REPORTS_PAGE_SIZE);

  const { data: cats } = useCatOptions();
  const { data: kennels } = useQuery({
    // Archived kennels included: their old reports should stay searchable.
    queryKey: ["kennels", "includeArchived"],
    queryFn: async () => {
      const { data } = await api.get<{
        kennels: { id: number; number: number; deletedAt: string | null }[];
      }>("/api/kennels?includeArchived=true");
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
    <AppLayout width="5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Shift Reports</h1>
        <Link to="/shift-reports/new" className={buttonVariants({ variant: "default" })}>
          <Plus className="mr-1 h-4 w-4" />
          New Report
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="w-full space-y-1 sm:w-auto">
          <Label htmlFor="filterCat">Cat</Label>
          <NativeSelect
            id="filterCat"
            className="w-full sm:w-fit"
            value={catId}
            onChange={(e) => resetPaging(setCatId)(e.target.value)}
          >
            <NativeSelectOption value="">All cats</NativeSelectOption>
            {cats?.map((cat) => (
              <NativeSelectOption key={cat.id} value={cat.id}>
                {catOptionLabel(cat)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="w-full space-y-1 sm:w-auto">
          <Label htmlFor="filterKennel">Kennel</Label>
          <NativeSelect
            id="filterKennel"
            className="w-full sm:w-fit"
            value={kennelId}
            onChange={(e) => resetPaging(setKennelId)(e.target.value)}
          >
            <NativeSelectOption value="">All kennels</NativeSelectOption>
            {kennels?.map((kennel) => (
              <NativeSelectOption key={kennel.id} value={kennel.id}>
                Kennel {kennel.number}
                {kennel.deletedAt && " (archived)"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="w-full space-y-1 sm:w-auto">
          <Label htmlFor="filterFrom">From</Label>
          <Input
            id="filterFrom"
            type="date"
            className="w-full sm:w-auto"
            value={from}
            onChange={(e) => resetPaging(setFrom)(e.target.value)}
          />
        </div>
        <div className="w-full space-y-1 sm:w-auto">
          <Label htmlFor="filterTo">To</Label>
          <Input
            id="filterTo"
            type="date"
            className="w-full sm:w-auto"
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
    </AppLayout>
  );
}
