import { claimant } from '@repo/game';
import type { CardId, Character, CharacterId, CityId, JobId, Phase, PlayerId, SeatId, World } from '@repo/game';
import { jobFigure } from './figures.ts';
import type { FigureKey } from './personas.ts';
import { characterVoice } from './voice.svelte.ts';
import { entriesSince } from '#lib/hud/logWatch.ts';

/** More fresh log entries than this at once is a jump (reload, undo, replay seek) and stays silent. */
const MOST_ENTRIES = 8;
/** Minimum gap between lone-traveler departure lines so multi-hop drives stay breezy instead of chatty. */
const SOLO_LEAVE_COOLDOWN_MS = 12_000;
/** Keeps an exposure scar from repeating immediately when the player confirms ScarChoice seconds later. */
const SCAR_REPEAT_COOLDOWN_MS = 14_000;

type PlayerSnapshot = {
	character: CharacterId;
	location: CityId;
	supplies: number;
	hand: Set<CardId>;
};

type Snapshot = {
	phase: Phase;
	resultsCount: number;
	logSeq: number;
	claims: Map<CharacterId, PlayerId | null>;
	portraits: Map<CharacterId, number>;
	draftPortrait: number | null;
	draftJob: JobId | null;
	characterIds: Set<CharacterId>;
	abilityCounts: Map<CharacterId, number>;
	scarVotes: Map<PlayerId, SeatId>;
	players: Map<SeatId, PlayerSnapshot>;
};

const abilityCount = (character: Character) =>
	character.slots.reduce((sum, slot) => sum + (slot?.kind === 'ability' ? 1 : 0), 0);

function capture(world: World, phase: Phase): Snapshot {
	const claims = new Map<CharacterId, PlayerId | null>();
	const portraits = new Map<CharacterId, number>();
	const characterIds = new Set<CharacterId>();
	const abilityCounts = new Map<CharacterId, number>();
	for (const character of Object.values(world.campaign.characters)) {
		characterIds.add(character.id);
		portraits.set(character.id, character.portrait);
		abilityCounts.set(character.id, abilityCount(character));
		if (!character.dead && !character.worker) {
			claims.set(character.id, claimant(world, character.id));
		}
	}

	const scarVotes = new Map<PlayerId, SeatId>();
	const pending = world.game?.pending[0];
	if (pending?.t === 'scarVote') {
		for (const [who, seat] of Object.entries(pending.votes)) {
			if (seat) scarVotes.set(who as PlayerId, seat);
		}
	}

	const players = new Map<SeatId, PlayerSnapshot>();
	if (world.game) {
		for (const seat of world.game.seats) {
			const entry = world.game.players[seat];
			if (!entry) continue;
			players.set(seat, {
				character: entry.character,
				location: entry.location,
				supplies: entry.supplies,
				hand: new Set(entry.hand),
			});
		}
	}

	return {
		phase,
		resultsCount: world.campaign.results.length,
		logSeq: world.game?.log.at(-1)?.seq ?? -1,
		claims,
		portraits,
		draftPortrait: world.table.draft.portrait,
		draftJob: world.table.draft.job,
		characterIds,
		abilityCounts,
		scarVotes,
		players,
	};
}

/**
 * Turns synced game transitions into short character voice reactions across every browser at the table and in replays:
 * lobby selection/avatar changes, scar votes, ability upgrades, card/cube transfers, moves (greet/leave/danger),
 * replacement characters, and scars. Local clicks play immediately in UI handlers and are deduplicated here.
 */
export class CharacterChatter {
	private prev: Snapshot | null = null;

