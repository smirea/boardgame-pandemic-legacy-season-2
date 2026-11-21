const isPlain = (value: unknown): value is Record<string, unknown> | unknown[] =>
	typeof value === 'object' &&
	value !== null &&
	(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype);

/**
 * `next`, built from the parts of `previous` that hold the same values. A view rebuilt from the game state is all
 * new objects, and Svelte passes an object on as changed whenever it is a different one. Through this, a part that
 * did not change stays the object it was, so nothing that reads it runs again. Anything that is not a plain object or
 * array (a function, a texture, a class instance) is compared by identity.
 */
export function reconcile<T>(previous: T | undefined, next: T): T {
	if (Object.is(previous, next) || !isPlain(previous) || !isPlain(next)) return next;
	if (Array.isArray(previous) !== Array.isArray(next)) return next;
	if (Array.isArray(next)) {
		const before = previous as unknown[];
		let same = before.length === next.length;
		const merged = next.map((item, index) => {
			const kept = reconcile(before[index], item);
			if (kept !== before[index]) same = false;
			return kept;
		});
		return (same ? previous : merged) as T;
	}
	const before = previous as Record<string, unknown>;
	const keys = Object.keys(next);
	let same = keys.length === Object.keys(before).length;
	const merged: Record<string, unknown> = {};
	for (const key of keys) {
		const kept = reconcile(before[key], (next as Record<string, unknown>)[key]);
		if (kept !== before[key] || !(key in before)) same = false;
		merged[key] = kept;
	}
	return (same ? previous : merged) as T;
}

/** A function that returns each value it is given through `reconcile` with the one before. */
export function reconciler<T>(): (next: T) => T {
	let previous: T | undefined;
	return next => (previous = reconcile(previous, next));
}
