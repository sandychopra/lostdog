import { useForm, useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Trash2, Plus } from "lucide-react";
import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import { updateManualAnnouncementSchema } from "shared/schemas/announcements.ts";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Textarea } from "./ui/textarea";
import { Card } from "./ui/card";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";

interface TaskFormValues {
  actionType: ChecklistActionType;
  description: string;
  kennelId: string;
  occupant: string;
}

interface AnnouncementFormValues {
  title: string;
  message: string;
  tasks: TaskFormValues[];
}

// A separate, form-shaped schema from shared/schemas/announcements.ts's wire
// schema: this validates the editing shape (a combined "occupant" select,
// string kennelId) before it's split into catId/groupId and coerced to
// numbers for the API payload in the mutation below.
const taskFormSchema = z
  .object({
    actionType: z.enum(ChecklistActionType),
    description: z.string(),
    kennelId: z.string(),
    occupant: z.string(),
  })
  .superRefine((task, ctx) => {
    if (task.actionType === ChecklistActionType.FreeText) {
      if (!task.description.trim()) {
        ctx.addIssue({ code: "custom", message: "Description is required", path: ["description"] });
      }
      return;
    }
    if (!task.kennelId) {
      ctx.addIssue({ code: "custom", message: "Kennel is required", path: ["kennelId"] });
    }
    if (task.actionType === ChecklistActionType.MoveCat && !task.occupant) {
      ctx.addIssue({ code: "custom", message: "Select a cat or group", path: ["occupant"] });
    }
  });

const createAnnouncementFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
    message: z.string(),
    tasks: z.array(taskFormSchema),
  })
  .refine((data) => data.tasks.length > 0 || data.message.trim().length > 0, {
    error: "Message is required when there are no tasks",
    path: ["message"],
  });

interface Occupant {
  value: string;
  label: string;
}

interface TaskFieldsProps {
  form: UseFormReturn<AnnouncementFormValues>;
  index: number;
  kennels: Kennel[];
  occupants: Occupant[];
  onRemove: () => void;
}

