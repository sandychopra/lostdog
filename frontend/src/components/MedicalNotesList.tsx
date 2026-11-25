import { useEffect, useRef, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
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
import CollarDot from "./CollarDot";
import KennelTile from "./KennelTile";
import FormSection from "./FormSection";
import type { Cat } from "./CatsTable";
import type { ShiftReportFormApi } from "../lib/shiftReportForm";
import { cn } from "../lib/utils";

interface MedicalNotesListProps {
  form: ShiftReportFormApi;
  /** Every cat, for showing a name already on a note. */
  cats: Cat[];
  /** The cats a note can be written about (in care). */
  pickableCats: Cat[];
  /** Called when an editor closes — a natural moment to autosave. */
  onEditDone: () => void;
}

function kennelNumberOf(cat: Cat | undefined): number | undefined {
  return cat?.kennel?.number ?? cat?.group?.kennel?.number;
}

function MedicalNoteCard({
  form,
  index,
  cats,
  pickableCats,
  takenCatIds,
  isNew,
  editing,
  onOpenEditor,
  onCloseEditor,
  onRemove,
}: {
  form: ShiftReportFormApi;
  index: number;
  cats: Cat[];
  pickableCats: Cat[];
  takenCatIds: Set<number>;
  isNew: boolean;
  editing: boolean;
  onOpenEditor: () => void;
  onCloseEditor: (discardIfNoCat: boolean) => void;
  onRemove: () => void;
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const base = `medicalNotes.${index}` as const;
  const rawCatId = useWatch({ control: form.control, name: `${base}.catId` as const });
  const note = useWatch({ control: form.control, name: `${base}.note` as const }) ?? "";
  // Native <select> values are strings until parsed.
  const catId = Number(rawCatId) || undefined;
  const cat = cats.find((c) => c.id === catId);
  const errors = form.formState.errors.medicalNotes?.[index];
  const error = errors?.catId?.message ?? errors?.note?.message ?? errors?.message;
  const title = cat?.name ?? "New medical note";

  // This note's own cat stays listed even if it's no longer pickable.
  const options = [
    ...pickableCats.filter((c) => c.id === catId || !takenCatIds.has(c.id)),
    ...(cat && !pickableCats.some((c) => c.id === cat.id) ? [cat] : []),
  ].sort((a, b) => a.name.localeCompare(b.name));

  function handleDone() {
    let ok = true;
    if (!catId) {
      form.setError(`${base}.catId` as const, { message: "Pick a cat" });
      ok = false;
    }
    if (!note.trim()) {
      form.setError(`${base}.note` as const, { message: "Write the note" });
      ok = false;
    }
    if (ok) {
      form.clearErrors(base);
      onCloseEditor(false);
    }
  }

  return (
    <div
      data-testid="medical-note-card"
      className={cn(
        "flex gap-3 rounded-md border bg-white p-3",
        error ? "border-destructive" : "border-input",
      )}
    >
      <KennelTile number={kennelNumberOf(cat)} />
      <button type="button" className="min-w-0 flex-1 space-y-1 text-left" onClick={onOpenEditor}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{title}</span>
          {cat && <CollarDot color={cat.collarColor} />}
        </div>
        {note.trim() && <p className="line-clamp-2 text-sm text-muted-foreground">{note.trim()}</p>}
        <ErrorMessage message={error} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={`Actions for medical note ${title}`}
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
              {isNew ? "New medical note" : "Edit medical note"}
            </DialogTitle>
          </DialogHeader>
          <div className="-mx-6 min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-1">
            <div className="space-y-2">
              <Label htmlFor={`${base}.catId`}>Cat</Label>
              <NativeSelect
                id={`${base}.catId`}
                aria-invalid={errors?.catId ? true : undefined}
                {...form.register(`${base}.catId` as const, {
                  onChange: () => form.clearErrors(`${base}.catId` as const),
                })}
              >
                <NativeSelectOption value="">Select a cat…</NativeSelectOption>
                {options.map((c) => (
                  <NativeSelectOption key={c.id} value={String(c.id)}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <ErrorMessage message={errors?.catId?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${base}.note`}>Note</Label>
              <Textarea
                id={`${base}.note`}
                className="min-h-24"
                aria-invalid={errors?.note ? true : undefined}
                {...form.register(`${base}.note` as const, {
                  onChange: () => form.clearErrors(`${base}.note` as const),
                })}
              />
              <ErrorMessage message={errors?.note?.message} />
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
            <AlertDialogTitle>Remove this medical note?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the medical note{cat ? ` for ${cat.name}` : ""} from this report.
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

/**
 * The report's medical notes: one note per cat, about any cat in care —
 * whether or not it has a Food card on this report. Starts empty.
 */
export default function MedicalNotesList({
  form,
  cats,
  pickableCats,
  onEditDone,
}: MedicalNotesListProps) {
  const fieldArray = useFieldArray({ control: form.control, name: "medicalNotes" });
  const values = useWatch({ control: form.control, name: "medicalNotes" }) ?? [];
  const takenCatIds = new Set(values.map((v) => Number(v.catId)).filter(Boolean));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const openNewRef = useRef(false);

  // append() doesn't hand back the new field's id; open its editor once it renders.
  const lastId = fieldArray.fields.at(-1)?.id;
  useEffect(() => {
    if (!openNewRef.current || !lastId) return;
    openNewRef.current = false;
    setEditingId(lastId);
    setNewIds((prev) => new Set(prev).add(lastId));
  }, [lastId]);

  function closeEditor(id: string, index: number, discardIfNoCat: boolean) {
    const catId = Number(form.getValues(`medicalNotes.${index}.catId` as const));
    setEditingId(null);
    setNewIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // A new note closed before a cat was picked is discarded.
    if (discardIfNoCat && !catId) {
      fieldArray.remove(index);
      return;
    }
    onEditDone();
  }

  const allNoted = pickableCats.every((c) => takenCatIds.has(c.id));

  return (
    <FormSection
      title="Medical Notes"
      count={fieldArray.fields.length}
      anchorId="section-medical-notes"
      headerExtra={
        <Button
          type="button"
          variant="secondary"
          disabled={allNoted}
          onClick={() => {
            openNewRef.current = true;
            fieldArray.append({ catId: "" as unknown as number, note: "" });
          }}
        >
          Add medical note
        </Button>
      }
    >
      {fieldArray.fields.map((field, index) => (
        <MedicalNoteCard
          key={field.id}
          form={form}
          index={index}
          cats={cats}
          pickableCats={pickableCats}
          takenCatIds={takenCatIds}
          isNew={newIds.has(field.id)}
          editing={editingId === field.id}
          onOpenEditor={() => setEditingId(field.id)}
          onCloseEditor={(discard) => closeEditor(field.id, index, discard)}
          onRemove={() => {
            fieldArray.remove(index);
            onEditDone();
          }}
        />
      ))}
    </FormSection>
  );
}
