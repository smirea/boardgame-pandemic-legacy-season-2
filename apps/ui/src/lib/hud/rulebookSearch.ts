import type { RulebookBlock, RulebookChapter } from '@repo/game';

/** The words of a search, lower case. Every one must appear for a rule to match, in any order. */
export const searchWords = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);

function blockText(block: RulebookBlock): string {
	switch (block.t) {
		case 'p':
			return `${block.lead ?? ''} ${block.text}`;
		case 'list':
			return block.items.join(' ');
		case 'table':
			return [block.head, ...block.rows].flat().join(' ');
		case 'slot':
			return '';
	}
}

const matches = (text: string, words: string[]) => {
	const lower = text.toLowerCase();
	return words.every(word => lower.includes(word));
};

/**
 * The rulebook cut down to what a search finds: a section whose title matches keeps all of its rules, any other
 * keeps only the rules that match, with its chapter's title counting toward each. Empty slots never match.
 */
export function searchRulebook(book: RulebookChapter[], query: string) {
	const words = searchWords(query);
	if (!words.length) return { chapters: book, found: null };
	let found = 0;
	const chapters = book.flatMap(chapter => {
		const sections = chapter.sections.flatMap(section => {
			const blocks = matches(`${chapter.title} ${section.title}`, words)
				? section.blocks.filter(block => block.t !== 'slot')
				: section.blocks.filter(block => matches(`${chapter.title} ${section.title} ${blockText(block)}`, words));
			found += blocks.length;
			return blocks.length ? [{ ...section, blocks }] : [];
		});
		return sections.length ? [{ ...chapter, sections }] : [];
	});
	return { chapters, found };
}

/** A text cut into the runs a search lit and the runs between them. */
export function highlight(text: string, words: string[]): { text: string; lit: boolean }[] {
	if (!words.length) return [{ text, lit: false }];
	const escaped = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	return text
		.split(new RegExp(`(${escaped.join('|')})`, 'gi'))
		.filter(Boolean)
		.map(part => ({ text: part, lit: words.includes(part.toLowerCase()) }));
}
