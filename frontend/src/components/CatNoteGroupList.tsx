import { useEffect, useRef, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import ErrorMessage from "./ErrorMessage";
import CatMultiSelect from "./CatMultiSelect";
import CollarDot from "./CollarDot";
import FormSection from "./FormSection";
import type { Cat } from "./CatsTable";
import type { ShiftReportFormApi } from "../lib/shiftReportForm";
import { cn } from "../lib/utils";

type GroupFieldName = "meetAndGreets" | "playGroups";

const NO_CATS_MESSAGE = "Tag at least one cat";

interface CatNoteGroupListProps {
  form: ShiftReportFormApi;
  name: GroupFieldName;
  title: string;
  /** Singular noun for the dialog title and menus, e.g. "Play Group". */
  itemLabel: string;
  addLabel: string;
  /** Every cat, for showing names already tagged on an entry. */
  cats: Cat[];
  /** The cats offered in the picker (in care — not Picked Up). */
  pickableCats: Cat[];
  /**
   * When set, the editor gets a "Select all cats" button that tags these cats
   * at once — for play groups where everyone played together. The volunteer
   * can then remove any who didn't.
   */
  selectAllCatIds?: number[];
  noteLabel?: string;
  /** Called when an editor closes — a natural moment to autosave. */
  onEditDone: () => void;
}

// Meet & Greets and Play Groups are the exact same shape ({ id?, note, catIds
// }[], >=1 cat required), so this one component drives both. Each entry is a
// summary card edited in a dialog from its ⋮ menu, like the Food & Medical
// cards (CatEntryCard).
function GroupEntryCard({
  form,
  name,
  index,
  itemLabel,
  cats,
  pickableCats,
  isNew,
  editing,
  onOpenEditor,
  onCloseEditor,
  onRemove,
  selectAllCatIds,
  noteLabel,
}: {
  form: ShiftReportFormApi;
  name: GroupFieldName;
  index: number;
  itemLabel: string;
  cats: Cat[];
  pickableCats: Cat[];
  isNew: boolean;
  editing: boolean;
  onOpenEditor: () => void;
  onCloseEditor: (removeIfEmpty: boolean) => void;
  onRemove: () => void;
  selectAllCatIds?: number[];
  noteLabel: string;
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const { register, formState } = form;
  const catIds =
    useWatch({ control: form.control, name: `${name}.${index}.catIds` as const }) ?? [];
  const note = useWatch({ control: form.control, name: `${name}.${index}.note` as const });
  const errors = formState.errors[name]?.[index];
  const catError = errors?.catIds?.message ?? errors?.catIds?.root?.message;

  const tagged = catIds
    .map((id) => cats.find((c) => c.id === Number(id)))
    .filter((c): c is Cat => c !== undefined);
  const title = tagged.map((c) => c.name).join(", ") || `New ${itemLabel.toLowerCase()}`;
  // Cats already tagged stay listed even if no longer pickable (e.g. since
  // picked up), so they show as chips and can still be removed.
  const catOptions = [
    ...pickableCats,
    ...tagged.filter((c) => !pickableCats.some((p) => p.id === c.id)),
  ].map((c) => ({ id: c.id, name: c.name }));

  function setCatIds(ids: number[]) {
    form.setValue(`${name}.${index}.catIds` as const, ids, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  function handleDone() {
    if (catIds.length === 0) {
      form.setError(`${name}.${index}.catIds` as const, { message: NO_CATS_MESSAGE });
      return;
    }
    onCloseEditor(false);
  }

  return (
    <div
      data-testid={`${name}-card`}
      className={cn(
        "flex gap-3 rounded-md border bg-white p-3",
        catError ? "border-destructive" : "border-input",
      )}
    >
      <button type="button" className="min-w-0 flex-1 space-y-1 text-left" onClick={onOpenEditor}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{title}</span>
          {tagged.map((c) => (
            <CollarDot key={c.id} color={c.collarColor} />
          ))}
        </div>
        {note?.trim() && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{note.trim()}</p>
        )}
        <ErrorMessage message={catError} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={`Actions for ${itemLabel.toLowerCase()} ${title}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpenEditor}>
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmingRemove(true)}>
            <Trash2 className="h-4 w-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={editing}
        onOpenChange={(open) => (open ? onOpenEditor() : onCloseEditor(isNew))}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="pr-6">
              {isNew ? `New ${itemLabel.toLowerCase()}` : `Edit ${itemLabel.toLowerCase()}`}
            </DialogTitle>
          </DialogHeader>
          <div className="-mx-6 min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-1">
            <div className="space-y-2">
              <Label>Cats</Label>
              <CatMultiSelect cats={catOptions} selectedIds={catIds} onChange={setCatIds} />
              {selectAllCatIds && selectAllCatIds.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={selectAllCatIds.every((id) => catIds.includes(id))}
                  onClick={() => setCatIds([...new Set([...catIds, ...selectAllCatIds])])}
                >
                  Select all cats
                </Button>
              )}
              <ErrorMessage message={catError} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${name}.${index}.note`}>{noteLabel}</Label>
              <Textarea
                id={`${name}.${index}.note`}
                className="min-h-16"
                {...register(`${name}.${index}.note` as const)}
              />
            </div>
          </div>
          <div className="mt-4 flex shrink-0 justify-end">
            <Button type="button" onClick={handleDone}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingRemove} onOpenChange={setConfirmingRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this {itemLabel.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {title} and its note from this report.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function CatNoteGroupList({
  form,
  name,
  title,
  itemLabel,
  addLabel,
  cats,
  pickableCats,
  selectAllCatIds,
  noteLabel = "Note (optional)",
  onEditDone,
}: CatNoteGroupListProps) {
  const fieldArray = useFieldArray({ control: form.control, name });
  // Keyed by useFieldArray's stable field.id (indices shift on remove).
  const [editingId, setEditingId] = useState<string | null>(null);
  // Entries added in this editor session and not yet confirmed with Done —
  // closing one of these with no cats tagged discards it.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const openNewRef = useRef(false);

  // append() doesn't hand back the new field's id; pick it up on the next
  // render and open its editor.
  const lastId = fieldArray.fields.at(-1)?.id;
  useEffect(() => {
    if (!openNewRef.current || !lastId) return;
    openNewRef.current = false;
    setEditingId(lastId);
    setNewIds((prev) => new Set(prev).add(lastId));
  }, [lastId]);

  function closeEditor(id: string, index: number, removeIfEmpty: boolean) {
    const catIds = form.getValues(`${name}.${index}.catIds` as const) ?? [];
    setEditingId(null);
    setNewIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (removeIfEmpty && catIds.length === 0) {
      fieldArray.remove(index);
      return;
    }
    onEditDone();
  }

  return (
    <FormSection
      title={title}
      count={fieldArray.fields.length}
      anchorId={`section-${name}`}
      headerExtra={
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            openNewRef.current = true;
            fieldArray.append({ note: "", catIds: [] });
          }}
        >
          {addLabel}
        </Button>
      }
    >
      {fieldArray.fields.map((field, index) => (
        <GroupEntryCard
          key={field.id}
          form={form}
          name={name}
          index={index}
          itemLabel={itemLabel}
          cats={cats}
          pickableCats={pickableCats}
          isNew={newIds.has(field.id)}
          editing={editingId === field.id}
          onOpenEditor={() => setEditingId(field.id)}
          onCloseEditor={(removeIfEmpty) => closeEditor(field.id, index, removeIfEmpty)}
          onRemove={() => {
            fieldArray.remove(index);
            onEditDone();
          }}
          selectAllCatIds={selectAllCatIds}
          noteLabel={noteLabel}
        />
      ))}
    </FormSection>
  );
}
