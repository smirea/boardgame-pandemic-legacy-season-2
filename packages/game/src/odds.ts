import type { CardId } from "./ids";

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return result;
}

/** Chance that at least one of `hits` marked cards shows up when drawing `draws` from `size`. */
function atLeastOne(size: number, hits: number, draws: number): number {
  if (hits <= 0 || draws <= 0) return 0;
  if (draws >= size) return 1;
  return 1 - choose(size - hits, draws) / choose(size, draws);
}

/** How one Infect step flips its cards. */
export type InfectStep = {
  /** City cards flipped that infect, after any that follow a Gather card. */
  infects: number;
  /** City cards flipped after those that place a Hollow Man instead (the last setup infections). */
  hollows: number;
  /** A Gather card is already face up, waiting for the next city. */
  gathering: boolean;
};

/**
 * For each city key in the deck, the exact chance that the next Infect step infects it at least once, and
 * the chance it places a Hollow Man there at least once. A Gather card (`keyOf` gives null) does not count
 * toward the step's cards: the city flipped right after it gets a Hollow Man instead of the infection.
 * Strata are consumed top first and shuffled within, so the walk only needs how many of the city's cards,
 * Gather cards and other cards are left in the stratum being drawn.
 */
export function infectOdds<K extends string>(
  strata: readonly CardId[][],
  step: InfectStep,
  keyOf: (card: CardId) => K | null,
): { infect: Map<K, number>; hollow: Map<K, number> } {
  const keys = new Set<K>();
  for (const stratum of strata)
    for (const card of stratum) {
      const key = keyOf(card);
      if (key !== null) keys.add(key);
    }
  const flips = step.infects + step.hollows;
  const infect = new Map<K, number>();
  const hollow = new Map<K, number>();
  for (const key of keys) {
    const layers = strata.map((stratum) => {
      let mine = 0;
      let gathers = 0;
      for (const card of stratum) {
        const of = keyOf(card);
        if (of === key) mine++;
        else if (of === null) gathers++;
      }
      return { mine, gathers, others: stratum.length - mine - gathers };
    });
    const chance = (want: "infect" | "hollow") => {
      const memo = new Map<string, number>();
      const walk = (
        layer: number,
        mine: number,
        gathers: number,
        others: number,
        flipped: number,
        gathering: boolean,
      ): number => {
        const left = mine + gathers + others;
        if (left === 0) {
          const next = layers[layer + 1];
          return next
            ? walk(layer + 1, next.mine, next.gathers, next.others, flipped, gathering)
            : 0;
        }
        const id = `${layer},${mine},${gathers},${others},${flipped},${gathering}`;
        const known = memo.get(id);
        if (known !== undefined) return known;
        let total = 0;
        if (gathers)
          total += (gathers / left) * walk(layer, mine, gathers - 1, others, flipped, true);
        if (others && flipped + 1 < flips)
          total += (others / left) * walk(layer, mine, gathers, others - 1, flipped + 1, false);
        if (mine) {
          const effect = gathering || flipped >= step.infects ? "hollow" : "infect";
          const after =
            effect === want
              ? 1
              : flipped + 1 < flips
                ? walk(layer, mine - 1, gathers, others, flipped + 1, false)
                : 0;
          total += (mine / left) * after;
        }
        memo.set(id, total);
        return total;
      };
      const top = layers[0];
      return flips > 0 && top ? walk(0, top.mine, top.gathers, top.others, 0, step.gathering) : 0;
    };
    infect.set(key, chance("infect"));
    hollow.set(key, chance("hollow"));
  }
  return { infect, hollow };
}

/** Expected number of copies of each key drawn in the next `draws` cards. */
export function expectedDraws<K extends string>(
  strata: readonly CardId[][],
  draws: number,
  keyOf: (card: CardId) => K,
): Map<K, number> {
  const expected = new Map<K, number>();
  let remaining = draws;
  for (const stratum of strata) {
    if (remaining <= 0) break;
    const taken = Math.min(remaining, stratum.length);
    for (const card of stratum)
      expected.set(keyOf(card), (expected.get(keyOf(card)) ?? 0) + taken / stratum.length);
    remaining -= taken;
  }
  return expected;
}

/** Chance of at least one epidemic in the next `draws` player cards. */
export function epidemicOdds(
  piles: readonly { size: number; epidemics: number }[],
  draws: number,
): number {
  let miss = 1;
  let remaining = draws;
  for (const pile of piles) {
    if (remaining <= 0) break;
    const taken = Math.min(remaining, pile.size);
    miss *= 1 - atLeastOne(pile.size, pile.epidemics, taken);
    remaining -= taken;
  }
  return 1 - miss;
}

/** How many more draws until the next epidemic is certain to have appeared, or null when none are left. */
export function drawsUntilEpidemicCertain(
  piles: readonly { size: number; epidemics: number }[],
): number | null {
  let draws = 0;
  for (const pile of piles) {
    draws += pile.size;
    if (pile.epidemics > 0) return draws;
  }
  return null;
}
