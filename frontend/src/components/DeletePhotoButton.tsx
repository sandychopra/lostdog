import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import ErrorAlert from "./ErrorAlert";
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

interface DeletePhotoButtonProps {
  photoId: number;
  className?: string;
  onDeleted?: () => void;
}

// Shared by the shift-report form's photo section and the Photos browse page.
// Callers decide who sees it (uploader or Admin); the API enforces the same rule.
export default function DeletePhotoButton({
  photoId,
  className,
  onDeleted,
}: DeletePhotoButtonProps) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/photos/${photoId}`),
    onSuccess: () => {
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["shiftReports"] });
      queryClient.invalidateQueries({ queryKey: ["photos"] });
      queryClient.invalidateQueries({ queryKey: ["catHistory"] });
      queryClient.removeQueries({ queryKey: ["photoUrl", photoId] });
      queryClient.removeQueries({ queryKey: ["photoFile", photoId] });
      onDeleted?.();
    },
  });

  return (
    <>
      <button
        type="button"
        className={cn("text-destructive", className)}
        onClick={() => setConfirming(true)}
        aria-label="Delete photo"
      >
        <Trash2 className="h-3 w-3" />
      </button>
      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(false);
            deleteMutation.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this photo? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.isError && (
            <ErrorAlert error={deleteMutation.error} fallback="Failed to delete photo" />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                // Keep the dialog open until the delete succeeds, so an error shows here.
                e.preventDefault();
                deleteMutation.mutate();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
