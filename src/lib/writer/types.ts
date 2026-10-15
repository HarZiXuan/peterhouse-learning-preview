/** What every writer returns, still using "[Child]" in place of the name. */
export type WrittenDraft = {
  opening: string;
  areas: Record<string, string>;
  closing: string;
  homeIdeas: string[];
};
