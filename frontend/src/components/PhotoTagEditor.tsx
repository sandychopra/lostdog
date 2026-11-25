import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import CatMultiSelect, { type CatOption } from "./CatMultiSelect";
import type { UploadedPhotoSummary } from "./PhotoUploadSection";

// Short pause so picking several cats in a row is one request, not one each.
const SAVE_DEBOUNCE_MS = 500;

interface PhotoTagEditorProps {
  photoId: number;
  initialCatIds: number[];
  catOptions: CatOption[];
  /** Called with the updated photo after each successful save. */
  onSaved?: (photo: UploadedPhotoSummary) => void;
  onDone: () => void;
}

// Shared by the shift-report photo section and the Photos browse page. Tag
// changes save on their own — there's no Save button to forget.
export default function PhotoTagEditor({
  photoId,
  initialCatIds,
  catOptions,
  onSaved,
  onDone,
}: PhotoTagEditorProps) {
  const queryClient = useQueryClient();
  const [catIds, setCatIds] = useState(initialCatIds);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const pendingRef = useRef<number[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Saves run one after another so an older selection can't land last.
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  function flush() {
    clearTimeout(timerRef.current);
    const ids = pendingRef.current;
    if (ids === null) return;
    pendingRef.current = null;
    setStatus("saving");
    chainRef.current = chainRef.current.then(async () => {
      try {
        const { data } = await api.put(`/api/photos/${photoId}/tags`, { catIds: ids });
        if (pendingRef.current === null) setStatus("saved");
        onSavedRef.current?.(data.photo as UploadedPhotoSummary);
        queryClient.invalidateQueries({ queryKey: ["shiftReports"] });
        queryClient.invalidateQueries({ queryKey: ["photos"] });
        queryClient.invalidateQueries({ queryKey: ["catHistory"] });
      } catch {
        setStatus("error");
      }
    });
  }

  // Closing the editor (or leaving the page) mid-pause still saves.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current(), []);

  function handleChange(next: number[]) {
    setCatIds(next);
    pendingRef.current = next;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }

  return (
    <div className="mt-1 space-y-1">
      <CatMultiSelect cats={catOptions} selectedIds={catIds} onChange={handleChange} />
      <div className="flex items-center justify-between gap-2">
        <span
          className={
            status === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"
          }
          aria-live="polite"
        >
          {status === "saving"
            ? "Saving…"
            : status === "saved"
              ? "Saved"
              : status === "error"
                ? "Couldn't save tags"
                : null}
        </span>
        <Button
          type="button"
          variant="secondary"
          className="h-7 px-3 text-xs"
          onClick={() => {
            flush();
            onDone();
          }}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
