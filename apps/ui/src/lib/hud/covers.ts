import { getContext, onDestroy, setContext } from 'svelte';

/**
 * What stands open over the table and closes on Escape: a dialog, or a step inside one. Each registers how it
 * closes, and Escape closes the one opened last, so two things open never both answer one press.
 */
export class Covers {
	#open: (() => void)[] = [];

	/** Registers `close` as the next thing Escape does. Returns how to take it back. */
	add(close: () => void): () => void {
		this.#open.push(close);
		return () => {
			const at = this.#open.lastIndexOf(close);
			if (at >= 0) this.#open.splice(at, 1);
		};
	}

	/** Closes whatever was opened last. False when nothing is open. */
	closeTop(): boolean {
		const close = this.#open.at(-1);
		close?.();
		return close !== undefined;
	}
}

const KEY = Symbol('covers');

export const provideCovers = () => setContext(KEY, new Covers());

/** The game screen's covers, or none outside a game screen. */
export const useCovers = () => getContext<Covers | undefined>(KEY);

/** Closes on Escape for as long as the component calling this is up. */
export function closeOnEscape(close: () => void) {
	const covers = useCovers();
	if (covers) onDestroy(covers.add(close));
}
