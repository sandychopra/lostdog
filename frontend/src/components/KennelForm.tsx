import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createKennelSchema,
  updateKennelSchema,
  type CreateKennelInput,
  type UpdateKennelInput,
} from "shared/schemas/kennels.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";

interface KennelData {
  id: number;
  number: number;
  state: KennelState;
}

interface KennelFormProps {
  kennel?: KennelData;
  onSuccess: () => void;
}

export default function KennelForm({ kennel, onSuccess }: KennelFormProps) {
  const isEdit = !!kennel;
  const queryClient = useQueryClient();

  const form = useForm<CreateKennelInput | UpdateKennelInput>({
    resolver: zodResolver(isEdit ? updateKennelSchema : createKennelSchema),
    defaultValues: {
      number: kennel?.number,
      ...(isEdit ? { state: kennel.state } : {}),
    },
  });

  const stateError =
    "state" in form.formState.errors
      ? (form.formState.errors as { state?: { message?: string } }).state
      : undefined;

  const mutation = useMutation({
    mutationFn: async (payload: CreateKennelInput | UpdateKennelInput) => {
      if (isEdit) {
        const { data } = await api.put(`/api/kennels/${kennel.id}`, payload);
        return data.kennel;
      }
      const { data } = await api.post("/api/kennels", payload);
      return data.kennel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
      form.reset();
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
        <div className="space-y-2">
          <Label htmlFor="number">Number</Label>
          <Input
            id="number"
            type="number"
            placeholder="Kennel number"
            aria-invalid={!!form.formState.errors.number}
            {...form.register("number")}
          />
          <ErrorMessage message={form.formState.errors.number?.message} />
        </div>
        {isEdit && (
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <select
              id="state"
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...form.register("state")}
            >
              <option value={KennelState.Ready}>Ready</option>
              <option value={KennelState.Occupied}>Occupied</option>
              <option value={KennelState.NeedsReset}>Needs Reset</option>
              <option value={KennelState.Planned}>Planned</option>
            </select>
            <ErrorMessage message={stateError?.message} />
          </div>
        )}
      </div>
      <div className="shrink-0 space-y-4 pt-4">
        {mutation.error && (
          <ErrorAlert
            error={mutation.error}
            fallback={`Failed to ${isEdit ? "update" : "create"} kennel`}
          />
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {isEdit
              ? mutation.isPending
                ? "Saving..."
                : "Save Changes"
              : mutation.isPending
                ? "Creating..."
                : "Create Kennel"}
          </Button>
        </div>
      </div>
    </form>
  );
}
