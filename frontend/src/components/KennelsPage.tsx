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
import KennelForm from "./KennelForm";
import KennelMoveRequestForm from "./KennelMoveRequestForm";
import KennelsTable, { type Kennel, type KennelMoveRequest } from "./KennelsTable";
import AppLayout from "./AppLayout";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; kennel: Kennel }
  | { mode: "request-move"; kennel: Kennel }
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
    <AppLayout width="5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Kennels</h1>
        {isAdmin && (
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="mr-1 h-4 w-4" />
            New Kennel
          </Button>
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
                      : "Create Kennel"}
                </DialogTitle>
              </DialogHeader>
              {dialog?.mode === "request-move" ? (
                <KennelMoveRequestForm kennel={dialog.kennel} onSuccess={close} />
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
                  Kennel {deletingKennel?.number} will be removed from the roster. Its past shift
                  reports and history are kept, and adding kennel {deletingKennel?.number} again
                  restores it.
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
    </AppLayout>
  );
}
