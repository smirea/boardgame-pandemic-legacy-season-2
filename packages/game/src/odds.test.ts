import { describe, expect, test } from "bun:test";
import { drawBottom, drawPiled, drawTop, newDeck, newPiledDeck, stackOnTop } from "./decks";
import type { CardId } from "./ids";
import { drawsUntilEpidemicCertain, epidemicOdds, expectedDraws, infectOdds } from "./odds";

const cards = (...names: string[]) => names as CardId[];
const cityOf = (card: CardId) => card.split("#")[0]!;

const step = (infects: number, hollows = 0, gathering = false) => ({ infects, hollows, gathering });
const gatherOr = (card: CardId) => (card.startsWith("gather") ? null : cityOf(card));

/** Plays every order of one stratum through the Infect step's rules and counts what each city takes. */
function enumerate(stratum: CardId[], infects: number) {
  const orders = (left: CardId[]): CardId[][] =>
    left.length === 0
      ? [[]]
      : left.flatMap((card, i) => orders(left.toSpliced(i, 1)).map((rest) => [card, ...rest]));
  const infected = new Map<string, number>();
  const hollowed = new Map<string, number>();
  const all = orders(stratum);
  for (const order of all) {
    const hit = { infect: new Set<string>(), hollow: new Set<string>() };
    let flipped = 0;
    let gathering = false;
    for (const card of order) {
      if (flipped === infects) break;
      const city = gatherOr(card);
      if (city === null) {
        gathering = true;
        continue;
      }
      hit[gathering ? "hollow" : "infect"].add(city);
      gathering = false;
      flipped++;
    }
    for (const city of hit.infect) infected.set(city, (infected.get(city) ?? 0) + 1 / all.length);
    for (const city of hit.hollow) hollowed.set(city, (hollowed.get(city) ?? 0) + 1 / all.length);
  }
  return { infected, hollowed };
}

describe("infection draw odds", () => {
  test("a stratum that is fully drawn is certain", () => {
    const { infect } = infectOdds(
      [cards("paris#1", "cairo#1"), cards("lima#1", "lagos#1", "tokyo#1")],
      step(2),
      cityOf,
    );
    expect(infect.get("paris")).toBe(1);
    expect(infect.get("cairo")).toBe(1);
    expect(infect.get("lima")).toBe(0);
  });

  test("a partly drawn stratum is hypergeometric, and copies raise the odds", () => {
    const { infect } = infectOdds(
      [cards("paris#1", "paris#2", "cairo#1", "lima#1")],
      step(2),
      cityOf,
    );
    expect(infect.get("cairo")).toBeCloseTo(0.5);
    expect(infect.get("paris")).toBeCloseTo(1 - 1 / 6);
  });

  test("draws spill from the top stratum into the next", () => {
    const { infect } = infectOdds(
      [cards("paris#1"), cards("cairo#1", "lima#1", "lagos#1")],
      step(2),
      cityOf,
    );
    expect(infect.get("paris")).toBe(1);
    expect(infect.get("cairo")).toBeCloseTo(1 / 3);
  });

  test("expected copies sum to the number of draws", () => {
    const expected = expectedDraws([cards("paris#1", "paris#2", "cairo#1")], 2, cityOf);
    expect(expected.get("paris")).toBeCloseTo(4 / 3);
    expect([...expected.values()].reduce((sum, value) => sum + value, 0)).toBeCloseTo(2);
  });
});

