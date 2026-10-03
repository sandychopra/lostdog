import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Pencil } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import AuthenticatedImage from "./AuthenticatedImage";
import CatMultiSelect from "./CatMultiSelect";

export interface QueuedPhoto {
  file: File;
  catIds: number[];
}

export interface UploadedPhotoSummary {
  id: number;
  tags: { catId: number; cat: { id: number; name: string } }[];
}

interface CatOption {
  id: number;
  name: string;
}

interface PhotoUploadSectionProps {
  queued: QueuedPhoto[];
  onQueuedChange: (next: QueuedPhoto[]) => void;
  uploaded?: UploadedPhotoSummary[];
  catOptions: CatOption[];
  // Individual cat entries auto-tag server-side, so they don't need a tag
  // picker; group entries and the report-level section do (see photos.ts).
  showTagPicker?: boolean;
}

function QueuedThumb({
  photo,
  onRemove,
  onTagsChange,
  catOptions,
  showTagPicker,
}: {
  photo: QueuedPhoto;
  onRemove: () => void;
  onTagsChange: (catIds: number[]) => void;
  catOptions: CatOption[];
  showTagPicker?: boolean;
}) {
  const [editingTags, setEditingTags] = useState(false);
  const previewUrl = useMemo(() => URL.createObjectURL(photo.file), [photo.file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <div className="relative w-28 rounded-md border border-input p-1.5">
      <button
        type="button"
        className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-white"
        onClick={onRemove}
        aria-label="Remove photo"
      >
        <X className="h-3 w-3" />
      </button>
      <img src={previewUrl} alt="Queued upload" className="h-24 w-full rounded object-cover" />
      {showTagPicker && (
        <div className="mt-1">
          <button
            type="button"
            className="text-xs text-blue hover:underline"
            onClick={() => setEditingTags((v) => !v)}
          >
            {photo.catIds.length > 0 ? `${photo.catIds.length} tagged` : "Tag cats"}
          </button>
          {editingTags && (
            <CatMultiSelect cats={catOptions} selectedIds={photo.catIds} onChange={onTagsChange} />
          )}
        </div>
      )}
    </div>
  );
}

function UploadedThumb({
  photo,
  catOptions,
  showTagPicker,
}: {
  photo: UploadedPhotoSummary;
  catOptions: CatOption[];
  showTagPicker?: boolean;
}) {
  const queryClient = useQueryClient();
  const [editingTags, setEditingTags] = useState(false);
  const [draftCatIds, setDraftCatIds] = useState(photo.tags.map((t) => t.catId));

  const tagMutation = useMutation({
    mutationFn: (catIds: number[]) => api.put(`/api/photos/${photo.id}/tags`, { catIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shiftReports"] });
      setEditingTags(false);
    },
  });

  return (
    <div className="w-28 rounded-md border border-input p-1.5">
      <AuthenticatedImage
        photoId={photo.id}
        alt="Shift report photo"
        className="h-24 w-full rounded object-cover"
      />
      <div className="mt-1 flex items-center justify-between gap-1">
        <span className="truncate text-xs text-muted-foreground">
          {photo.tags.length > 0 ? photo.tags.map((t) => t.cat.name).join(", ") : "Unassigned"}
        </span>
        {showTagPicker && (
          <button
            type="button"
            className="shrink-0 text-blue"
            onClick={() => setEditingTags((v) => !v)}
            aria-label="Edit tags"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>
      {editingTags && (
        <div className="mt-1 space-y-1">
          <CatMultiSelect cats={catOptions} selectedIds={draftCatIds} onChange={setDraftCatIds} />
          <Button
            type="button"
            className="h-7 px-3 text-xs"
            disabled={tagMutation.isPending}
            onClick={() => tagMutation.mutate(draftCatIds)}
          >
            Save Tags
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PhotoUploadSection({
  queued,
  onQueuedChange,
  uploaded = [],
  catOptions,
  showTagPicker = true,
}: PhotoUploadSectionProps) {
  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    onQueuedChange([
      ...queued,
      ...Array.from(files).map((file) => ({ file, catIds: [] as number[] })),
    ]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {uploaded.map((photo) => (
          <UploadedThumb
            key={photo.id}
            photo={photo}
            catOptions={catOptions}
            showTagPicker={showTagPicker}
          />
        ))}
        {queued.map((photo, index) => (
          <QueuedThumb
            key={index}
            photo={photo}
            catOptions={catOptions}
            showTagPicker={showTagPicker}
            onRemove={() => onQueuedChange(queued.filter((_, i) => i !== index))}
            onTagsChange={(catIds) =>
              onQueuedChange(queued.map((p, i) => (i === index ? { ...p, catIds } : p)))
            }
          />
        ))}
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        Add Photo
      </label>
    </div>
  );
}
