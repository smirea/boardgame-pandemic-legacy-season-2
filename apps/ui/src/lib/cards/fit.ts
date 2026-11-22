import type { Attachment } from 'svelte/attachments';

/**
 * Sets the largest font size, in em of the parent, at which the element's text fits its box without overflowing, so
 * card text is never cut short. The box is sized by the card, never by the text, and refits whenever it resizes. With
 * `across`, only the width counts: a title grows downward as it wraps, and a display face's tall glyphs would otherwise
 * read as overflow.
 */
export const fitText =
	(
		text: string,
		{ max = 1, min = 0.6, across = false }: { max?: number; min?: number; across?: boolean } = {},
	): Attachment<HTMLElement> =>
	element => {
		void text;
		const overflows = () =>
			element.scrollWidth > element.clientWidth + 0.5 || (!across && element.scrollHeight > element.clientHeight + 0.5);
		const fit = () => {
			let low = min;
			let high = max;
			element.style.fontSize = `${high}em`;
			if (!overflows()) return;
			for (let step = 0; step < 7; step++) {
				const middle = (low + high) / 2;
				element.style.fontSize = `${middle}em`;
				if (overflows()) high = middle;
				else low = middle;
			}
			element.style.fontSize = `${low}em`;
		};
		let live = true;
		// No fit on mount: the observer's first call comes after the first layout and before paint, so a pile of cards
		// mounting together lays the page out once instead of once per card.
		void document.fonts.ready.then(() => live && fit());
		const observer = new ResizeObserver(fit);
		observer.observe(element);
		return () => {
			live = false;
			observer.disconnect();
		};
	};
