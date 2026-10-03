interface CatOption {
  id: number;
  name: string;
}

interface CatMultiSelectProps {
  cats: CatOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  emptyMessage?: string;
}

// Extracted from CreateGroupForm.tsx's inline scrollable-checkbox-list pattern
// once shift reports gave it a third+ call site (play tags, meet-and-greets,
// photo tags).
export default function CatMultiSelect({
  cats,
  selectedIds,
  onChange,
  emptyMessage = "No cats available.",
}: CatMultiSelectProps) {
  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-input p-2">
      {cats.length === 0 && <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
      {cats.map((cat) => (
        <label key={cat.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={selectedIds.includes(cat.id)}
            onChange={() => toggle(cat.id)}
          />
          {cat.name}
        </label>
      ))}
    </div>
  );
}
