import type { CardId } from './ids';

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

/**
 * For each distinct card key in the deck, the chance that at least one copy is drawn in the next
 * `draws` cards from the top. Strata are consumed top first, so a stratum that is fully drawn is
 * certain and only the last partially drawn stratum is a gamble.
 */
export function drawOdds<K extends string>(
	strata: readonly CardId[][],
	draws: number,
	keyOf: (card: CardId) => K,
): Map<K, number> {
	const miss = new Map<K, number>();
	for (const stratum of strata) for (const card of stratum) miss.set(keyOf(card), 1);
	let remaining = draws;
	for (const stratum of strata) {
		if (remaining <= 0) break;
		const taken = Math.min(remaining, stratum.length);
		const counts = new Map<K, number>();
		for (const card of stratum) counts.set(keyOf(card), (counts.get(keyOf(card)) ?? 0) + 1);
		for (const [key, count] of counts) {
			miss.set(key, miss.get(key)! * (1 - atLeastOne(stratum.length, count, taken)));
		}
		remaining -= taken;
	}
	return new Map([...miss].map(([key, value]) => [key, 1 - value]));
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
		for (const card of stratum) expected.set(keyOf(card), (expected.get(keyOf(card)) ?? 0) + taken / stratum.length);
		remaining -= taken;
	}
	return expected;
}

/** Chance of at least one epidemic in the next `draws` player cards. */
export function epidemicOdds(piles: readonly { size: number; epidemics: number }[], draws: number): number {
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
export function drawsUntilEpidemicCertain(piles: readonly { size: number; epidemics: number }[]): number | null {
	let draws = 0;
	for (const pile of piles) {
		draws += pile.size;
		if (pile.epidemics > 0) return draws;
	}
	return null;
}
