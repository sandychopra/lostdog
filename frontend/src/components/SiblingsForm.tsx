import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import ErrorAlert from "./ErrorAlert";
import type { Cat } from "./CatsTable";

interface SiblingsFormProps {
  catId: number;
}

export default function SiblingsForm({ catId }: SiblingsFormProps) {
  const queryClient = useQueryClient();
  const [selectedToAdd, setSelectedToAdd] = useState<number[]>([]);

  const { data: cats } = useQuery({
    queryKey: ["cats"],
    queryFn: async () => {
      const { data } = await api.get<{ cats: Cat[] }>("/api/cats");
      return data.cats;
    },
  });

  const cat = cats?.find((c) => c.id === catId);
  const currentSiblings = cat?.litter?.cats.filter((c) => c.id !== catId) ?? [];
  const eligibleToAdd = (cats ?? []).filter((c) => c.id !== catId && c.litterId === null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cats"] });

  const addMutation = useMutation({
    mutationFn: async (targetIds: number[]) => {
      if (!cat?.litter) {
        await api.post("/api/litters", { catIds: [catId, ...targetIds] });
      } else {
        await Promise.all(
          targetIds.map((id) => api.post(`/api/litters/${cat.litter!.id}/cats`, { catId: id })),
        );
      }
    },
    onSuccess: () => {
      setSelectedToAdd([]);
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (targetCatId: number) => {
      await api.delete(`/api/litters/${cat!.litter!.id}/cats/${targetCatId}`);
    },
    onSuccess: () => invalidate(),
  });

  if (!cat) return null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <Label>Current siblings</Label>
          {currentSiblings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No siblings tagged yet.</p>
          ) : (
            <ul className="space-y-1">
              {currentSiblings.map((sibling) => (
                <li key={sibling.id} className="flex items-center justify-between text-sm">
                  {sibling.name}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(sibling.id)}
                    aria-label={`Remove ${sibling.name} as a sibling`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {removeMutation.isError && (
          <ErrorAlert error={removeMutation.error} fallback="Failed to remove sibling" />
        )}
        <div className="space-y-2">
          <Label>Add siblings</Label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-input p-2">
            {eligibleToAdd.length === 0 && (
              <p className="text-sm text-muted-foreground">No other untagged cats available.</p>
            )}
            {eligibleToAdd.map((candidate) => (
              <label key={candidate.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedToAdd.includes(candidate.id)}
                  onCheckedChange={() =>
                    setSelectedToAdd((prev) =>
                      prev.includes(candidate.id)
                        ? prev.filter((id) => id !== candidate.id)
                        : [...prev, candidate.id],
                    )
                  }
                />
                {candidate.name}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="shrink-0 space-y-4 pt-4">
        {addMutation.isError && (
          <ErrorAlert error={addMutation.error} fallback="Failed to add sibling" />
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={selectedToAdd.length === 0 || addMutation.isPending}
            onClick={() => addMutation.mutate(selectedToAdd)}
          >
            {addMutation.isPending ? "Adding..." : "Add Selected"}
          </Button>
        </div>
      </div>
    </div>
  );
}
