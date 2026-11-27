import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { changeCatStatusSchema, type ChangeCatStatusInput } from "shared/schemas/catStatus.ts";
import { CatStatus } from "shared/constants/catStatus.ts";
import { VALID_STATUS_TRANSITIONS } from "shared/constants/catStatusTransitions.ts";
import { api } from "../lib/api";
import { toDateTimeInputValue } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import type { Cat } from "./CatsTable";

const CAT_STATUS_LABELS: Record<CatStatus, string> = {
  [CatStatus.Available]: "Available",
  [CatStatus.PendingAdoption]: "Pending Adoption",
  [CatStatus.Adopted]: "Adopted",
  [CatStatus.PickedUp]: "Picked Up",
};

// The pickup date and time are separate fields: on phones each opens a small
// native picker that closes after one choice, where a single datetime-local
// picker could cover the dialog's Save button. Time is optional (noon is
// assumed); they're combined into the API's single pickupAt on submit.
const statusFormSchema = z
  .object({
    status: changeCatStatusSchema.shape.status,
    pickupDate: z.string(),
    pickupTime: z.string(),
  })
  .refine((data) => data.pickupTime === "" || data.pickupDate !== "", {
    error: "Choose a pickup date for this time",
    path: ["pickupDate"],
  });
type StatusFormValues = z.infer<typeof statusFormSchema>;

const DEFAULT_PICKUP_TIME = "12:00";

function toPayload(values: StatusFormValues): ChangeCatStatusInput {
  const wantsPickup =
    values.status === CatStatus.PendingAdoption || values.status === CatStatus.Adopted;
  if (!wantsPickup || values.pickupDate === "") return { status: values.status };
  const time = values.pickupTime || DEFAULT_PICKUP_TIME;
  return { status: values.status, pickupAt: new Date(`${values.pickupDate}T${time}`) };
}

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

  const [initialDate = "", initialTime = ""] = toDateTimeInputValue(cat.pickupAt).split("T");
  const form = useForm({
    resolver: zodResolver(statusFormSchema),
    defaultValues: {
      // Never empty: Change Status is only offered when the cat has a transition.
      status: options[0]!,
      pickupDate: initialDate,
      pickupTime: initialTime,
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
      onSubmit={form.handleSubmit((values) => mutation.mutate(toPayload(values)))}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="status">New Status</Label>
          <NativeSelect id="status" {...form.register("status")}>
            {options.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {CAT_STATUS_LABELS[status]}
                {status === cat.status ? " (no change — reschedule pickup below)" : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <ErrorMessage message={form.formState.errors.status?.message} />
        </div>
        {showPickupAt && (
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="pickupDate">Pickup Date</Label>
              <Input
                id="pickupDate"
                type="date"
                aria-invalid={!!form.formState.errors.pickupDate}
                {...form.register("pickupDate")}
              />
              <ErrorMessage message={form.formState.errors.pickupDate?.message} />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="pickupTime">Time (optional)</Label>
              <Input id="pickupTime" type="time" {...form.register("pickupTime")} />
            </div>
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
