import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { returnToRccSchema, type ReturnToRccInput } from "shared/schemas/catStatus.ts";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import ErrorAlert from "./ErrorAlert";
import type { Cat } from "./CatsTable";

interface ReturnToRccFormProps {
  cat: Cat;
  onSuccess: () => void;
}

export default function ReturnToRccForm({ cat, onSuccess }: ReturnToRccFormProps) {
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(returnToRccSchema),
    defaultValues: { reason: "" },
  });

  const mutation = useMutation({
    mutationFn: async (payload: ReturnToRccInput) => {
      const { data } = await api.patch(`/api/cats/${cat.id}/returned-to-rcc`, payload);
      return data.cat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cats"] });
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      mutation.reset();
      onSuccess();
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <p className="text-sm text-muted-foreground">
          {cat.name} will be removed from the active roster. Its kennel will be marked as needing
          reset. This reason is only visible to Admins.
        </p>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Textarea id="reason" placeholder="e.g. for observation" {...form.register("reason")} />
        </div>
      </div>
      <div className="shrink-0 space-y-4 pt-4">
        {mutation.error && (
          <ErrorAlert error={mutation.error} fallback="Failed to return cat to RCC" />
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="destructive" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Return to RCC"}
          </Button>
        </div>
      </div>
    </form>
  );
}
