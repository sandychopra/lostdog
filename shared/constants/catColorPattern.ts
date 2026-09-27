// Not an enum — colorPattern stays free text in the schema/validation so a
// value outside this list ("Other") still passes through unchanged. This is
// only the suggested picklist shown in the UI.
export const CAT_COLOR_PATTERNS = [
  "Black",
  "Black & White",
  "White",
  "Gray / Gray Tabby",
  "Orange / Orange Tabby",
  "Brown Tabby",
  "Calico",
  "Tortoiseshell",
  "Tuxedo",
  "Siamese",
  "Silver Tabby",
  "Tortie & White",
  "Seal Point",
] as const;
