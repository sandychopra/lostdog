import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import type { CreateShiftReportInput } from "shared/schemas/shiftReports.ts";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import CatMultiSelect from "./CatMultiSelect";
import CollapsibleSection from "./CollapsibleSection";

const textareaClassName =
  "flex min-h-16 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

type GroupFieldName = "meetAndGreets" | "playGroups";

interface CatNoteGroupListProps {
  form: UseFormReturn<CreateShiftReportInput>;
  name: GroupFieldName;
  title: string;
  addLabel: string;
  catOptions: { id: number; name: string }[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

// Meet & Greets and Play Groups are the exact same shape ({ id?, note, catIds
// }[], >=1 cat required) and UI pattern, so this one component drives both.
function GroupCatIds({
  form,
  name,
  index,
  catOptions,
}: {
  form: UseFormReturn<CreateShiftReportInput>;
  name: GroupFieldName;
  index: number;
  catOptions: { id: number; name: string }[];
}) {
  const catIds =
    useWatch({ control: form.control, name: `${name}.${index}.catIds` as const }) ?? [];
  return (
    <CatMultiSelect
      cats={catOptions}
      selectedIds={catIds}
      onChange={(ids) =>
        form.setValue(`${name}.${index}.catIds` as const, ids, { shouldValidate: true })
      }
    />
  );
}

export default function CatNoteGroupList({
  form,
  name,
  title,
  addLabel,
  catOptions,
  collapsed,
  onToggleCollapsed,
}: CatNoteGroupListProps) {
  const { control, register } = form;
  const fieldArray = useFieldArray({ control, name });

  return (
    <CollapsibleSection
      title={title}
      count={fieldArray.fields.length}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      anchorId={`section-${name}`}
      headerExtra={
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            fieldArray.append({ note: "", catIds: [] });
            if (collapsed) onToggleCollapsed();
          }}
        >
          {addLabel}
        </Button>
      }
    >
      {fieldArray.fields.map((field, index) => (
        <div key={field.id} className="space-y-2 rounded-md border border-input p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${name}.${index}.note`}>Note</Label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fieldArray.remove(index)}
              aria-label={`Remove ${title} entry`}
            >
              ×
            </Button>
          </div>
          <textarea
            id={`${name}.${index}.note`}
            className={textareaClassName}
            {...register(`${name}.${index}.note` as const)}
          />
          <GroupCatIds form={form} name={name} index={index} catOptions={catOptions} />
        </div>
      ))}
    </CollapsibleSection>
  );
}
