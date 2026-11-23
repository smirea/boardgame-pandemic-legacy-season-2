import { hollowInPlay } from '@repo/game';
import type { LogEntry, Phase, World } from '@repo/game';
import { bindAudioUnlock } from './engine.ts';
import { ambientMusic } from './music.ts';
import {
	sfxBuildStructure,
	sfxCardDraw,
	sfxCubeDrop,
	sfxCubePickup,
	sfxEpidemic,
	sfxExposure,
	sfxIncident,
	sfxOutbreak,
	sfxOutcome,
	sfxRadioTune,
	sfxRouteDraw,
	sfxScratchBox,
} from './sfx.ts';

/**
 * Observes live game log entries and phase transitions to fire crisp tactile SFX and smoothly drive
 * the adaptive escalating ambient music score. Skips jumps (reloads, undo, replay seeks).
 */
export class GameAudio {
	private seenSeq: number | null = null;
	private prevPending: string | null = null;
	private prevOutcome: { won: boolean; reason: string } | null = null;
	private prevCarried = new Map<string, number>();

	constructor() {
		bindAudioUnlock();
	}

	observe(world: World, phase: Phase, live: boolean, storyOpen: boolean) {
		const game = world.game;
		const campaign = world.campaign;

		ambientMusic.update({
			active: phase !== 'lobby' || storyOpen,
			incidents: game?.incidents ?? 0,
			epidemics: game?.epidemics ?? 0,
			month: campaign.month,
			hollowPresent: game !== null && hollowInPlay(campaign),
			inoculationSafe: campaign.rules.includes('storage') && !campaign.rules.includes('epidemicFromStorage'),
			wearingOff: campaign.rules.includes('epidemicFromStorage'),
			storyOpen,
		});

		const log = game?.log ?? [];
		const newest = log.at(-1)?.seq ?? -1;
		const pending = game?.pending[0]?.t ?? null;
		const outcome = game?.outcome ?? null;

		const prevSeq = this.seenSeq;
		const prevPending = this.prevPending;
		const prevOutcome = this.prevOutcome;
		this.seenSeq = newest;
		this.prevPending = pending;
		this.prevOutcome = outcome;

		// Track carried supplies per seat so Make Supplies / Pick Up / Deliver get authentic cube clicks.
		const carriedNow = new Map<string, number>();
		if (game) {
			for (const seat of game.seats) carriedNow.set(seat, game.players[seat]?.supplies ?? 0);
		}
		const carriedBefore = this.prevCarried;
		this.prevCarried = carriedNow;

		if (!live || !game || prevSeq === null || newest < prevSeq) return;

		if (prevPending === 'epidemicDrawn' && pending === 'epidemicInfect') {
			sfxEpidemic('draw');
			ambientMusic.triggerEpidemicShift();
		} else if (prevPending === 'epidemicInfect' && pending === 'intensify') {
			sfxEpidemic('infect');
		} else if (prevPending === 'intensify' && pending !== 'intensify') {
			sfxEpidemic('intensify');
		}

		if (!prevOutcome && outcome) {
			sfxOutcome(outcome.won);
		}

		const fresh = log.filter(entry => entry.seq > prevSeq);
		if (fresh.length > 8) return;

		for (const seat of game.seats) {
			const before = carriedBefore.get(seat) ?? 0;
			const after = carriedNow.get(seat) ?? 0;
			if (after > before) sfxCubePickup(after);
			else if (after < before) sfxCubeDrop('supply', before - after);
		}

		for (const entry of fresh) this.playLogEntry(entry, game.incidents);
	}

	private playLogEntry(entry: LogEntry, incidents: number) {
		switch (entry.t) {
			case 'draw':
				sfxCardDraw();
				break;
			case 'infect':
				if (entry.effect === 'supply') sfxCubeDrop('supply', 1);
				else if (entry.effect === 'plague') sfxCubeDrop('plague', 1);
				else if (entry.effect === 'outbreak') sfxOutbreak();
				else if (entry.effect === 'hollow') sfxCubeDrop('hollow', 1);
				break;
			case 'incident':
				sfxIncident(incidents);
				break;
			case 'gather':
				sfxCubeDrop('hollow', 1);
				break;
			case 'exposure':
				sfxExposure(entry.result === 'empty' ? 'safe' : entry.result === 'scar' ? 'scar' : 'death');
				break;
			case 'action': {
				const a = entry.action;
				if (a === 'deliver') sfxCubeDrop('supply', 1);
				else if (a === 'makeSupplies' || a === 'pickUp') sfxCubePickup(1);
				else if (a === 'establishLine' || a === 'chartLane') sfxRouteDraw();
				else if (a === 'buildCenter') sfxBuildStructure('center');
				else if (a === 'buildTower') sfxBuildStructure('tower');
				else if (a === 'buildShelter') sfxBuildStructure('shelter');
				else if (a === 'search') sfxScratchBox();
				else if (a === 'monitor' || a === 'broadcast') sfxRadioTune(a === 'monitor');
				else if (a === 'drive' || a === 'sail' || a === 'charter' || a === 'shuttle') sfxCubePickup(1);
				break;
			}
		}
	}

	stop() {
		ambientMusic.stop();
	}
}
