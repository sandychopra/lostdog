import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserMinus } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import ErrorAlert from "./ErrorAlert";
import type { Cat } from "./CatsTable";

interface EditGroupFormProps {
  groupId: number;
}

export default function EditGroupForm({ groupId }: EditGroupFormProps) {
  const queryClient = useQueryClient();
  const [selectedToAdd, setSelectedToAdd] = useState<number[]>([]);

  const { data: cats } = useQuery({
    queryKey: ["cats"],
    queryFn: async () => {
      const { data } = await api.get<{ cats: Cat[] }>("/api/cats");
      return data.cats;
    },
  });

  const members = (cats ?? []).filter((c) => c.groupId === groupId);
  const eligibleToAdd = (cats ?? []).filter((c) => c.groupId === null);
  const bonded = members[0]?.group?.bonded ?? false;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cats"] });
    queryClient.invalidateQueries({ queryKey: ["kennels"] });
  };

  const addMutation = useMutation({
    mutationFn: async (targetIds: number[]) => {
      await Promise.all(
        targetIds.map((catId) => api.post(`/api/groups/${groupId}/cats`, { catId })),
      );
    },
    onSuccess: () => {
      setSelectedToAdd([]);
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (catId: number) => api.delete(`/api/groups/${groupId}/cats/${catId}`),
    onSuccess: () => invalidate(),
  });

  const bondedMutation = useMutation({
    mutationFn: (value: boolean) => api.put(`/api/groups/${groupId}`, { bonded: value }),
    onSuccess: () => invalidate(),
  });

  if (members.length === 0) return null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <Label>Current members</Label>
          <ul className="space-y-1">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between text-sm">
                {member.name}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(member.id)}
                  aria-label={`Remove ${member.name} from group`}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
        {removeMutation.isError && (
          <ErrorAlert error={removeMutation.error} fallback="Failed to remove cat from group" />
        )}
        <div className="space-y-2">
          <Label>Add cats</Label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-input p-2">
            {eligibleToAdd.length === 0 && (
              <p className="text-sm text-muted-foreground">No ungrouped cats available.</p>
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
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={selectedToAdd.length === 0 || addMutation.isPending}
              onClick={() => addMutation.mutate(selectedToAdd)}
            >
              {addMutation.isPending ? "Adding..." : "Add Selected"}
            </Button>
          </div>
        </div>
        {addMutation.isError && (
          <ErrorAlert error={addMutation.error} fallback="Failed to add cat to group" />
        )}
        <div className="flex items-center gap-2">
          <Checkbox
            id="bonded"
            checked={bonded}
            disabled={members.length !== 2 || bondedMutation.isPending}
            onCheckedChange={(checked) => bondedMutation.mutate(checked === true)}
          />
          <Label htmlFor="bonded">Bonded pair (only settable for exactly 2 cats)</Label>
        </div>
        {bondedMutation.isError && (
          <ErrorAlert error={bondedMutation.error} fallback="Failed to update bonded flag" />
        )}
      </div>
    </div>
  );
}
