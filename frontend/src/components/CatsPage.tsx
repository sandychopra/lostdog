import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users2 } from "lucide-react";
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
import CreateGroupForm from "./CreateGroupForm";
import EditGroupForm from "./EditGroupForm";
import SiblingsForm from "./SiblingsForm";
import CatStatusForm from "./CatStatusForm";
import ReturnToRccForm from "./ReturnToRccForm";
import CatsTable, { type Cat } from "./CatsTable";
import Navbar from "./Navbar";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; cat: Cat }
  | { mode: "group" }
  | { mode: "edit-group"; cat: Cat }
  | { mode: "siblings"; cat: Cat }
  | { mode: "status"; cat: Cat }
  | { mode: "returned-to-rcc"; cat: Cat }
  | null;

export default function CatsPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.Admin;

  const [dialog, setDialog] = useState<DialogState>(null);
  const [deletingCat, setDeletingCat] = useState<Cat | null>(null);
  const [removingFromGroup, setRemovingFromGroup] = useState<Cat | null>(null);
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

  const removeFromGroupMutation = useMutation({
    mutationFn: (cat: Cat) => api.delete(`/api/groups/${cat.groupId}/cats/${cat.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cats"] });
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
      setRemovingFromGroup(null);
    },
  });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Cats</h1>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDialog({ mode: "group" })}>
                <Users2 className="mr-1 h-4 w-4" />
                New Group
              </Button>
              <Button onClick={() => setDialog({ mode: "create" })}>
                <Plus className="mr-1 h-4 w-4" />
                New Cat
              </Button>
            </div>
          )}
        </div>
        <CatsTable
          onEdit={(cat) => setDialog({ mode: "edit", cat })}
          onDelete={(cat) => setDeletingCat(cat)}
          onRemoveFromGroup={(cat) => setRemovingFromGroup(cat)}
          onEditGroup={(cat) => setDialog({ mode: "edit-group", cat })}
          onManageSiblings={(cat) => setDialog({ mode: "siblings", cat })}
          onChangeStatus={(cat) => setDialog({ mode: "status", cat })}
          onReturnToRcc={(cat) => setDialog({ mode: "returned-to-rcc", cat })}
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
                      ? "Edit Cat"
                      : dialog?.mode === "group"
                        ? "Create Group"
                        : dialog?.mode === "edit-group"
                          ? "Edit Group"
                          : dialog?.mode === "siblings"
                            ? `Siblings — ${dialog.cat.name}`
                            : dialog?.mode === "status"
                              ? `Change Status — ${dialog.cat.name}`
                              : dialog?.mode === "returned-to-rcc"
                                ? `Return to RCC — ${dialog.cat.name}`
                                : "Create Cat"}
                  </DialogTitle>
                </DialogHeader>
                {dialog?.mode === "group" ? (
                  <CreateGroupForm onSuccess={close} />
                ) : dialog?.mode === "edit-group" ? (
                  <EditGroupForm groupId={dialog.cat.groupId!} />
                ) : dialog?.mode === "siblings" ? (
                  <SiblingsForm catId={dialog.cat.id} />
                ) : dialog?.mode === "status" ? (
                  <CatStatusForm cat={dialog.cat} onSuccess={close} />
                ) : dialog?.mode === "returned-to-rcc" ? (
                  <ReturnToRccForm cat={dialog.cat} onSuccess={close} />
                ) : (
                  <CatForm
                    key={dialog?.mode === "edit" ? dialog.cat.id : "create"}
                    cat={dialog?.mode === "edit" ? dialog.cat : undefined}
                    onSuccess={close}
                  />
                )}
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
            <AlertDialog
              open={removingFromGroup !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setRemovingFromGroup(null);
                  removeFromGroupMutation.reset();
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove from Group</AlertDialogTitle>
                  <AlertDialogDescription>
                    Remove {removingFromGroup?.name} from its group? They&apos;ll no longer have a
                    kennel assigned — give them one from Edit afterward.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {removeFromGroupMutation.isError && (
                  <ErrorAlert
                    error={removeFromGroupMutation.error}
                    fallback="Failed to remove cat from group"
                  />
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      removingFromGroup && removeFromGroupMutation.mutate(removingFromGroup)
                    }
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