function TaskFields({ form, index, kennels, occupants, onRemove }: TaskFieldsProps) {
  const actionType = useWatch({ control: form.control, name: `tasks.${index}.actionType` });
  const errors = form.formState.errors.tasks?.[index];

  return (
    <Card size="sm" className="gap-2 p-3 text-base">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Task {index + 1}</span>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={onRemove}
          aria-label="Remove task"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`tasks.${index}.actionType`}>Type</Label>
        <NativeSelect
          id={`tasks.${index}.actionType`}
          {...form.register(`tasks.${index}.actionType`)}
        >
          <NativeSelectOption value={ChecklistActionType.FreeText}>
            Text (just a checkbox)
          </NativeSelectOption>
          <NativeSelectOption value={ChecklistActionType.ResetKennel}>
            Reset Kennel
          </NativeSelectOption>
          <NativeSelectOption value={ChecklistActionType.MoveCat}>
            Move Cat/Group to Kennel
          </NativeSelectOption>
        </NativeSelect>
      </div>
      {actionType === ChecklistActionType.FreeText ? (
        <div className="space-y-2">
          <Label htmlFor={`tasks.${index}.description`}>Description</Label>
          <Input
            id={`tasks.${index}.description`}
            placeholder="e.g. Sweep the floor"
            aria-invalid={!!errors?.description}
            {...form.register(`tasks.${index}.description`)}
          />
          <ErrorMessage message={errors?.description?.message} />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor={`tasks.${index}.kennelId`}>
              {actionType === ChecklistActionType.ResetKennel
                ? "Kennel to Reset"
                : "Destination Kennel"}
            </Label>
            <NativeSelect
              id={`tasks.${index}.kennelId`}
              aria-invalid={!!errors?.kennelId}
              {...form.register(`tasks.${index}.kennelId`)}
            >
              <NativeSelectOption value="">Select a kennel</NativeSelectOption>
              {kennels.map((k) => (
                <NativeSelectOption key={k.id} value={k.id}>
                  Kennel {k.number}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <ErrorMessage message={errors?.kennelId?.message} />
          </div>
          {actionType === ChecklistActionType.MoveCat && (
            <div className="space-y-2">
              <Label htmlFor={`tasks.${index}.occupant`}>Cat or Group</Label>
              <NativeSelect
                id={`tasks.${index}.occupant`}
                aria-invalid={!!errors?.occupant}
                {...form.register(`tasks.${index}.occupant`)}
              >
                <NativeSelectOption value="">Select a cat or group</NativeSelectOption>
                {occupants.map((occupant) => (
                  <NativeSelectOption key={occupant.value} value={occupant.value}>
                    {occupant.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <ErrorMessage message={errors?.occupant?.message} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}

interface AnnouncementData {
  id: number;
  title: string | null;
  message: string | null;
}

interface AnnouncementFormProps {
  announcement?: AnnouncementData;
  onSuccess: () => void;
}

export default function AnnouncementForm({ announcement, onSuccess }: AnnouncementFormProps) {
  const isEdit = !!announcement;
  const queryClient = useQueryClient();

  const { data: kennels } = useQuery({
    queryKey: ["kennels"],
    queryFn: async () => {
      const { data } = await api.get<{ kennels: Kennel[] }>("/api/kennels");
      return data.kennels;
    },
    enabled: !isEdit,
  });

  const { data: cats } = useQuery({
    queryKey: ["cats"],
    queryFn: async () => {
      const { data } = await api.get<{ cats: Cat[] }>("/api/cats");
      return data.cats;
    },
    enabled: !isEdit,
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

  const form = useForm<AnnouncementFormValues>({
    // Typed against the create schema (the full form shape). In edit mode the
    // update schema validates only title/message — the edit branch of the
    // mutation below never reads `tasks`.
    resolver: zodResolver(
      (isEdit
        ? updateManualAnnouncementSchema
        : createAnnouncementFormSchema) as typeof createAnnouncementFormSchema,
    ),
    defaultValues: {
      title: announcement?.title ?? "",
      message: announcement?.message ?? "",
      tasks: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "tasks" });

  const mutation = useMutation({
    mutationFn: async (values: AnnouncementFormValues) => {
      if (isEdit) {
        const { data } = await api.put(`/api/announcements/${announcement.id}`, {
          title: values.title,
          message: values.message,
        });
        return data.announcement;
      }
      const payload = {
        title: values.title,
        message: values.message.trim() || undefined,
        tasks: values.tasks.map((task) => {
          if (task.actionType === ChecklistActionType.FreeText) {
            return { actionType: task.actionType, description: task.description.trim() };
          }
          const [occupantType, occupantId] = task.occupant.split(":");
          return {
            actionType: task.actionType,
            kennelId: Number(task.kennelId),
            ...(task.actionType === ChecklistActionType.MoveCat
              ? {
                  catId: occupantType === "cat" ? Number(occupantId) : undefined,
                  groupId: occupantType === "group" ? Number(occupantId) : undefined,
                }
              : {}),
          };
        }),
      };
      const { data } = await api.post("/api/announcements", payload);
      return data.announcement;
    },
    onSuccess: () => {
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
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Short summary"
            aria-invalid={!!form.formState.errors.title}
            {...form.register("title")}
          />
          <ErrorMessage message={form.formState.errors.title?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            className="min-h-24"
            aria-invalid={!!form.formState.errors.message}
            {...form.register("message")}
          />
          <ErrorMessage message={form.formState.errors.message?.message} />
        </div>
        {!isEdit && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Tasks</Label>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  append({
                    actionType: ChecklistActionType.FreeText,
                    description: "",
                    kennelId: "",
                    occupant: "",
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Task
              </Button>
            </div>
            {fields.map((field, index) => (
              <TaskFields
                key={field.id}
                form={form}
                index={index}
                kennels={kennels ?? []}
                occupants={occupants}
                onRemove={() => remove(index)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 space-y-4 pt-4">
        {mutation.error && (
          <ErrorAlert
            error={mutation.error}
            fallback={`Failed to ${isEdit ? "update" : "create"} announcement`}
          />
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {isEdit
              ? mutation.isPending
                ? "Saving..."
                : "Save Changes"
              : mutation.isPending
                ? "Posting..."
                : "Post Announcement"}
          </Button>
        </div>
      </div>
    </form>
  );
}
