import { pack, sealKey } from '@repo/game';
import type { Campaign, CityId, Game } from '@repo/game';
import { untrack } from 'svelte';
import type { Fx, FxKind } from '#lib/board/types.ts';
import { cityName } from './labels.svelte.ts';
import { entriesSince } from './logWatch.ts';

export type Toast = { id: number; text: string; tone: string };
export type Banner = { id: number; title: string; text: string };

export type AnnouncementSource = {
	readonly game: Game | null;
	readonly campaign: Campaign;
	readonly spectator: boolean;
	/** False when a spectator jumped rather than stepped, so the events in between are not announced. */
	readonly announce: boolean;
};

const TOAST_MS = 5200;
const PULSE_MS = 4000;

/**
 * What the screen tells the table about in passing: a line of text at the top (a toast), the stamp across the chart
 * (the banner) and a pulse on a city of the board. It reads the game's log for the lines every screen shows (a city
 * joining the grid, a structure, an Epidemic's city, a seal opened, a note), and anything else on the screen may add
 * its own. Create it while a component is being set up: it keeps an effect.
 */
export function createAnnouncements(source: AnnouncementSource) {
	let fx = $state.raw<Fx[]>([]);
	let toasts = $state.raw<Toast[]>([]);
	let banner = $state.raw<Banner | null>(null);
	let lastSeq = untrack(() => source.game?.log.at(-1)?.seq ?? 0);
	let lastGame = untrack(() => source.campaign.results.length);
	let nextId = 1;
	// Announcements put back from a studio scene stay up until the game moves on, where live ones time out.
	let held = false;

	function toast(text: string, tone = '') {
		const id = nextId++;
		toasts = [...toasts, { id, text, tone }];
		setTimeout(() => (toasts = toasts.filter(entry => entry.id !== id)), TOAST_MS);
	}

	/** Pulses a city on the board now, as a show does at the beat that shows it. */
	function pulse(city: CityId, kind: FxKind) {
		const id = nextId++;
		fx = [...fx, { id, city, kind, delay: 0 }];
		setTimeout(() => (fx = fx.filter(entry => entry.id !== id)), PULSE_MS);
	}

	/** Stamps the banner across the chart for `ms`. */
	function raise(title: string, text: string, ms: number) {
		const id = nextId++;
		banner = { id, title, text };
		setTimeout(() => banner?.id === id && (banner = null), ms);
	}

	$effect(() => {
		const { game, campaign, spectator } = source;
		const log = game?.log ?? [];
		const newest = log.at(-1)?.seq ?? 0;
		// A spectator jumping through a recording skips over events rather than living through each one at once,
		// and what was announced where they jumped from no longer applies.
		const jumped = spectator && (newest < lastSeq || !untrack(() => source.announce));
		// A shorter log is a new game, whose every line is news, or an undo, which leaves nothing new to announce.
		const index = campaign.results.length;
		if (newest < lastSeq) lastSeq = spectator || index === lastGame ? newest : 0;
		lastGame = index;
		if (jumped) {
			lastSeq = newest;
			untrack(() => {
				toasts = [];
				banner = null;
				fx = [];
			});
			return;
		}
		const fresh = entriesSince(log, lastSeq);
		if (fresh.length === 0) return;
		lastSeq = newest;
		untrack(() => {
			if (held) {
				held = false;
				toasts = [];
				banner = null;
			}
			const added: Fx[] = [];
			const mark = (city: CityId, kind: FxKind) => added.push({ id: nextId++, city, kind, delay: added.length * 240 });
			// Infections pulse their cities from the infection show, each at its own moment.
			for (const entry of fresh) {
				if (entry.t === 'connected') mark(entry.city, 'connected');
				else if (entry.t === 'structure') mark(entry.city, 'build');
				else if (entry.t === 'epidemic') {
					// The banner went up when the Epidemic was started. This is the city its second step struck.
					if (entry.city)
						toast(
							entry.removed > 0
								? `Epidemic: ${cityName(entry.city)} loses ${entry.removed} cube${entry.removed === 1 ? '' : 's'}`
								: `Epidemic: ${cityName(entry.city)} had no cubes to lose`,
							'bad',
						);
				} else if (entry.t === 'unlock')
					toast(`Opened: ${pack.seals.find(def => sealKey(def.seal) === entry.seal)?.name}`, 'good');
				else if (entry.t === 'note') toast(entry.text, 'good');
			}
			fx = [...fx, ...added];
			const ids = new Set(added.map(entry => entry.id));
			setTimeout(() => (fx = fx.filter(entry => !ids.has(entry.id))), 6000);
		});
	});

	return {
		get fx() {
			return fx;
		},
		get toasts() {
			return toasts;
		},
		get banner() {
			return banner;
		},
		toast,
		pulse,
		raise,
		/** Puts back the toasts and the banner a studio scene wrote down. They stay until the game moves on. */
		restore(kept: { text: string; tone: string }[], stamp: { title: string; text: string } | null) {
			held = kept.length > 0 || stamp !== null;
			toasts = kept.map(entry => ({ id: nextId++, ...entry }));
			banner = stamp && { id: nextId++, ...stamp };
		},
	};
}
