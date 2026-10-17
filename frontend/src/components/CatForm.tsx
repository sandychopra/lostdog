import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCatSchema,
  updateCatSchema,
  updateGroupedCatSchema,
  type CreateCatInput,
  type UpdateCatInput,
} from "shared/schemas/cats.ts";
import { CatSex } from "shared/constants/catSex.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { CAT_COLOR_PATTERNS } from "shared/constants/catColorPattern.ts";
import { api } from "../lib/api";
import { toDateTimeInputValue } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Checkbox } from "./ui/checkbox";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";

const OTHER_COLOR = "__other__";

function toDateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

interface CatFormProps {
  cat?: Cat;
  onSuccess: () => void;
}

export default function CatForm({ cat, onSuccess }: CatFormProps) {
  const isEdit = !!cat;
  const isGrouped = !!cat && cat.groupId !== null;
  const queryClient = useQueryClient();

  const [isOtherColor, setIsOtherColor] = useState(
    () =>
      !!cat &&
      !CAT_COLOR_PATTERNS.includes(cat.colorPattern as (typeof CAT_COLOR_PATTERNS)[number]),
  );

  const { data: kennels } = useQuery({
    queryKey: ["kennels"],
    queryFn: async () => {
      const { data } = await api.get<{ kennels: Kennel[] }>("/api/kennels");
      return data.kennels;
    },
  });

  const availableKennels = (kennels ?? []).filter(
    (k) => (k.cats.length === 0 && k.groups.length === 0) || k.id === cat?.kennelId,
  );

  // Typed against createCatSchema, whose fields are a superset of the update
  // schemas' (kennelId is optional there), so one form type covers all three.
  const form = useForm({
    resolver: zodResolver(
      (isGrouped
        ? updateGroupedCatSchema
        : isEdit
          ? updateCatSchema
          : createCatSchema) as typeof createCatSchema,
    ),
    defaultValues: {
      name: cat?.name ?? "",
      ageYears: cat?.ageYears ?? undefined,
      ageMonths: cat?.ageMonths ?? undefined,
      sex: cat?.sex as CatSex | undefined,
      colorPattern: cat?.colorPattern ?? "",
      collarColor: cat?.collarColor ?? "",
      microchipNumber: cat?.microchipNumber ?? "",
      kennelId: cat?.kennelId ?? undefined,
      dewormerStatus: cat?.dewormerStatus ?? DewormerStatus.Due,
      dewormerDueDate: toDateInputValue(cat?.dewormerDueDate),
      needsProbiotic: cat?.needsProbiotic ?? false,
      pickupAt: toDateTimeInputValue(cat?.pickupAt),
    },
  });

  const colorPattern = useWatch({ control: form.control, name: "colorPattern" });

  const mutation = useMutation({
    mutationFn: async (payload: CreateCatInput | UpdateCatInput) => {
      if (isEdit) {
        const { data } = await api.put(`/api/cats/${cat.id}`, payload);
        return data.cat;
      }
      const { data } = await api.post("/api/cats", payload);
      return data.cat;
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
    <form
      onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="Cat's name"
            aria-invalid={!!form.formState.errors.name}
            {...form.register("name")}
          />
          <ErrorMessage message={form.formState.errors.name?.message} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ageYears">Age (years)</Label>
            <Input
              id="ageYears"
              type="number"
              placeholder="Optional"
              aria-invalid={!!form.formState.errors.ageYears}
              {...form.register("ageYears")}
            />
            <ErrorMessage message={form.formState.errors.ageYears?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ageMonths">Age (months)</Label>
            <Input
              id="ageMonths"
              type="number"
              placeholder="Optional, 0–11"
              aria-invalid={!!form.formState.errors.ageMonths}
              {...form.register("ageMonths")}
            />
            <ErrorMessage message={form.formState.errors.ageMonths?.message} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sex">Sex</Label>
          <NativeSelect id="sex" {...form.register("sex")}>
            <NativeSelectOption value={CatSex.Male}>Male</NativeSelectOption>
            <NativeSelectOption value={CatSex.Female}>Female</NativeSelectOption>
            <NativeSelectOption value={CatSex.Unknown}>Unknown</NativeSelectOption>
          </NativeSelect>
          <ErrorMessage message={form.formState.errors.sex?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="colorPatternSelect">Color/Pattern</Label>
          <NativeSelect
            id="colorPatternSelect"
            value={isOtherColor ? OTHER_COLOR : colorPattern}
            onChange={(e) => {
              if (e.target.value === OTHER_COLOR) {
                setIsOtherColor(true);
                form.setValue("colorPattern", "", { shouldValidate: true });
              } else {
                setIsOtherColor(false);
                form.setValue("colorPattern", e.target.value, { shouldValidate: true });
              }
            }}
          >
            <NativeSelectOption value="">Select a color/pattern</NativeSelectOption>
            {CAT_COLOR_PATTERNS.map((pattern) => (
              <NativeSelectOption key={pattern} value={pattern}>
                {pattern}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value={OTHER_COLOR}>Other</NativeSelectOption>
          </NativeSelect>
          {isOtherColor && (
            <Input
              placeholder="Describe the color/pattern"
              aria-invalid={!!form.formState.errors.colorPattern}
              {...form.register("colorPattern")}
            />
          )}
          <ErrorMessage message={form.formState.errors.colorPattern?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="collarColor">Collar Color</Label>
          <Input id="collarColor" placeholder="Optional" {...form.register("collarColor")} />
          <ErrorMessage message={form.formState.errors.collarColor?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="microchipNumber">Microchip Number</Label>
          <Input
            id="microchipNumber"
            placeholder="Optional"
            {...form.register("microchipNumber")}
          />
          <ErrorMessage message={form.formState.errors.microchipNumber?.message} />
        </div>
        {!isGrouped && (
          <div className="space-y-2">
            <Label htmlFor="kennelId">Kennel{!isEdit ? " (optional)" : ""}</Label>
            <NativeSelect
              id="kennelId"
              aria-invalid={!!form.formState.errors.kennelId}
              {...form.register("kennelId")}
            >
              <NativeSelectOption value="">Select a kennel</NativeSelectOption>
              {availableKennels.map((k) => (
                <NativeSelectOption key={k.id} value={k.id}>
                  {k.number}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <ErrorMessage message={form.formState.errors.kennelId?.message} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="dewormerStatus">Dewormer</Label>
          <NativeSelect id="dewormerStatus" {...form.register("dewormerStatus")}>
            <NativeSelectOption value={DewormerStatus.Due}>Due</NativeSelectOption>
            <NativeSelectOption value={DewormerStatus.Given}>Given</NativeSelectOption>
          </NativeSelect>
          <ErrorMessage message={form.formState.errors.dewormerStatus?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dewormerDueDate">Dewormer Due Date</Label>
          <Input
            id="dewormerDueDate"
            type="date"
            aria-invalid={!!form.formState.errors.dewormerDueDate}
            {...form.register("dewormerDueDate")}
          />
          <ErrorMessage message={form.formState.errors.dewormerDueDate?.message} />
        </div>
        <div className="flex items-center gap-2">
          <Controller
            control={form.control}
            name="needsProbiotic"
            render={({ field }) => (
              <Checkbox
                id="needsProbiotic"
                ref={field.ref}
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
              />
            )}
          />
          <Label htmlFor="needsProbiotic">Needs Probiotic</Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pickupAt">Pickup Date/Time</Label>
          <Input
            id="pickupAt"
            type="datetime-local"
            aria-invalid={!!form.formState.errors.pickupAt}
            {...form.register("pickupAt")}
          />
          <ErrorMessage message={form.formState.errors.pickupAt?.message} />
        </div>
      </div>
      <div className="shrink-0 space-y-4 pt-4">
        {mutation.error && (
          <ErrorAlert
            error={mutation.error}
            fallback={`Failed to ${isEdit ? "update" : "create"} cat`}
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
                : "Create Cat"}
          </Button>
        </div>
      </div>
    </form>
  );
}
