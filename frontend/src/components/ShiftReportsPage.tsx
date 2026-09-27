import { Link } from "react-router";
import { Plus } from "lucide-react";
import { buttonVariants } from "./ui/button";
import ShiftReportsTable from "./ShiftReportsTable";
import Navbar from "./Navbar";

export default function ShiftReportsPage() {
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
        <ShiftReportsTable />
      </main>
    </>
  );
}
