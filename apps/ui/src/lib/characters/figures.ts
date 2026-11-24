import { pack } from "@repo/game";
import type { JobId } from "@repo/game";
import { HEADS } from "./figures.generated.ts";

// A found occupation brings its own person, whatever portrait the character was given.
const SPECIALIST: Partial<Record<JobId, string>> = {
  immunologist: "immunologist",
  vectorControl: "vector-control",
  scientist: "scientist",
};

/** Which figure a character is drawn as: `apps/ui/static/figures/<key>.webp`, made by `scripts/gen-figures.ts`. */
export function figureKey({
  portrait,
  job = null,
  hooded = false,
}: {
  portrait: number;
  job?: JobId | null;
  hooded?: boolean;
}) {
  if (hooded) return "haven-worker";
  return (job && SPECIALIST[job]) || `survivor-${portrait % pack.numbers.portraits}`;
}

/** The figure an occupation brings with it, if it brings one. */
export const jobFigure = (job: JobId) => SPECIALIST[job] ?? null;

export const figureUrl = (key: string) => `/figures/${key}.webp`;

/** The figure drawn for a character not made yet, before anyone picks a face. */
export const UNKNOWN_FIGURE = figureUrl("unknown");

/** Where a figure's head is, as fractions of its width and height, and the side of a square headshot of it. */
export function headOf(key: string) {
  const head = HEADS[key];
  if (!head)
    throw new Error(
      `No head found for the figure ${key}: run apps/ui/scripts/gen-figures.ts --heads`,
    );
  return head;
}

const missing = [
  ...Array.from({ length: pack.numbers.portraits }, (_, index) => `survivor-${index}`),
  ...Object.values(SPECIALIST),
  "haven-worker",
].filter((key) => !HEADS[key]);
if (missing.length)
  throw new Error(`No figure for: ${missing.join(", ")}. Run apps/ui/scripts/gen-figures.ts`);
