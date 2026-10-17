import { useEffect } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { KennelState, toReportableKennelState } from "shared/constants/kennelState.ts";
import { Label } from "./ui/label";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Textarea } from "./ui/textarea";
import ErrorMessage from "./ErrorMessage";
import CollapsibleSection from "./CollapsibleSection";
import type { ShiftReportFormApi } from "../lib/shiftReportForm";

interface KennelStatusListProps {
  form: ShiftReportFormApi;
  kennelOptions: { id: number; number: number; state: KennelState }[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

// Every kennel gets a reported state each shift (Ready/Occupied/NeedsReset) —
// defaulted to its current recorded state, so confirming "yes, still what the
// system shows" takes no action. A reported state that disagrees with the
// kennel's current state is just logged as-is, same as any other value — no
// note required; anything worth explaining goes in the report's general
// Kennel Notes field instead. This is purely observational — submitting
// never changes Kennel.state or announcements.
export default function KennelStatusList({
  form,
  kennelOptions,
  collapsed,
  onToggleCollapsed,
}: KennelStatusListProps) {
  const { control, register, formState } = form;
  const fieldArray = useFieldArray({ control, name: "kennelsStatus" });
  const values = useWatch({ control, name: "kennelsStatus" }) ?? [];

  // Kennels can load after the form's initial defaultValues are set (async
  // fetch), and a kennel can be created after a report was last saved — add
  // an entry, defaulted to its current state, for any kennel not already
  // present, whenever the kennel list changes.
  useEffect(() => {
    const presentIds = new Set(values.map((k) => k.kennelId));
    const missing = kennelOptions
      .filter((k) => !presentIds.has(k.id))
      .sort((a, b) => a.number - b.number);
    if (missing.length > 0) {
      fieldArray.append(
        missing.map((k) => ({
          kennelId: k.id,
          reportedState: toReportableKennelState(k.state),
        })),
      );
    }
    // Only re-run when the kennel list itself changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kennelOptions]);

  const kennelById = new Map(kennelOptions.map((k) => [k.id, k]));
  const orderedFields = [...fieldArray.fields.entries()].sort(([, a], [, b]) => {
    const aNumber = kennelById.get(a.kennelId)?.number ?? 0;
    const bNumber = kennelById.get(b.kennelId)?.number ?? 0;
    return aNumber - bNumber;
  });
  const readyCount = values.filter((v) => v.reportedState === KennelState.Ready).length;

  return (
    <CollapsibleSection
      title="Kennel Status"
      count={`${readyCount}/${orderedFields.length}`}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      anchorId="section-kennel-status"
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
        {orderedFields.map(([index, field]) => {
          const kennel = kennelById.get(field.kennelId);

          return (
            <div key={field.id} className="space-y-1">
              <Label htmlFor={`kennelsStatus.${index}.reportedState`} className="text-xs">
                Kennel {kennel?.number ?? "—"}
              </Label>
              <NativeSelect
                id={`kennelsStatus.${index}.reportedState`}
                size="sm"
                {...register(`kennelsStatus.${index}.reportedState` as const)}
              >
                <NativeSelectOption value={KennelState.Ready}>Ready</NativeSelectOption>
                <NativeSelectOption value={KennelState.Occupied}>Occupied</NativeSelectOption>
                <NativeSelectOption value={KennelState.NeedsReset}>Needs Reset</NativeSelectOption>
              </NativeSelect>
            </div>
          );
        })}
      </div>
      <ErrorMessage
        message={
          formState.errors.kennelsStatus?.root?.message ?? formState.errors.kennelsStatus?.message
        }
      />
      <div className="space-y-2">
        <Label htmlFor="kennelNotes">Kennel Notes</Label>
        <Textarea id="kennelNotes" className="min-h-16" {...register("kennelNotes")} />
      </div>
    </CollapsibleSection>
  );
}
