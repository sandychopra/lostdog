import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import { Role } from "shared/constants/role.ts";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import ErrorAlert from "./ErrorAlert";
import CatForm from "./CatForm";
import CatsTable, { type Cat } from "./CatsTable";
import Navbar from "./Navbar";

type DialogState = { mode: "create" } | { mode: "edit"; cat: Cat } | null;

export default function CatsPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.Admin;

  const [dialog, setDialog] = useState<DialogState>(null);
  const [deletingCat, setDeletingCat] = useState<Cat | null>(null);
  const queryClient = useQueryClient();

  const close = () => setDialog(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/cats/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cats"] });
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
      setDeletingCat(null);
    },
  });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Cats</h1>
          {isAdmin && (
            <Button onClick={() => setDialog({ mode: "create" })}>
              <Plus className="mr-1 h-4 w-4" />
              New Cat
            </Button>
          )}
        </div>
        <CatsTable
          onEdit={(cat) => setDialog({ mode: "edit", cat })}
          onDelete={(cat) => setDeletingCat(cat)}
        />
        {isAdmin && (
          <>
            <Dialog
              open={dialog !== null}
              onOpenChange={(open) => {
                if (!open) close();
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{dialog?.mode === "edit" ? "Edit Cat" : "Create Cat"}</DialogTitle>
                </DialogHeader>
                <CatForm
                  key={dialog?.mode === "edit" ? dialog.cat.id : "create"}
                  cat={dialog?.mode === "edit" ? dialog.cat : undefined}
                  onSuccess={close}
                />
              </DialogContent>
            </Dialog>
            <AlertDialog
              open={deletingCat !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setDeletingCat(null);
                  deleteMutation.reset();
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Cat</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {deletingCat?.name}? This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteMutation.isError && (
                  <ErrorAlert error={deleteMutation.error} fallback="Failed to delete cat" />
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deletingCat && deleteMutation.mutate(deletingCat.id)}
                  >
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </main>
    </>
  );
}
