interface OpenTaskListProps<T> {
  title: string;
  items: T[];
  getId: (item: T) => number;
  getLabel: (item: T) => string;
  checkedIds: number[];
  onToggle: (id: number) => void;
}

// A checkbox list of pre-existing, system-generated items being marked done
// (Signs to post, Confirm pickup, and Slice 2's Kennel moves) — distinct from
// CatNoteGroupList's editable, user-authored field-array shape. Hidden entirely
// when there's nothing open, per the "hidden when none" convention these
// sections all share.
export default function OpenTaskList<T>({
  title,
  items,
  getId,
  getLabel,
  checkedIds,
  onToggle,
}: OpenTaskListProps<T>) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-1 rounded-md border border-input p-2">
        {items.map((item) => {
          const id = getId(item);
          return (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={checkedIds.includes(id)}
                onChange={() => onToggle(id)}
              />
              {getLabel(item)}
            </label>
          );
        })}
      </div>
    </section>
  );
}
