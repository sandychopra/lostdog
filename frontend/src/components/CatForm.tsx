import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCatSchema,
  updateCatSchema,
  type CreateCatInput,
  type UpdateCatInput,
} from "shared/schemas/cats.ts";
import { CatSex } from "shared/constants/catSex.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { CAT_COLOR_PATTERNS } from "shared/constants/catColorPattern.ts";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

  const form = useForm<CreateCatInput | UpdateCatInput>({
    resolver: zodResolver(isEdit ? updateCatSchema : createCatSchema),
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
      dewormerDueDate: toDateInputValue(cat?.dewormerDueDate) as unknown as Date | undefined,
      needsProbiotic: cat?.needsProbiotic ?? false,
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
    <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
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
        <select id="sex" className={selectClassName} {...form.register("sex")}>
          <option value={CatSex.Male}>Male</option>
          <option value={CatSex.Female}>Female</option>
          <option value={CatSex.Unknown}>Unknown</option>
        </select>
        <ErrorMessage message={form.formState.errors.sex?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="colorPatternSelect">Color/Pattern</Label>
        <select
          id="colorPatternSelect"
          className={selectClassName}
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
          <option value="">Select a color/pattern</option>
          {CAT_COLOR_PATTERNS.map((pattern) => (
            <option key={pattern} value={pattern}>
              {pattern}
            </option>
          ))}
          <option value={OTHER_COLOR}>Other</option>
        </select>
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
        <Input id="microchipNumber" placeholder="Optional" {...form.register("microchipNumber")} />
        <ErrorMessage message={form.formState.errors.microchipNumber?.message} />
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
      <div className="space-y-2">
        <Label htmlFor="dewormerStatus">Dewormer</Label>
        <select
          id="dewormerStatus"
          className={selectClassName}
          {...form.register("dewormerStatus")}
        >
          <option value={DewormerStatus.Due}>Due</option>
          <option value={DewormerStatus.Given}>Given</option>
        </select>
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
        <input
          id="needsProbiotic"
          type="checkbox"
          className="h-4 w-4"
          {...form.register("needsProbiotic")}
        />
        <Label htmlFor="needsProbiotic">Needs Probiotic</Label>
      </div>
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
    </form>
  );
}
