import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export interface CatOption {
  id: number;
  name: string;
}

interface CatMultiSelectProps {
  cats: CatOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  emptyMessage?: string;
}

// Picked cats show as removable chips; "Add cat" opens a type-to-filter list.
// Shared by play groups, meet-and-greets, and photo tags.
export default function CatMultiSelect({
  cats,
  selectedIds,
  onChange,
  emptyMessage = "No cats available.",
}: CatMultiSelectProps) {
  const [open, setOpen] = useState(false);

  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  const catsById = new Map(cats.map((cat) => [cat.id, cat]));
  const selectedCats = selectedIds
    .map((id) => catsById.get(id))
    .filter((cat): cat is CatOption => cat !== undefined);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedCats.map((cat) => (
        <Badge key={cat.id} variant="secondary" className="gap-1 pr-1">
          {cat.name}
          <button
            type="button"
            onClick={() => toggle(cat.id)}
            aria-label={`Remove ${cat.name}`}
            className="rounded-sm p-0.5 hover:bg-foreground/10"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="secondary" size="sm">
            <Plus className="h-4 w-4" />
            Add cat
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          {/* Plain substring match on the name: cmdk's default fuzzy scorer
              keeps loosely-matching names (e.g. "Sprite" for "pep"). */}
          <Command
            filter={(_value, search, keywords) =>
              keywords?.some((k) => k.toLowerCase().includes(search.toLowerCase())) ? 1 : 0
            }
          >
            <CommandInput placeholder="Search cats…" />
            <CommandList>
              <CommandEmpty>{cats.length === 0 ? emptyMessage : "No matching cats."}</CommandEmpty>
              <CommandGroup>
                {cats.map((cat) => (
                  <CommandItem
                    key={cat.id}
                    // cmdk filters/keys on value, so include the id to keep
                    // same-named cats distinct.
                    value={`${cat.name} ${cat.id}`}
                    keywords={[cat.name]}
                    data-checked={selectedIds.includes(cat.id)}
                    onSelect={() => toggle(cat.id)}
                  >
                    {cat.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
