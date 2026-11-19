import type { Color } from '@repo/game';
import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
import type { Glyph } from '#lib/board/hints.ts';

/**
 * A glyph set in a line of text, with the words printed after it, which never break from it. `alt` stands in for a
 * glyph with no words where the line is read as plain text.
 */
export type GlyphPart = { glyph: Glyph; color?: string; text?: string; alt?: string };

/** A line of text with game objects drawn as glyphs in it. */
export type Rich = (string | GlyphPart)[];

export const plain = (rich: Rich | string): string =>
	typeof rich === 'string'
		? rich
		: rich.map(part => (typeof part === 'string' ? part : (part.text ?? part.alt ?? ''))).join('');

const COLORS = new Set<string>(['blue', 'yellow', 'black', 'red']);

// The nouns written in rules text and the engine's reasons, each given the glyph of what it names. A colour named
// before a card gives the card that colour.
const NOUNS =
	/\b(?:(blue|yellow|black|red) )?(?:City )?cards? of (?:its|this) colour\b|\b(?:(blue|yellow|black|red) )?City cards?\b|\b(blue|yellow|black|red) cards?\b|\bInfection cards?\b|\bPlague cubes?\b|\b(?:supply )?cubes?\b|\bHollow M[ae]n\b/g;

/** Text from the rules or the engine, with a glyph before every game object it names. */
export function withGlyphs(text: string): Rich {
	const parts: Rich = [];
	let from = 0;
	for (const match of text.matchAll(NOUNS)) {
		const words = match[0];
		const color = [match[1], match[2], match[3]].find(name => name && COLORS.has(name)) as Color | undefined;
		const glyph: Glyph = words.startsWith('Infection')
			? 'infection'
			: words.startsWith('Plague')
				? 'plague'
				: words.startsWith('Hollow')
					? 'hollow'
					: /cube/.test(words)
						? 'supplies'
						: 'card';
		if (match.index > from) parts.push(text.slice(from, match.index));
		parts.push({ glyph, ...(color ? { color: CITY_COLOR[color] } : {}), text: words });
		from = match.index + words.length;
	}
	if (from < text.length) parts.push(text.slice(from));
	return parts;
}
