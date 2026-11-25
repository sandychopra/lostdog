import { useState } from "react";
import { useWatch } from "react-hook-form";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { formatFecalScore } from "shared/constants/fecalScore.ts";
import { isCatEntryUntouched } from "shared/schemas/shiftReports.ts";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
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
import CatEntryFields from "./CatEntryFields";
import GroupCatEntryFields from "./GroupCatEntryFields";
import CollarDot from "./CollarDot";
import KennelTile from "./KennelTile";
import ErrorMessage from "./ErrorMessage";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";
import type { ShiftReportFormApi } from "../lib/shiftReportForm";
import { cn } from "../lib/utils";

interface CatEntryCardProps {
  form: ShiftReportFormApi;
  index: number;
  cats: Cat[];
  kennels: Kennel[];
  onRemove: () => void;
  /** Called when the Edit dialog closes — a natural "done with this cat" moment to autosave. */
  onEditDone: () => void;
}

const NOTE_PREVIEW_LENGTH = 60;

function preview(note: string | undefined | null): string | null {
  const text = note?.trim();
  if (!text) return null;
  return text.length > NOTE_PREVIEW_LENGTH ? `${text.slice(0, NOTE_PREVIEW_LENGTH)}…` : text;
}

/**
 * One cat (or group) on the shift report, shown as a read-only summary. Its
 * fields are edited in a dialog opened from the ⋮ menu (or by tapping the
 * summary), and the card can be removed from the same menu — e.g. on a split
 * shift, when this half didn't look after that cat.
 */
export default function CatEntryCard({
  form,
  index,
  cats,
  kennels,
  onRemove,
  onEditDone,
}: CatEntryCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const entry = useWatch({ control: form.control, name: `catEntries.${index}` as const });
  const entryError = (form.formState.errors.catEntries?.[index] as { message?: string } | undefined)
    ?.message;

  if (!entry) return null;

  const isGroup = entry.entryType === CatEntryType.Group;
  // Native <select>/hidden-input values can be strings until parsed — coerce ids.
  const group = isGroup
    ? kennels.flatMap((k) => k.groups).find((g) => g.id === Number(entry.groupId))
    : undefined;
  const groupKennel = isGroup
    ? kennels.find((k) => k.groups.some((g) => g.id === Number(entry.groupId)))
    : undefined;
  const cat = !isGroup ? cats.find((c) => c.id === Number(entry.catId)) : undefined;
  const members = isGroup
    ? (group?.cats ?? []).map((c) => cats.find((full) => full.id === c.id) ?? c)
    : cat
      ? [cat]
      : [];
  const title = members.length > 0 ? members.map((c) => c.name).join(" / ") : "Cat entry";
  const kennelNumber = isGroup ? groupKennel?.number : cat?.kennel?.number;

  const untouched = isCatEntryUntouched(entry);
  const fecal = formatFecalScore(entry);
  const notes = [
    preview(entry.peePoopNotes),
    preview(entry.foodNotes),
    !isGroup ? preview(entry.medicalNotes) : null,
  ].filter((n): n is string => n !== null);

  function closeEditor() {
    setEditing(false);
    onEditDone();
  }

  async function handleDone() {
    const valid = await form.trigger(`catEntries.${index}` as const);
    if (valid) closeEditor();
  }

  return (
    <div
      data-testid="cat-entry-card"
      className={cn(
        "flex gap-3 rounded-md border bg-white p-3",
        entryError ? "border-destructive" : "border-input",
      )}
    >
      <KennelTile number={kennelNumber} />
      <button
        type="button"
        className="min-w-0 flex-1 space-y-1.5 text-left"
        onClick={() => setEditing(true)}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{title}</span>
          {members.map((c) =>
            "collarColor" in c ? <CollarDot key={c.id} color={c.collarColor} /> : null,
          )}
          {untouched && <Badge variant="warning">Needs info</Badge>}
        </div>
        {!untouched && (
          <div className="flex flex-wrap gap-1">
            {fecal && <Badge variant="outline">Fecal: {fecal}</Badge>}
            {entry.pee && <Badge variant="outline">Pee</Badge>}
            {entry.dryFoodAmount && <Badge variant="outline">Dry: {entry.dryFoodAmount}</Badge>}
            {!isGroup && entry.wetFoodAmount && (
              <Badge variant="outline">Wet: {entry.wetFoodAmount}</Badge>
            )}
            {isGroup &&
              (entry.catDetails ?? []).map((detail) => {
                const name = members.find((m) => m.id === Number(detail.catId))?.name;
                return detail.wetFoodAmount && name ? (
                  <Badge key={detail.catId} variant="outline">
                    {name} wet: {detail.wetFoodAmount}
                  </Badge>
                ) : null;
              })}
          </div>
        )}
        {notes.length > 0 && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{notes.join(" · ")}</p>
        )}
        <ErrorMessage message={entryError} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={`Actions for ${title}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>
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

      <Dialog open={editing} onOpenChange={(open) => (open ? setEditing(true) : closeEditor())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-6">
              {kennelNumber !== undefined && (
                <span className="text-muted-foreground">Kennel {kennelNumber} ·</span>
              )}
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6 pb-1">
            {isGroup ? (
              <GroupCatEntryFields form={form} index={index} cats={cats} />
            ) : (
              <CatEntryFields form={form} index={index} />
            )}
          </div>
          <div className="mt-4 flex shrink-0 justify-end">
            <Button type="button" onClick={() => void handleDone()}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingRemove} onOpenChange={setConfirmingRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the card and anything entered on it from this report. You can add the cat
              back from &ldquo;Add a cat…&rdquo;.
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
