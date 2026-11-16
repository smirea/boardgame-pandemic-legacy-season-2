import type { Moment } from './beats.ts';
import type { SaidNote, TimelineStep } from './replay.svelte.ts';

export type Paced = { notes: SaidNote[]; timeline: Pick<TimelineStep, 'by' | 'turn' | 'beat'>[] };

/** How many steps a note stays up after it is said, so the moves it explains play under it. */
const LINGER = { why: 5, chat: 3, issue: 3, note: 3 } as const;

/**
 * The notes up at a frame, per player: the newest one, with anything else that player said in the same breath
 * folded above it. Older notes have moved to the timeline. A pure function of the frame, so scrubbing never
 * strands a bubble.
 */
export function bubblesAt(loaded: Paced, frame: number, follow: string | null): Map<string, SaidNote[]> {
	const newest = new Map<string, SaidNote>();
	for (const note of loaded.notes) {
		if (note.frame > frame || note.frame < frame - LINGER[note.kind]) continue;
		if (follow && note.by !== follow) continue;
		newest.set(note.by, note);
	}
	const up = new Map<string, SaidNote[]>();
	for (const [name, last] of newest) {
		const burst = loaded.notes.filter(note => note.by === name && note.frame === last.frame && note.key < last.key);
		up.set(name, [...burst.slice(-1), last]);
	}
	return up;
}

export const saidAt = (loaded: Paced, frame: number) => loaded.notes.filter(note => note.frame === frame);

const BUSY = new Set<Moment>(['epidemic', 'incident', 'death', 'end', 'reveal']);

/**
 * How long autoplay stays on a frame at 1x: long enough to watch the step land, plus reading time for what
 * was said there. Housekeeping such as placing setup cubes goes by quickly. Following a player hurries
 * everyone else's steps.
 */
export function dwellAt(loaded: Paced, frame: number, options: { bubbles: boolean; follow: string | null }): number {
	const step = loaded.timeline[frame - 1];
	const words = options.bubbles
		? saidAt(loaded, frame)
				.filter(note => !options.follow || note.by === options.follow)
				.reduce((sum, note) => sum + note.text.split(/\s+/).length, 0)
		: 0;
	const reading = Math.min(9000, words * 190);
	let watch = 1100;
	if (!step) watch = 600;
	else if (step.beat.moments.some(moment => BUSY.has(moment))) watch = 2800;
	else if (step.beat.marks.some(mark => mark.k === 'trail')) watch = 1500;
	else if (!step.beat.seat && step.turn === 0) watch = 450;
	if (options.follow && step?.by !== options.follow && !words) watch *= 0.35;
	return watch + reading;
}
