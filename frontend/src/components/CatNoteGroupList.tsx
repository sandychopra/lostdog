import { forwardRef, useImperativeHandle, useState } from "react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import type { CreateShiftReportInput } from "shared/schemas/shiftReports.ts";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import CatMultiSelect from "./CatMultiSelect";
import CollapsibleSection from "./CollapsibleSection";
import CollapsibleEntryCard from "./CollapsibleEntryCard";

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
  isEdit: boolean;
}

export interface CatNoteGroupListHandle {
  collapseAll: () => void;
  expandAll: () => void;
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

function GroupEntry({
  form,
  name,
  index,
  catOptions,
  collapsed,
  onToggleCollapsed,
  onRemove,
}: {
  form: UseFormReturn<CreateShiftReportInput>;
  name: GroupFieldName;
  index: number;
  catOptions: { id: number; name: string }[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onRemove: () => void;
}) {
  const { register } = form;
  const catIds =
    useWatch({ control: form.control, name: `${name}.${index}.catIds` as const }) ?? [];
  const title =
    catOptions
      .filter((cat) => catIds.includes(cat.id))
      .map((cat) => cat.name)
      .join(" / ") || "New entry";

  return (
    <CollapsibleEntryCard
      title={title}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      onRemove={onRemove}
    >
      <GroupCatIds form={form} name={name} index={index} catOptions={catOptions} />
      <Label htmlFor={`${name}.${index}.note`}>Note</Label>
      <textarea
        id={`${name}.${index}.note`}
        className={textareaClassName}
        {...register(`${name}.${index}.note` as const)}
      />
    </CollapsibleEntryCard>
  );
}

const CatNoteGroupList = forwardRef<CatNoteGroupListHandle, CatNoteGroupListProps>(
  function CatNoteGroupList(
    { form, name, title, addLabel, catOptions, collapsed, onToggleCollapsed, isEdit },
    ref,
  ) {
    const { control } = form;
    const fieldArray = useFieldArray({ control, name });

    // Keyed by useFieldArray's stable field.id (not array index, which shifts
    // on add/remove), mirroring collapsedEntryIds in ShiftReportForm.tsx.
    // Entries default collapsed when editing an existing report, so a volunteer
    // sees an overview first; a freshly-added entry is never added to this set,
    // so it always opens expanded.
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() =>
      isEdit ? new Set(fieldArray.fields.map((field) => field.id)) : new Set(),
    );

    function toggleEntryCollapsed(id: string) {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }

    useImperativeHandle(ref, () => ({
      collapseAll: () => setCollapsedIds(new Set(fieldArray.fields.map((field) => field.id))),
      expandAll: () => setCollapsedIds(new Set()),
    }));

    return (
      <CollapsibleSection
        title={title}
        count={fieldArray.fields.length}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        anchorId={`section-${name}`}
        headerExtra={
          <div className="flex gap-2">
            {fieldArray.fields.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCollapsedIds(new Set())}
                >
                  Expand all
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setCollapsedIds(new Set(fieldArray.fields.map((field) => field.id)))
                  }
                >
                  Collapse all
                </Button>
              </>
            )}
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
          </div>
        }
      >
        {fieldArray.fields.map((field, index) => (
          <GroupEntry
            key={field.id}
            form={form}
            name={name}
            index={index}
            catOptions={catOptions}
            collapsed={collapsedIds.has(field.id)}
            onToggleCollapsed={() => toggleEntryCollapsed(field.id)}
            onRemove={() => fieldArray.remove(index)}
          />
        ))}
      </CollapsibleSection>
    );
  },
);

export default CatNoteGroupList;
