/**
 * A tooltip the pointer can walk into, whose sections lay out their cards while the pointer or focus rests on them.
 * The region (trigger and tooltip together) keeps it open; leaving waits a beat, so crossing the gap between the
 * trigger and the tooltip, or between the tooltip and the cards beside it, does not close it.
 */
export class HoverTip<T extends string = string> {
	open = $state<T | null>(null);
	section = $state<string | null>(null);
	#closing: ReturnType<typeof setTimeout> | undefined;

	show = (which: T) => {
		clearTimeout(this.#closing);
		if (this.open !== which) this.section = null;
		this.open = which;
	};

	close = () => {
		clearTimeout(this.#closing);
		this.open = null;
		this.section = null;
	};

	/** Handlers for the element holding the trigger and the tooltip. */
	region = {
		onpointerenter: () => clearTimeout(this.#closing),
		onpointerleave: () => {
			clearTimeout(this.#closing);
			this.#closing = setTimeout(this.close, 160);
		},
		onfocusout: (event: FocusEvent) => {
			const into = event.relatedTarget;
			if (!(into instanceof Node && (event.currentTarget as Element).contains(into))) this.close();
		},
		// Tab pings the map in the game, so the arrows walk from the trigger through the sections.
		onkeydown: (event: KeyboardEvent) => {
			if (event.key === 'Escape' && this.open) return this.close();
			if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
			const sections = [...(event.currentTarget as Element).querySelectorAll<HTMLElement>('[data-section]')];
			if (!sections.length) return;
			event.preventDefault();
			const at = sections.indexOf(document.activeElement as HTMLElement);
			const next = event.key === 'ArrowDown' ? at + 1 : at < 0 ? sections.length - 1 : at - 1;
			sections[Math.max(0, Math.min(sections.length - 1, next))]!.focus();
		},
	};

	/** What makes a row of the tooltip a section: resting on it, focusing it or clicking it lays its cards out. */
	sectionOf = (key: string, label: string) => ({
		role: 'button',
		tabindex: 0,
		'aria-label': label,
		'aria-expanded': this.section === key,
		'data-section': key,
		onpointerenter: () => (this.section = key),
		onfocus: () => (this.section = key),
		onclick: () => (this.section = key),
	});
}