	observe(world: World, phase: Phase, live: boolean, quiet: boolean) {
		const before = this.prev;
		const now = capture(world, phase);
		this.prev = now;

		if (!before || !live) return;

		// 1. Lobby / Character Select changes (remote peers hear claims, avatar swaps, creator picks).
		if (before.phase === 'lobby' && phase === 'lobby') {
			this.observeLobby(world, before, now);
			return;
		}

		// 2. Ability / upgrade gained (Upkeep, setup free abilities, or Mentor event).
		for (const [id, count] of now.abilityCounts) {
			const was = before.abilityCounts.get(id) ?? 0;
			if (count > was) {
				const character = world.campaign.characters[id];
				if (character) {
					const inShop = phase === 'upkeep' || phase === 'setup.supply';
					characterVoice.playFor(character, 'upgrade', {
						priority: inShop ? 'ui' : 'game',
						interrupt: true,
						dedupe: true,
					});
					break;
				}
			}
		}

		const game = world.game;
		if (!game || before.players.size === 0) return;

		// 3. Scar vote cast onto a character — every screen hears that character's punchline.
		if (now.scarVotes.size > 0) {
			for (const [who, seat] of now.scarVotes) {
				if (before.scarVotes.get(who) !== seat) {
					const player = game.players[seat];
					const character = player ? world.campaign.characters[player.character] : undefined;
					if (character) {
						characterVoice.playFor(character, 'punchline', { priority: 'ui', dedupe: true });
						return;
					}
				}
			}
		}

		if (quiet) return;

		// 4. Replacement character stepping into a fallen seat.
		for (const [seat, nextPlayer] of now.players) {
			const prevPlayer = before.players.get(seat);
			if (prevPlayer && prevPlayer.character !== nextPlayer.character) {
				const nextChar = world.campaign.characters[nextPlayer.character];
				if (nextChar) {
					characterVoice.playFor(nextChar, 'punchline', { priority: 'game', interrupt: true, dedupe: true });
					return;
				}
			}
		}

		// Ignore undo or new game log resets.
		if (now.logSeq < before.logSeq || now.resultsCount !== before.resultsCount) return;

		const fresh = entriesSince(game.log, before.logSeq);
		if (fresh.length === 0 || fresh.length > MOST_ENTRIES) return;

		// 5. Scar inflicted on a character (exposure confirm or Legacy/ScarVote scar).
		const scar = fresh.findLast(entry => entry.t === 'scar');
		if (scar) {
			const character = world.campaign.characters[scar.character];
			if (character) {
				characterVoice.playFor(character, 'scar', {
					priority: 'game',
					interrupt: true,
					cooldownMs: SCAR_REPEAT_COOLDOWN_MS,
					dedupe: true,
				});
				return;
			}
		}

		// 6. Card or supply cube received from another player -> recipient says thanks.
		const thanked = this.findRecipient(game.active, before.players, now.players);
		if (thanked) {
			const recipient = game.players[thanked];
			const character = recipient ? world.campaign.characters[recipient.character] : undefined;
			if (character) {
				characterVoice.playFor(character, 'thanks', { priority: 'game', interrupt: false });
				return;
			}
		}

		// 7. Movement -> danger if entering Plague/Hollow Men, greet if joining a teammate,
		//    thanks if moved by a teammate, else leave.
		const move = fresh.findLast(entry => entry.t === 'move');
		if (move) {
			const mover = game.players[move.seat];
			const character = mover ? world.campaign.characters[mover.character] : undefined;
			if (!character) return;

			const dest = game.locations[move.to];
			if (dest && (dest.hollow > 0 || dest.plague > 0)) {
				characterVoice.playFor(character, 'danger', { priority: 'game', interrupt: true });
				return;
			}

			const joinedTeammate = game.seats.some(other => {
				if (other === move.seat) return false;
				const otherPlayer = game.players[other];
				return otherPlayer?.location === move.to;
			});
			if (joinedTeammate) {
				characterVoice.playFor(character, 'greet', { priority: 'game', interrupt: false });
				return;
			}

			if (move.by === 'airlift' || move.seat !== game.active) {
				characterVoice.playFor(character, 'thanks', { priority: 'game', interrupt: false });
				return;
			}

			const leftTeammate = [...before.players.entries()].some(
				([other, snapshot]) => other !== move.seat && snapshot.location === move.from,
			);
			characterVoice.playFor(character, 'leave', {
				priority: 'game',
				interrupt: false,
				...(leftTeammate ? {} : { cooldownMs: SOLO_LEAVE_COOLDOWN_MS }),
			});
		}
	}

