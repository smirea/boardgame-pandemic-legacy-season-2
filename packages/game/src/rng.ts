/**
 * The generator's whole state is one integer, so it lives in the game state and every shuffle
 * is reproducible from a save.
 */
export type RngState = { seed: number };

export function nextFloat(rng: RngState): number {
	rng.seed = (rng.seed + 0x6d2b79f5) | 0;
	let t = rng.seed;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(rng: RngState, exclusiveMax: number): number {
	return Math.floor(nextFloat(rng) * exclusiveMax);
}

export function shuffle<T>(rng: RngState, items: readonly T[]): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = nextInt(rng, i + 1);
		[result[i], result[j]] = [result[j]!, result[i]!];
	}
	return result;
}

export function pick<T>(rng: RngState, items: readonly T[]): T {
	if (items.length === 0) throw new Error('pick from an empty list');
	return items[nextInt(rng, items.length)]!;
}
