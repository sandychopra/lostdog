/** Safe-for-download filename for a photo: `<date>_<shiftType>_<cat names|unassigned>.<ext>`. */
export function buildPhotoFilename(args: {
  date: Date;
  shiftType: string;
  catNames: string[];
  storageKey: string;
}): string {
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9-]+/g, "_").replace(/^_+|_+$/g, "");
  const date = args.date.toISOString().slice(0, 10);
  const cats = args.catNames.length > 0 ? args.catNames.map(clean).filter(Boolean).join("-") : "";
  const ext = /\.([a-zA-Z0-9]{1,5})$/.exec(args.storageKey)?.[1]?.toLowerCase() ?? "jpg";
  return `${date}_${args.shiftType}_${cats || "unassigned"}.${ext}`;
}

/** Appends -2, -3, … before the extension when a name was already used in this set. */
export function uniqueFilename(name: string, used: Set<string>): string {
  let candidate = name;
  let n = 2;
  const dot = name.lastIndexOf(".");
  const stem = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? "" : name.slice(dot);
  while (used.has(candidate)) candidate = `${stem}-${n++}${ext}`;
  used.add(candidate);
  return candidate;
}
