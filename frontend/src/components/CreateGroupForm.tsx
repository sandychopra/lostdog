import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createGroupSchema, type CreateGroupInput } from "shared/schemas/groups.ts";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface CreateGroupFormProps {
  onSuccess: () => void;
}

export default function CreateGroupForm({ onSuccess }: CreateGroupFormProps) {
  const queryClient = useQueryClient();

  const { data: cats } = useQuery({
    queryKey: ["cats"],
    queryFn: async () => {
      const { data } = await api.get<{ cats: Cat[] }>("/api/cats");
      return data.cats;
    },
  });

  const { data: kennels } = useQuery({
    queryKey: ["kennels"],
    queryFn: async () => {
      const { data } = await api.get<{ kennels: Kennel[] }>("/api/kennels");
      return data.kennels;
    },
  });

  const eligibleCats = (cats ?? []).filter((c) => c.groupId === null);

  const form = useForm<CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { catIds: [], kennelId: undefined, bonded: false },
  });

  const catIds = useWatch({ control: form.control, name: "catIds" }) ?? [];

  function toggleCat(id: number) {
    const next = catIds.includes(id) ? catIds.filter((x) => x !== id) : [...catIds, id];
    form.setValue("catIds", next, { shouldValidate: true });
    if (next.length !== 2) {
      form.setValue("bonded", false);
    }
  }

  const selectedCurrentKennelIds = eligibleCats
    .filter((c) => catIds.includes(c.id))
    .map((c) => c.kennelId)
    .filter((id): id is number => id !== null);

  const availableKennels = (kennels ?? []).filter(
    (k) =>
      (k.cats.length === 0 && k.groups.length === 0) || selectedCurrentKennelIds.includes(k.id),
  );

  const mutation = useMutation({
    mutationFn: async (payload: CreateGroupInput) => {
      const { data } = await api.post("/api/groups", payload);
      return data.group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cats"] });
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
      form.reset();
      mutation.reset();
      onSuccess();
    },
  });

  return (
    <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
      <div className="space-y-2">
        <Label>Cats (select 2 or more)</Label>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-input p-2">
          {eligibleCats.length === 0 && (
            <p className="text-sm text-muted-foreground">No ungrouped cats available.</p>
          )}
          {eligibleCats.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={catIds.includes(cat.id)}
                onChange={() => toggleCat(cat.id)}
              />
              {cat.name}
            </label>
          ))}
        </div>
        <ErrorMessage message={form.formState.errors.catIds?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kennelId">Kennel</Label>
        <select
          id="kennelId"
          className={selectClassName}
          aria-invalid={!!form.formState.errors.kennelId}
          {...form.register("kennelId")}
        >
          <option value="">Select a kennel</option>
          {availableKennels.map((k) => (
            <option key={k.id} value={k.id}>
              {k.number}
            </option>
          ))}
        </select>
        <ErrorMessage message={form.formState.errors.kennelId?.message} />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="bonded"
          type="checkbox"
          className="h-4 w-4"
          disabled={catIds.length !== 2}
          {...form.register("bonded")}
        />
        <Label htmlFor="bonded">Bonded pair (only settable for exactly 2 cats)</Label>
      </div>
      <ErrorMessage message={form.formState.errors.bonded?.message} />
      {mutation.error && <ErrorAlert error={mutation.error} fallback="Failed to create group" />}
      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating..." : "Create Group"}
        </Button>
      </div>
    </form>
  );
}
