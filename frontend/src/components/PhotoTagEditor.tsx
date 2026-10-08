import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import CatMultiSelect from "./CatMultiSelect";

interface PhotoTagEditorProps {
  photoId: number;
  initialCatIds: number[];
  catOptions: { id: number; name: string }[];
  onSaved?: () => void;
}

// Shared by the shift-report photo section and the Photos browse page.
export default function PhotoTagEditor({
  photoId,
  initialCatIds,
  catOptions,
  onSaved,
}: PhotoTagEditorProps) {
  const queryClient = useQueryClient();
  const [draftCatIds, setDraftCatIds] = useState(initialCatIds);

  const tagMutation = useMutation({
    mutationFn: (catIds: number[]) => api.put(`/api/photos/${photoId}/tags`, { catIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shiftReports"] });
      queryClient.invalidateQueries({ queryKey: ["photos"] });
      queryClient.invalidateQueries({ queryKey: ["catHistory"] });
      onSaved?.();
    },
  });

  return (
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
      {tagMutation.isError && <p className="text-xs text-destructive">Couldn&apos;t save tags</p>}
    </div>
  );
}
