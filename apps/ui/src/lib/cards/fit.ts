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

/**
 * Sets the largest CSS zoom, up to 1, at which the element's one child fits the element's content box, so a pile of
 * any size stays whole on screen instead of scrolling. Zoom, not a transform, so the child wraps and centres at its
 * new size. It measures layout, never paint: a piece still flying in on a transform would otherwise read as overflow
 * and leave the pile shrunk after it lands. The element is sized by its place in the layout, never by the child, or
 * the two would shrink each other down to `min`.
 */
export const fitZoom =
	({ min = 0.3 }: { min?: number } = {}): Attachment<HTMLElement> =>
	element => {
		const fit = () => {
			const child = element.firstElementChild as HTMLElement | null;
			if (!child) return;
			const style = getComputedStyle(element);
			const roomX = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
			const roomY = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
			// offsetWidth and offsetHeight are the child's own unzoomed size, so `zoom` times them is what it covers.
			const overflows = (zoom: number) => {
				child.style.zoom = `${zoom}`;
				return child.offsetWidth * zoom > roomX + 0.5 || child.offsetHeight * zoom > roomY + 0.5;
			};
			if (!overflows(1)) return;
			let low = min;
			let high = 1;
			for (let step = 0; step < 7; step++) {
				const middle = (low + high) / 2;
				if (overflows(middle)) high = middle;
				else low = middle;
			}
			child.style.zoom = `${low}`;
		};
		const observer = new ResizeObserver(fit);
		observer.observe(element);
		// The child's own size changes as pieces arrive; the element's does not.
		const watched = new MutationObserver(() => {
			observer.disconnect();
			observer.observe(element);
			if (element.firstElementChild) observer.observe(element.firstElementChild);
		});
		watched.observe(element, { childList: true });
		if (element.firstElementChild) observer.observe(element.firstElementChild);
		return () => {
			observer.disconnect();
			watched.disconnect();
		};
	};

/**
 * Sets the largest font size, in em of the parent, at which none of the element's `[data-fit]` boxes overflows, so a
 * group of boxes sized by the layout, such as the panels down a character's arch, all read at one size. It refits when
 * the element resizes and when its boxes come and go.
 */
export const fitGroup =
	({ max = 1, min = 0.5 }: { max?: number; min?: number } = {}): Attachment<HTMLElement> =>
	element => {
		const overflows = () =>
			[...element.querySelectorAll<HTMLElement>('[data-fit]')].some(
				box => box.scrollHeight > box.clientHeight + 0.5 || box.scrollWidth > box.clientWidth + 0.5,
			);
		const fit = () => {
			element.style.fontSize = `${max}em`;
			if (!overflows()) return;
			let low = min;
			let high = max;
			for (let step = 0; step < 7; step++) {
				const middle = (low + high) / 2;
				element.style.fontSize = `${middle}em`;
				if (overflows()) high = middle;
				else low = middle;
			}
			element.style.fontSize = `${low}em`;
		};
		let frame = 0;
		const soon = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(fit);
		};
		let live = true;
		void document.fonts.ready.then(() => live && fit());
		const observer = new ResizeObserver(soon);
		observer.observe(element);
		const watched = new MutationObserver(soon);
		watched.observe(element, { childList: true, subtree: true, characterData: true });
		return () => {
			live = false;
			cancelAnimationFrame(frame);
			observer.disconnect();
			watched.disconnect();
		};
	};
