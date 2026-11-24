const notTyping = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file']);

/**
 * Whether a key belongs to something other than the game, so a game hotkey must leave it alone: a field the player is
 * typing in, or anything inside the feedback editor, whose shadow root retargets `event.target` to its host. Reads the
 * composed path for both.
 */
export function typing(event: KeyboardEvent) {
	if (inFeedback(event)) return true;
	const target = event.composedPath()[0];
	if (target instanceof HTMLInputElement) return !notTyping.has(target.type);
	return (
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement ||
		(target instanceof HTMLElement && target.isContentEditable)
	);
}

/** Whether a key was pressed anywhere in the feedback editor, which is never the game's, Escape included. */
export const inFeedback = (event: KeyboardEvent) =>
	event.composedPath().some(node => node instanceof Element && node.hasAttribute('data-feedback-engine'));

/** Whether a key lands on a focused button, which Space and Enter already press. */
export const onButton = (event: KeyboardEvent) => event.composedPath()[0] instanceof HTMLButtonElement;

/** Whether something stands in front of the table that takes the keyboard: a dialog, or a Legacy reading. */
export const modalOpen = () => Boolean(document.querySelector('[aria-modal="true"], .tabletop-unboxing'));
