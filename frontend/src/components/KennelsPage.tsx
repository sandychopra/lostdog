import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ClipboardList } from "lucide-react";
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
import KennelForm from "./KennelForm";
import KennelMoveRequestForm from "./KennelMoveRequestForm";
import KennelPrepChecklistForm from "./KennelPrepChecklistForm";
import KennelsTable, { type Kennel, type KennelMoveRequest } from "./KennelsTable";
import Navbar from "./Navbar";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; kennel: Kennel }
  | { mode: "request-move"; kennel: Kennel }
  | { mode: "create-checklist" }
  | null;

export default function KennelsPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.Admin;

  const [dialog, setDialog] = useState<DialogState>(null);
  const [deletingKennel, setDeletingKennel] = useState<Kennel | null>(null);
  const queryClient = useQueryClient();

  const close = () => setDialog(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/kennels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
      setDeletingKennel(null);
    },
  });

  const cancelMoveRequestMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/kennel-move-requests/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kennel-move-requests"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Kennels</h1>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDialog({ mode: "create-checklist" })}>
                <ClipboardList className="mr-1 h-4 w-4" />
                New Checklist
              </Button>
              <Button onClick={() => setDialog({ mode: "create" })}>
                <Plus className="mr-1 h-4 w-4" />
                New Kennel
              </Button>
            </div>
          )}
        </div>
        <KennelsTable
          onEdit={(kennel) => setDialog({ mode: "edit", kennel })}
          onDelete={(kennel) => setDeletingKennel(kennel)}
          onRequestMove={(kennel) => setDialog({ mode: "request-move", kennel })}
          onCancelMoveRequest={(request: KennelMoveRequest) =>
            cancelMoveRequestMutation.mutate(request.id)
          }
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
                  <DialogTitle>
                    {dialog?.mode === "edit"
                      ? "Edit Kennel"
                      : dialog?.mode === "request-move"
                        ? "Request Kennel Move"
                        : dialog?.mode === "create-checklist"
                          ? "New Kennel Prep Checklist"
                          : "Create Kennel"}
                  </DialogTitle>
                </DialogHeader>
                {dialog?.mode === "request-move" ? (
                  <KennelMoveRequestForm kennel={dialog.kennel} onSuccess={close} />
                ) : dialog?.mode === "create-checklist" ? (
                  <KennelPrepChecklistForm onSuccess={close} />
                ) : (
                  <KennelForm
                    key={dialog?.mode === "edit" ? dialog.kennel.id : "create"}
                    kennel={dialog?.mode === "edit" ? dialog.kennel : undefined}
                    onSuccess={close}
                  />
                )}
              </DialogContent>
            </Dialog>
            <AlertDialog
              open={deletingKennel !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setDeletingKennel(null);
                  deleteMutation.reset();
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Kennel</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete kennel {deletingKennel?.number}? This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteMutation.isError && (
                  <ErrorAlert error={deleteMutation.error} fallback="Failed to delete kennel" />
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deletingKennel && deleteMutation.mutate(deletingKennel.id)}
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