describe("Hollow Men odds", () => {
  test("the city flipped after a Gather card gets a Hollow Man, and the Gather card does not count toward the rate", () => {
    const { infect, hollow } = infectOdds(
      [cards("gather#1"), cards("paris#1"), cards("cairo#1"), cards("lima#1")],
      step(2),
      gatherOr,
    );
    expect(hollow.get("paris")).toBe(1);
    expect(infect.get("paris")).toBe(0);
    expect(infect.get("cairo")).toBe(1);
    expect(infect.get("lima")).toBe(0);
  });

  test("a Gather card already face up sends the first city flipped a Hollow Man", () => {
    const { infect, hollow } = infectOdds(
      [cards("paris#1"), cards("cairo#1")],
      step(2, 0, true),
      gatherOr,
    );
    expect(hollow.get("paris")).toBe(1);
    expect(infect.get("cairo")).toBe(1);
  });

  test("the last setup flips place Hollow Men", () => {
    const { infect, hollow } = infectOdds(
      [cards("paris#1"), cards("cairo#1"), cards("lima#1")],
      step(1, 2),
      gatherOr,
    );
    expect(infect.get("paris")).toBe(1);
    expect(hollow.get("cairo")).toBe(1);
    expect(hollow.get("lima")).toBe(1);
  });

  test("the odds are exact over every order of a shuffled stratum", () => {
    const stratum = cards(
      "gather#1",
      "gather#2",
      "paris#1",
      "paris#2",
      "cairo#1",
      "lima#1",
      "lagos#1",
    );
    const { infect, hollow } = infectOdds([stratum], step(2), gatherOr);
    const truth = enumerate(stratum, 2);
    for (const city of ["paris", "cairo", "lima", "lagos"]) {
      expect(infect.get(city)).toBeCloseTo(truth.infected.get(city) ?? 0, 12);
      expect(hollow.get(city)).toBeCloseTo(truth.hollowed.get(city) ?? 0, 12);
    }
  });
});

describe("stratified deck", () => {
  test("strata track draws from both ends and restacked discards without exposing order", () => {
    const rng = { seed: 7 };
    const deck = newDeck(rng, cards("a", "b", "c", "d", "e"));
    const drawn = [drawTop(deck)!, drawTop(deck)!];
    const bottom = drawBottom(deck)!;
    expect(deck.strata).toEqual([deck.order.toSorted()]);
    stackOnTop(deck, rng, [...drawn, bottom]);
    expect(deck.strata[0]).toEqual([...drawn, bottom].sort());
    expect(deck.strata[1]).toEqual(deck.order.slice(3).sort());
    expect(deck.order.slice(0, 3).toSorted()).toEqual([...drawn, bottom].sort());
  });
});

describe("epidemic odds", () => {
  test("each pile holds exactly one epidemic and odds follow the pile boundaries", () => {
    const rng = { seed: 3 };
    const isEpidemic = (card: CardId) => card.startsWith("epi");
    const deck = newPiledDeck(
      rng,
      cards(...Array.from({ length: 20 }, (_, i) => `c${i}`)),
      cards("epi1", "epi2", "epi3", "epi4"),
    );
    expect(deck.piles).toEqual([
      { size: 6, epidemics: 1 },
      { size: 6, epidemics: 1 },
      { size: 6, epidemics: 1 },
      { size: 6, epidemics: 1 },
    ]);
    for (let pile = 0; pile < 4; pile++) {
      expect(deck.order.slice(pile * 6, pile * 6 + 6).filter(isEpidemic)).toHaveLength(1);
    }
    expect(epidemicOdds(deck.piles, 2)).toBeCloseTo(1 / 3);
    expect(drawsUntilEpidemicCertain(deck.piles)).toBe(6);

    let seen = 0;
    while (seen === 0) if (isEpidemic(drawPiled(deck, isEpidemic)!)) seen++;
    const left = deck.piles[0]!.epidemics === 0 ? deck.piles[0]!.size : 0;
    expect(epidemicOdds(deck.piles, 1)).toBe(left > 0 ? 0 : 1 / 6);
  });

  test("the last card of a pile that still holds its epidemic is certain", () => {
    expect(
      epidemicOdds(
        [
          { size: 1, epidemics: 1 },
          { size: 6, epidemics: 1 },
        ],
        2,
      ),
    ).toBe(1);
    expect(
      epidemicOdds(
        [
          { size: 2, epidemics: 0 },
          { size: 6, epidemics: 1 },
        ],
        2,
      ),
    ).toBe(0);
    expect(
      epidemicOdds(
        [
          { size: 1, epidemics: 0 },
          { size: 6, epidemics: 1 },
        ],
        2,
      ),
    ).toBeCloseTo(1 / 6);
  });
});
