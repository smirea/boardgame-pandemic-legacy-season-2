import type { SceneUi } from './scene.ts';

type Point = { x: number; y: number };

const HOVER = 'data-studio-hover';
const rewritten = new WeakSet<CSSStyleSheet>();

/**
 * The browser alone decides what `:hover` matches, so every rule that uses it gets a twin that matches an attribute
 * this module can set. An attribute rather than a class, because Svelte rewrites `class` whole.
 */
function twinHoverRules() {
	const twin = (owner: CSSStyleSheet | CSSGroupingRule) => {
		const rules = owner.cssRules;
		for (let index = rules.length - 1; index >= 0; index--) {
			const rule = rules[index]!;
			if (rule instanceof CSSStyleRule && rule.selectorText.includes(':hover')) {
				const text = rule.cssText.replace(rule.selectorText, rule.selectorText.replaceAll(':hover', `[${HOVER}]`));
				owner.insertRule(text, index + 1);
			}
			// A style rule can nest rules of its own, as a media query does.
			if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules.length) twin(rule as CSSGroupingRule);
		}
	};
	for (const sheet of document.styleSheets) {
		if (rewritten.has(sheet)) continue;
		rewritten.add(sheet);
		twin(sheet);
	}
}

const chainOf = (element: Element | null) => {
	const chain: Element[] = [];
	for (let node = element; node; node = node.parentElement) chain.push(node);
	return chain;
};

function fire(target: Element, type: string, point: Point, bubbles: boolean) {
	const init = { clientX: point.x, clientY: point.y, bubbles, cancelable: bubbles, composed: true, view: window };
	target.dispatchEvent(
		type.startsWith('pointer')
			? new PointerEvent(type, { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true })
			: new MouseEvent(type, init),
	);
}

let held: { point: Point; chain: Element[] } | null = null;

/** Takes the pointer placed by `placePointer` away again, as if it had left the page. */
export function liftPointer() {
	if (!held) return;
	const { point, chain } = held;
	held = null;
	const target = chain[0];
	if (target?.isConnected) {
		fire(target, 'pointerout', point, true);
		fire(target, 'mouseout', point, true);
	}
	for (const element of chain) {
		element.removeAttribute(HOVER);
		if (!element.isConnected) continue;
		fire(element, 'pointerleave', point, false);
		fire(element, 'mouseleave', point, false);
	}
}

/**
 * Rests a pointer at a point of the page without the real one: whatever is there gets the events a pointer arriving
 * would send and matches its `:hover` rules, so a hover written down in a scene shows again. It stays until
 * `liftPointer`, or until what is under the point changes and it is placed again.
 */
export function placePointer(point: Point) {
	liftPointer();
	twinHoverRules();
	const target = document.elementFromPoint(point.x, point.y);
	if (!target) return;
	const chain = chainOf(target);
	held = { point, chain };
	for (const element of chain) element.setAttribute(HOVER, '');
	fire(target, 'pointerover', point, true);
	fire(target, 'mouseover', point, true);
	for (const element of chain.toReversed()) {
		fire(element, 'pointerenter', point, false);
		fire(element, 'mouseenter', point, false);
	}
	// The board ignores a move of under a quarter pixel, so the pointer arrives from just beside the point.
	fire(target, 'pointermove', { x: point.x + 0.5, y: point.y + 0.5 }, true);
	fire(target, 'pointermove', point, true);
	fire(target, 'mousemove', point, true);
}

/** The point the placed pointer rests at, if one is placed. */
export const placedPointer = () => held?.point ?? null;

const pathOf = (element: Element) => {
	const path: number[] = [];
	for (let node = element; node !== document.body && node.parentElement; node = node.parentElement)
		path.unshift([...node.parentElement.children].indexOf(node));
	return path;
};

/** Every element scrolled away from its start, by its path of child indexes from the body. */
export function readScroll(): SceneUi['scroll'] {
	return [...document.body.querySelectorAll('*')]
		.filter(element => element.scrollTop !== 0 || element.scrollLeft !== 0)
		.map(element => ({ path: pathOf(element), top: element.scrollTop, left: element.scrollLeft }));
}

/** Scrolls each element back to where `readScroll` found it. Returns the ones the page no longer has. */
export function writeScroll(scroll: SceneUi['scroll']): string[] {
	const missing: string[] = [];
	for (const entry of scroll) {
		let element: Element | undefined = document.body;
		for (const index of entry.path) element = element?.children[index];
		if (!element) missing.push(`No element at ${entry.path.join('.')} to scroll`);
		else element.scrollTo({ top: entry.top, left: entry.left, behavior: 'instant' });
	}
	return missing;
}

const running = () =>
	document
		.getAnimations()
		.filter(
			animation => animation.playState === 'running' && animation.effect?.getComputedTiming().endTime !== Infinity,
		);

/**
 * Resolves once the page has stopped moving: no transition or finite animation is running and `still` (the board's
 * camera, read as a string) has not changed for a few frames. Gives up after `limit` milliseconds. With `hurry`,
 * every transition and animation that ends is taken straight to its end, so a pulse that greets a new screen does
 * not decide what a capture shows; what the board itself animates still runs its course.
 */
export async function settled(still: () => string, { limit = 4000, hurry = false } = {}): Promise<boolean> {
	const start = performance.now();
	let last = '';
	let quiet = 0;
	while (performance.now() - start < limit) {
		await new Promise(resolve => setTimeout(resolve, 60));
		if (hurry) for (const animation of running()) animation.finish();
		// Svelte takes an element away when its transition's `finish` event arrives, and the browser sends that when
		// it next draws, which a tab in the background does rarely. Until then the transition is not over.
		const ending = document
			.getAnimations()
			.some(animation => animation.playState === 'finished' && animation.onfinish !== null);
		const moving = ending || running().length > 0;
		const now = still();
		quiet = !moving && now === last ? quiet + 1 : 0;
		last = now;
		if (quiet >= 4) return true;
	}
	return false;
}
