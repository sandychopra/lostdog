import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export interface CatOption {
  id: number;
  name: string;
  active: boolean;
}

/** All cats (including inactive, i.e. returned to RCC) for filters and tag pickers. */
export function useCatOptions() {
  return useQuery({
    queryKey: ["cats", "options"],
    queryFn: async () => {
      const { data } = await api.get<{ cats: CatOption[] }>("/api/cats", {
        params: { includeInactive: true },
      });
      return data.cats;
    },
  });
}

export function catOptionLabel(cat: CatOption): string {
  return cat.active ? cat.name : `${cat.name} (inactive)`;
}
