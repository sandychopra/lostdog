import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createKennelMoveRequestSchema,
  type CreateKennelMoveRequestInput,
} from "shared/schemas/kennelMoveRequests.ts";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import { occupantLabel, type Kennel } from "./KennelsTable";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface KennelMoveRequestFormProps {
  kennel: Kennel;
  onSuccess: () => void;
}

export default function KennelMoveRequestForm({ kennel, onSuccess }: KennelMoveRequestFormProps) {
  const queryClient = useQueryClient();

  const { data: kennels } = useQuery({
    queryKey: ["kennels"],
    queryFn: async () => {
      const { data } = await api.get<{ kennels: Kennel[] }>("/api/kennels");
      return data.kennels;
    },
  });

  const destinationOptions = (kennels ?? []).filter((k) => k.id !== kennel.id);
  const catId = kennel.cats[0]?.id;
  const groupId = kennel.groups[0]?.id;

  const form = useForm<CreateKennelMoveRequestInput>({
    resolver: zodResolver(createKennelMoveRequestSchema),
    defaultValues: {
      catId,
      groupId,
      fromKennelId: kennel.id,
      toKennelId: undefined,
      reason: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: CreateKennelMoveRequestInput) => {
      const { data } = await api.post("/api/kennel-move-requests", payload);
      return data.kennelMoveRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
      queryClient.invalidateQueries({ queryKey: ["kennel-move-requests"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
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
      <input type="hidden" {...form.register("fromKennelId")} />
      {catId !== undefined && <input type="hidden" {...form.register("catId")} />}
      {groupId !== undefined && <input type="hidden" {...form.register("groupId")} />}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <p className="text-sm text-muted-foreground">
          Moving {occupantLabel(kennel)} out of kennel {kennel.number}.
        </p>
        <div className="space-y-2">
          <Label htmlFor="toKennelId">Destination Kennel</Label>
          <select
            id="toKennelId"
            className={selectClassName}
            aria-invalid={!!form.formState.errors.toKennelId}
            {...form.register("toKennelId")}
          >
            <option value="">Select a kennel</option>
            {destinationOptions.map((k) => (
              <option key={k.id} value={k.id}>
                Kennel {k.number} —{" "}
                {k.cats.length === 0 && k.groups.length === 0 ? k.state : occupantLabel(k)}
              </option>
            ))}
          </select>
          <ErrorMessage message={form.formState.errors.toKennelId?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason (optional)</Label>
          <textarea
            id="reason"
            className={textareaClassName}
            placeholder="e.g. reuniting a bonded pair"
            {...form.register("reason")}
          />
        </div>
      </div>
      <div className="shrink-0 space-y-4 pt-4">
        {mutation.error && (
          <ErrorAlert error={mutation.error} fallback="Failed to create kennel move request" />
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Requesting..." : "Request Move"}
          </Button>
        </div>
      </div>
    </form>
  );
}
