import { useForm, useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface StepFormValues {
  actionType: ChecklistActionType;
  kennelId: string;
  occupant: string;
}

interface ChecklistFormValues {
  actions: StepFormValues[];
}

interface Occupant {
  value: string;
  label: string;
}

interface StepFieldsProps {
  form: UseFormReturn<ChecklistFormValues>;
  index: number;
  kennels: Kennel[];
  occupants: Occupant[];
  onRemove: () => void;
}

function StepFields({ form, index, kennels, occupants, onRemove }: StepFieldsProps) {
  const actionType = useWatch({ control: form.control, name: `actions.${index}.actionType` });

  return (
    <div className="space-y-2 rounded-md border border-input p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Step {index + 1}</span>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={onRemove}
          aria-label="Remove step"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`actions.${index}.actionType`}>Action</Label>
        <select
          id={`actions.${index}.actionType`}
          className={selectClassName}
          {...form.register(`actions.${index}.actionType`, { required: true })}
        >
          <option value={ChecklistActionType.ResetKennel}>Reset Kennel</option>
          <option value={ChecklistActionType.MoveCat}>Move Cat/Group to Kennel</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`actions.${index}.kennelId`}>
          {actionType === ChecklistActionType.ResetKennel
            ? "Kennel to Reset"
            : "Destination Kennel"}
        </Label>
        <select
          id={`actions.${index}.kennelId`}
          className={selectClassName}
          aria-invalid={!!form.formState.errors.actions?.[index]?.kennelId}
          {...form.register(`actions.${index}.kennelId`, { required: true })}
        >
          <option value="">Select a kennel</option>
          {kennels.map((k) => (
            <option key={k.id} value={k.id}>
              Kennel {k.number}
            </option>
          ))}
        </select>
        <ErrorMessage message={form.formState.errors.actions?.[index]?.kennelId?.message} />
      </div>
      {actionType === ChecklistActionType.MoveCat && (
        <div className="space-y-2">
          <Label htmlFor={`actions.${index}.occupant`}>Cat or Group</Label>
          <select
            id={`actions.${index}.occupant`}
            className={selectClassName}
            aria-invalid={!!form.formState.errors.actions?.[index]?.occupant}
            {...form.register(`actions.${index}.occupant`, {
              required: actionType === ChecklistActionType.MoveCat,
            })}
          >
            <option value="">Select a cat or group</option>
            {occupants.map((occupant) => (
              <option key={occupant.value} value={occupant.value}>
                {occupant.label}
              </option>
            ))}
          </select>
          <ErrorMessage message={form.formState.errors.actions?.[index]?.occupant?.message} />
        </div>
      )}
    </div>
  );
}

interface KennelPrepChecklistFormProps {
  onSuccess: () => void;
}

export default function KennelPrepChecklistForm({ onSuccess }: KennelPrepChecklistFormProps) {
  const queryClient = useQueryClient();

  const { data: kennels } = useQuery({
    queryKey: ["kennels"],
    queryFn: async () => {
      const { data } = await api.get<{ kennels: Kennel[] }>("/api/kennels");
      return data.kennels;
    },
  });

  const { data: cats } = useQuery({
    queryKey: ["cats"],
    queryFn: async () => {
      const { data } = await api.get<{ cats: Cat[] }>("/api/cats");
      return data.cats;
    },
  });

  const ungroupedCats = (cats ?? []).filter((c) => c.groupId === null);
  const groups = new Map((kennels ?? []).flatMap((k) => k.groups.map((g) => [g.id, g])));
  const occupants: Occupant[] = [
    ...ungroupedCats.map((c) => ({ value: `cat:${c.id}`, label: c.name })),
    ...[...groups.values()].map((g) => ({
      value: `group:${g.id}`,
      label: g.cats.map((c) => c.name).join("/"),
    })),
  ];

  const form = useForm<ChecklistFormValues>({
    defaultValues: {
      actions: [{ actionType: ChecklistActionType.ResetKennel, kennelId: "", occupant: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "actions" });

  const mutation = useMutation({
    mutationFn: async (values: ChecklistFormValues) => {
      const payload = {
        actions: values.actions.map((step) => {
          const [occupantType, occupantId] = step.occupant.split(":");
          return {
            actionType: step.actionType,
            kennelId: Number(step.kennelId),
            catId: occupantType === "cat" ? Number(occupantId) : undefined,
            groupId: occupantType === "group" ? Number(occupantId) : undefined,
          };
        }),
      };
      const { data } = await api.post("/api/kennel-prep-checklists", payload);
      return data.checklist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kennel-prep-checklists"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      form.reset();
      mutation.reset();
      onSuccess();
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {fields.map((field, index) => (
          <StepFields
            key={field.id}
            form={form}
            index={index}
            kennels={kennels ?? []}
            occupants={occupants}
            onRemove={() => remove(index)}
          />
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            append({ actionType: ChecklistActionType.ResetKennel, kennelId: "", occupant: "" })
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Step
        </Button>
      </div>
      <div className="shrink-0 space-y-4 pt-4">
        {mutation.error && (
          <ErrorAlert error={mutation.error} fallback="Failed to create checklist" />
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create Checklist"}
          </Button>
        </div>
      </div>
    </form>
  );
}
