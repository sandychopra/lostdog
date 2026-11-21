import type { CollarColor } from "shared/constants/collarColor.ts";

// Dot colors for each collar picklist entry. Picked to stay distinguishable from
// each other at 14px, not to be brand colors, so they live here rather than in
// the theme. A value outside the picklist ("Other") draws as a gray dot.
export const COLLAR_COLOR_HEX: Record<CollarColor, string> = {
  Red: "#d43d3d",
  Orange: "#ee8424",
  Yellow: "#f2c81b",
  Green: "#2e9e5b",
  Blue: "#2457d6",
  "Light blue": "#72bff0",
  Purple: "#8a56c6",
  Pink: "#e2609b",
  Black: "#1d2433",
  White: "#ffffff",
};

export const OTHER_COLLAR_HEX = "#9aa2b3";
