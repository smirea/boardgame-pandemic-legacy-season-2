const notTyping = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file']);

/**
 * Whether a key goes into something the player is typing in, so a page shortcut must leave it alone. Reads the
 * composed path, because a field inside a shadow root, such as the feedback editor's, retargets `event.target` to
 * the shadow host.
 */
export function typing(event: KeyboardEvent) {
	const target = event.composedPath()[0];
	if (target instanceof HTMLInputElement) return !notTyping.has(target.type);
	return (
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement ||
		(target instanceof HTMLElement && target.isContentEditable)
	);
}

/** Whether a key lands on a focused button, which Space and Enter already press. */
export const onButton = (event: KeyboardEvent) => event.composedPath()[0] instanceof HTMLButtonElement;