	/** Plays `danger` for a character standing in a city right when Plague or Hollow Men land on them. */
	dangerAt(world: World, city: CityId) {
		const game = world.game;
		if (!game) return;
		const seatsAt = game.seats.filter(seat => game.players[seat]?.location === city);
		if (!seatsAt.length) return;
		const chosen = seatsAt.includes(game.active) ? game.active : seatsAt[0]!;
		const character = world.campaign.characters[game.players[chosen]!.character];
		if (!character || character.dead) return;
		characterVoice.playFor(character, 'danger', { priority: 'game', interrupt: true });
	}

	stop() {
		this.prev = null;
		characterVoice.stop();
	}

	private observeLobby(world: World, before: Snapshot, now: Snapshot) {
		for (const id of now.characterIds) {
			if (!before.characterIds.has(id)) {
				const created = world.campaign.characters[id];
				if (created && !created.worker) {
					characterVoice.playFor(created, 'punchline', { priority: 'ui', dedupe: true });
					return;
				}
			}
		}

		for (const [id, portrait] of now.portraits) {
			const prevPortrait = before.portraits.get(id);
			if (prevPortrait !== undefined && prevPortrait !== portrait) {
				const character = world.campaign.characters[id];
				if (character) {
					characterVoice.playFor(character, 'punchline', { priority: 'ui', dedupe: true });
					return;
				}
			}
		}

		for (const [id, holder] of now.claims) {
			const prevHolder = before.claims.get(id) ?? null;
			if (holder && holder !== prevHolder) {
				const character = world.campaign.characters[id];
				if (character) {
					characterVoice.playFor(character, 'punchline', { priority: 'ui', dedupe: true });
					return;
				}
			}
		}

		const specialist = now.draftJob ? (jobFigure(now.draftJob) as FigureKey | null) : null;
		const prevSpecialist = before.draftJob ? (jobFigure(before.draftJob) as FigureKey | null) : null;
		if (specialist && specialist !== prevSpecialist) {
			characterVoice.play(specialist, 'punchline', { priority: 'ui', dedupe: true });
			return;
		}

		if (!specialist && now.draftPortrait !== null && now.draftPortrait !== before.draftPortrait) {
			characterVoice.play(`survivor-${now.draftPortrait}` as FigureKey, 'punchline', { priority: 'ui', dedupe: true });
		}
	}

	private findRecipient(
		active: SeatId,
		before: Map<SeatId, PlayerSnapshot>,
		now: Map<SeatId, PlayerSnapshot>,
	): SeatId | null {
		// Card passed from one seat's hand directly into another seat's hand.
		const cardRecipients: SeatId[] = [];
		for (const [seat, next] of now) {
			const prev = before.get(seat);
			if (!prev) continue;
			for (const card of next.hand) {
				if (prev.hand.has(card)) continue;
				const cameFromOther = [...before.entries()].some(
					([other, otherPrev]) => other !== seat && otherPrev.hand.has(card) && !now.get(other)?.hand.has(card),
				);
				if (cameFromOther) {
					cardRecipients.push(seat);
					break;
				}
			}
		}
		if (cardRecipients.length) {
			return cardRecipients.find(seat => seat !== active) ?? cardRecipients[0]!;
		}

		// Supply cubes transferred between two players.
		let supplyGiver: SeatId | null = null;
		let supplyReceiver: SeatId | null = null;
		for (const [seat, next] of now) {
			const prev = before.get(seat);
			if (!prev) continue;
			if (next.supplies < prev.supplies) supplyGiver = seat;
			if (next.supplies > prev.supplies) supplyReceiver = seat;
		}
		if (supplyGiver && supplyReceiver && supplyGiver !== supplyReceiver) {
			return supplyReceiver;
		}

		return null;
	}
}
