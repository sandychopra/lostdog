import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { changeCatStatusSchema, type ChangeCatStatusInput } from "shared/schemas/catStatus.ts";
import { CatStatus } from "shared/constants/catStatus.ts";
import { VALID_STATUS_TRANSITIONS } from "shared/constants/catStatusTransitions.ts";
import { api } from "../lib/api";
import { toDateTimeInputValue } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import type { Cat } from "./CatsTable";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const CAT_STATUS_LABELS: Record<CatStatus, string> = {
  [CatStatus.Available]: "Available",
  [CatStatus.PendingAdoption]: "Pending Adoption",
  [CatStatus.Adopted]: "Adopted",
  [CatStatus.PickedUp]: "Picked Up",
};

interface CatStatusFormProps {
  cat: Cat;
  onSuccess: () => void;
}

export default function CatStatusForm({ cat, onSuccess }: CatStatusFormProps) {
  const queryClient = useQueryClient();

  // The current status is included as an option when it's Pending/Adopted so an
  // Admin can reschedule pickupAt without actually changing status (see
  // shared/lib/catStatus.ts's same-status no-op path).
  const targets = VALID_STATUS_TRANSITIONS[cat.status];
  const options = [
    ...(cat.status === CatStatus.PendingAdoption || cat.status === CatStatus.Adopted
      ? [cat.status]
      : []),
    ...targets,
  ];

  const form = useForm<ChangeCatStatusInput>({
    resolver: zodResolver(changeCatStatusSchema),
    defaultValues: {
      status: options[0],
      pickupAt: toDateTimeInputValue(cat.pickupAt) as unknown as Date | undefined,
    },
  });

  const selectedStatus = useWatch({ control: form.control, name: "status" });
  const showPickupAt =
    selectedStatus === CatStatus.PendingAdoption || selectedStatus === CatStatus.Adopted;

  const mutation = useMutation({
    mutationFn: async (payload: ChangeCatStatusInput) => {
      const { data } = await api.patch(`/api/cats/${cat.id}/status`, payload);
      return data.cat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cats"] });
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["sign-tasks"] });
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
          <Label htmlFor="status">New Status</Label>
          <select id="status" className={selectClassName} {...form.register("status")}>
            {options.map((status) => (
              <option key={status} value={status}>
                {CAT_STATUS_LABELS[status]}
                {status === cat.status ? " (no change — reschedule pickup below)" : ""}
              </option>
            ))}
          </select>
          <ErrorMessage message={form.formState.errors.status?.message} />
        </div>
        {showPickupAt && (
          <div className="space-y-2">
            <Label htmlFor="pickupAt">Scheduled Pickup Date/Time</Label>
            <Input
              id="pickupAt"
              type="datetime-local"
              aria-invalid={!!form.formState.errors.pickupAt}
              {...form.register("pickupAt")}
            />
            <ErrorMessage message={form.formState.errors.pickupAt?.message} />
          </div>
        )}
      </div>
      <div className="shrink-0 space-y-4 pt-4">
        {mutation.error && <ErrorAlert error={mutation.error} fallback="Failed to change status" />}
        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
