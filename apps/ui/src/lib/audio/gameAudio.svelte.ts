import { cityDef, hollowInPlay } from '@repo/game';
import type { CityId, LogEntry, Phase, World } from '@repo/game';
import { along, travelOf, tripMs } from '#lib/board/travel.ts';
import type { ShowCue } from '#lib/hud/infectionShow.svelte.ts';
import { bindAudioUnlock } from './engine.ts';
import type { TravelId } from './foley.ts';
import { ambientMusic } from './music.ts';
import { tensionOf, type Mood } from './score.ts';
import {
	setSfxKey,
	sfxAction,
	sfxCardDraw,
	sfxCardFlip,
	sfxEpidemic,
	sfxExposure,
	sfxIncident,
	sfxMoment,
	sfxOutbreak,
	sfxPiece,
	sfxTravel,
} from './sfx.ts';
import { campaignTone, TONES } from './tones.ts';

const EPIDEMIC_STEPS = new Set(['epidemicDrawn', 'epidemicInfect', 'intensify']);
const INFECTING = new Set<Phase>(['setup.infect', 'playing.infect']);

/** What the score follows, read off the game: the campaign's tone, the crisis of the game in play, whose turn it is. */
export function moodOf(world: World, phase: Phase, storyOpen: boolean): Mood {
	const { campaign, game } = world;
	const inGame = game !== null && phase !== 'lobby' && phase !== 'finished';
	const turn = game !== null && phase.startsWith('playing') ? game.players[game.active] : undefined;
	const at = turn ? cityDef(turn.location) : null;
	return {
		tone: campaignTone(campaign),
		tension: inGame ? tensionOf(game.incidents, game.epidemics) : 0,
		occupation: turn ? (campaign.characters[turn.character]?.job ?? null) : null,
		sea: !at || at.kind === 'haven' ? 0.85 : at.port ? 0.5 : 0.15,
		alarm: turn !== undefined && EPIDEMIC_STEPS.has(game?.pending[0]?.t ?? ''),
		infecting: game !== null && INFECTING.has(phase),
		hollow: inGame && hollowInPlay(campaign),
		safe: campaign.rules.includes('storage') && !campaign.rules.includes('epidemicFromStorage'),
		hush: storyOpen,
	};
}

/** How a move sounds: by what carried the pawn, and for as long as the pawn takes to get there. */
function travelSound(world: World, move: Extract<LogEntry, { t: 'move' }>): { id: TravelId; seconds: number } {
	const { travel, course } = travelOf(move, world.campaign.edges);
	const id: TravelId =
		move.by === 'drive'
			? travel === 'sea'
				? 'ferry'
				: 'road'
			: move.by === 'sail'
				? 'sail'
				: move.by === 'charter'
					? 'charter'
					: move.by === 'shuttle'
						? 'flight'
						: move.by === 'run'
							? 'foot'
							: 'airlift';
	return { id, seconds: course ? tripMs(travel, along(course).total) / 1000 : 1.3 };
}

const voiceOf = (id: string) => [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);

/**
 * Turns the game into sound. What happens at once is heard from the log: an action, a move, a turn passing. What
 * the board shows late is heard when it is shown: the infection show reports each beat through `showCue`, and a
 * supply cube sounds from its own flight on the board. Jumps (a reload, an undo, a replay seeking) are silent.
 */
export class GameAudio {
	private seenSeq: number | null = null;
	private prevPending: string | null = null;
	private prevPhase: Phase | null = null;
	private prevOutcome: { won: boolean; reason: string } | null = null;
	private prevHollow = new Map<CityId, number>();
	private incidents = 0;

	constructor() {
		bindAudioUnlock();
	}

	observe(world: World, phase: Phase, live: boolean, storyOpen: boolean) {
		const game = world.game;
		const mood = moodOf(world, phase, storyOpen);
		ambientMusic.update(mood);
		setSfxKey(TONES[mood.tone].root);

		const log = game?.log ?? [];
		const newest = log.at(-1)?.seq ?? -1;
		const pending = game?.pending[0]?.t ?? null;
		const outcome = game?.outcome ?? null;
		const hollow = new Map<CityId, number>();
		if (game) for (const [city, place] of Object.entries(game.locations)) hollow.set(city as CityId, place.hollow);

		const prevSeq = this.seenSeq;
		const prevPending = this.prevPending;
		const prevPhase = this.prevPhase;
		const prevOutcome = this.prevOutcome;
		const prevHollow = this.prevHollow;
		this.seenSeq = newest;
		this.prevPending = pending;
		this.prevPhase = phase;
		this.prevOutcome = outcome;
		this.prevHollow = hollow;
		this.incidents = game?.incidents ?? 0;

		if (!live || !game || prevSeq === null || newest < prevSeq) return;

		if (prevPhase === 'lobby' && phase.startsWith('setup')) sfxMoment('gameStart');
		if (INFECTING.has(phase) && prevPhase !== phase) sfxMoment('infestation');

		if (pending === 'epidemicDrawn' && prevPending !== 'epidemicDrawn') {
			ambientMusic.accent('epidemic');
		} else if (prevPending === 'epidemicDrawn' && pending === 'epidemicInfect') {
			sfxEpidemic('draw');
		} else if (prevPending === 'epidemicInfect' && pending === 'intensify') {
			sfxEpidemic('infect');
		} else if (prevPending === 'intensify' && pending !== 'intensify') {
			sfxEpidemic('intensify');
		}

		if (!prevOutcome && outcome) ambientMusic.accent(outcome.won ? 'triumph' : 'setback');

		const fresh = log.filter(entry => entry.seq > prevSeq);
		if (fresh.length > 8) return;

		// Hollow Men arrive in the infection show. One that goes was driven off by a player, which nothing else reports.
		for (const [city, count] of hollow) {
			if (count < (prevHollow.get(city) ?? 0)) {
				sfxPiece('hollowLeave');
				break;
			}
		}

		for (const entry of fresh) this.playLogEntry(world, entry, log);
	}

	/** A beat of the infection show, as the board shows it. */
	showCue(cue: ShowCue) {
		if (cue.t === 'flip') sfxCardFlip();
		else if (cue.t === 'skull') sfxPiece('skull');
		else if (cue.t === 'plague') sfxPiece('plague');
		else if (cue.t === 'marker') sfxIncident(Math.max(1, this.incidents - cue.waiting));
		else if (cue.effect === 'outbreak') sfxOutbreak();
		else sfxPiece(cue.effect === 'hollow' ? 'hollowArrive' : cue.effect === 'gather' ? 'gather' : 'held');
	}

	private playLogEntry(world: World, entry: LogEntry, log: LogEntry[]) {
		switch (entry.t) {
			case 'turn':
				// The first turn of a game opens it and closes nothing.
				if (log.some(other => other.t === 'turn' && other.seq < entry.seq)) sfxMoment('turnEnd');
				break;
			case 'move': {
				const { id, seconds } = travelSound(world, entry);
				sfxTravel(id, seconds);
				break;
			}
			case 'action':
				sfxAction(entry.action);
				break;
			case 'draw':
				sfxCardDraw();
				break;
			case 'event':
				sfxMoment('event');
				break;
			case 'objective':
				sfxMoment('objective');
				break;
			case 'death':
				ambientMusic.accent('setback');
				break;
			case 'exposure': {
				const character = world.game?.players[entry.seat]?.character ?? entry.seat;
				sfxExposure(entry.result === 'empty' ? 'safe' : entry.result === 'scar' ? 'scar' : 'death', voiceOf(character));
				break;
			}
		}
	}

	stop() {
		ambientMusic.stop();
	}
}
