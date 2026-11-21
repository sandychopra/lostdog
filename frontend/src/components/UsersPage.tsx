import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "../lib/api";
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
import UserForm from "./UserForm";
import UsersTable from "./UsersTable";
import { Role } from "shared/constants/role.ts";
import AppLayout from "./AppLayout";

interface EditingUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface DeletingUser {
  id: string;
  name: string;
}

type DialogState = { mode: "create" } | { mode: "edit"; user: EditingUser } | null;

export default function UsersPage() {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deletingUser, setDeletingUser] = useState<DeletingUser | null>(null);
  const queryClient = useQueryClient();

  const close = () => setDialog(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeletingUser(null);
    },
  });

  return (
    <AppLayout width="4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Users</h1>
        <Button onClick={() => setDialog({ mode: "create" })}>
          <Plus className="mr-1 h-4 w-4" />
          New User
        </Button>
      </div>
      <UsersTable
        onEdit={(user) => setDialog({ mode: "edit", user })}
        onDelete={(user) => setDeletingUser(user)}
      />
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Edit User" : "Create User"}</DialogTitle>
          </DialogHeader>
          <UserForm
            key={dialog?.mode === "edit" ? dialog.user.id : "create"}
            user={dialog?.mode === "edit" ? dialog.user : undefined}
            onSuccess={close}
          />
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={deletingUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingUser(null);
            deleteMutation.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingUser?.name}? They will no longer be able to
              log in, but their account and past shift reports will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.isError && <ErrorAlert message="Failed to delete user" />}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
