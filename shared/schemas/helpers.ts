// Form inputs submit "" for a blank field; zod's .optional() only accepts
// undefined, so schemas map "" to undefined first. Generic (not `unknown`) so
// a `.transform(emptyToUndefined)` keeps the field's type (e.g. string | undefined).
export const emptyToUndefined = <T>(val: T): T | undefined => (val === "" ? undefined : val);
