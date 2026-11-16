<script lang="ts">
	import { cityDef, handLimit, pack } from '@repo/game';
	import type { CardId, SeatId, World } from '@repo/game';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import { inkOn } from '#lib/color.ts';
	import { cardName, cityName } from './labels.svelte.ts';
	import Bubble from '#lib/replay/Bubble.svelte';
	import type { SaidNote } from '#lib/replay/replay.svelte.ts';
	import type { Place } from './seats.ts';

	type Props = {
		/** Who sits here: the player in a replay, the character at a live table. */
		name: string;
		seat: SeatId;
		color: string;
		world: World;
		place: Place;
		notes?: SaidNote[];
		dimmed?: boolean;
		/** Followed in a replay, or the hand the dock shows at a live table. */
		selected: boolean;
		/** What clicking the slip does, as its tooltip. */
		action: string;
		/** Shown while selected, beside the name. */
		selectedTag?: string;
		onselect: () => void;
		onnote?: (note: SaidNote) => void;
		/** At a networked table, marks which pawn this browser plays. */
		claim?: { mine: boolean; toggle: () => void } | null;
	};

	let {
		name,
		seat,
		color,
		world,
		place,
		notes = [],
		dimmed = false,
		selected,
		action,
		selectedTag,
		onselect,
		onnote = () => {},
		claim = null,
	}: Props = $props();

	const game = $derived(world.game);
	const player = $derived(game?.players[seat]);
	const character = $derived(player ? world.campaign.characters[player.character] : undefined);
	const job = $derived(pack.jobs.find(candidate => candidate.id === character?.job));
	// Some characters are named after their job, and at a live table the slip already carries the character's name.
	const role = $derived(character?.worker ? 'haven worker' : job && job.name !== character?.name ? job.name : null);
	const who = $derived(
		[character && character.name !== name ? character.name : null, role].filter(Boolean).join(', ') || null,
	);
	const active = $derived(game !== null && game.active === seat && !game.outcome);
	const top = $derived(place === 'tl' || place === 'tr');
	const right = $derived(place === 'tr' || place === 'br');

	const CARD_TINT = { epidemic: '#8c1c12', produce: '#5d7a3a', event: '#ece3cf', companion: '#6b5a86' } as const;
	function tint(id: CardId) {
		const card = world.campaign.playerCards[id];
		if (!card) return '#8d8476';
		if (card.kind === 'city') return CITY_COLOR[cityDef(card.city).color ?? 'haven'];
		return CARD_TINT[card.kind];
	}
</script>

<div class="corner {place}" class:dimmed data-testid="corner" data-player={name}>
	{#if top}
		{@render slip()}
		{@render bubbles()}
	{:else}
		{@render bubbles()}
		{@render slip()}
	{/if}
</div>

{#snippet slip()}
	<div class="seat" style:--seat={color} style:--on={inkOn(color)}>
		<button class="slip" class:active class:selected onclick={onselect} title={action} aria-pressed={selected}>
			<span class="head">
				<span class="pawn"></span>
				<strong>{name}</strong>
				{#if active}
					<span class="turn" data-testid="corner-turn"
						>Playing{#if game && game.actionsLeft > 0}<span class="pips"
								>{#each { length: game.actionsLeft } as _, index (index)}<i></i>{/each}</span
							>{/if}</span
					>
				{:else if selected && selectedTag}
					<span class="turn quiet">{selectedTag}</span>
				{/if}
			</span>
			{#if player && character}
				<span class="who">
					<span class="role" class:covered={character.jobScar !== null} title={job?.text}>{who ?? ''}</span>
					<em>{cityName(player.location)}</em>
				</span>
				<span class="hand" title="Cards in hand">
					{#each player.hand as card (card)}
						<i style:--card={tint(card)} title={cardName(world, card)}></i>
					{/each}
					<b class:over={player.hand.length > handLimit(world, seat)}>{player.hand.length}/{handLimit(world, seat)}</b>
				</span>
				<span class="row">
					<span title="Supply cubes carried">Carrying <b>{player.supplies}</b></span>
					{#if !character.worker}
						<span class="exposure" title="Exposure track. A scar or a skull hides under some boxes.">
							Exposure
							{#each { length: pack.numbers.exposureBoxes } as _, box (box)}
								{@const result = box < character.exposure ? character.exposureTrack[box] : undefined}
								<i
									class:scratched={box < character.exposure}
									class:scar={result === 'scar'}
									class:skull={result === 'skull'}
								></i>
							{/each}
						</span>
					{/if}
				</span>
				{#if character.jobScar || character.slots.some(slot => slot)}
					<span class="traits">
						{#if character.jobScar}
							{@const scar = pack.scars.find(candidate => candidate.id === character.jobScar)}
							<span class="scar" title={scar?.text}>{scar?.name}</span>
						{/if}
						{#each character.slots as slot, index (index)}
							{#if slot}
								{@const def =
									slot.kind === 'ability'
										? pack.abilities.find(ability => ability.id === slot.id)
										: pack.scars.find(scar => scar.id === slot.id)}
								<span class={slot.kind} title={def?.text}>{def?.name}</span>
							{/if}
						{/each}
					</span>
				{/if}
			{:else}
				<span class="who">At the table</span>
			{/if}
		</button>
		{#if claim}
			<button
				class="claim"
				class:on={claim.mine}
				onclick={claim.toggle}
				title={claim.mine ? `Stop playing ${name} on this browser` : `Mark ${name} as the character you play`}
				>{claim.mine ? 'you' : 'claim'}</button
			>
		{/if}
	</div>
{/snippet}

{#snippet bubbles()}
	<div class="bubbles">
		{#each notes as note, index (note.key)}
			<Bubble {note} folded={index < notes.length - 1} above={!top} {right} {color} onopen={() => onnote(note)} />
		{/each}
	</div>
{/snippet}

<style>
	.corner {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		pointer-events: none;
		transition: opacity 250ms ease;
	}

	.corner > :global(*) {
		pointer-events: auto;
	}

	.tr,
	.br {
		align-items: flex-end;
	}

	.seat {
		position: relative;
		width: 100%;
	}

	.claim {
		position: absolute;
		right: 0.55rem;
		bottom: 0.45rem;
		padding: 0 0.4rem;
		border: 1px solid color-mix(in srgb, var(--on) 45%, transparent);
		border-radius: 2px;
		background: none;
		color: var(--on);
		font: inherit;
		font-size: 0.7rem;
		cursor: pointer;
	}

	.claim.on {
		background: var(--on);
		color: var(--seat);
		font-weight: 700;
	}

	.dimmed .slip {
		opacity: 0.55;
	}

	.bubbles {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		width: 19.5rem;
		max-width: 24vw;
		pointer-events: none;
	}

	.bubbles > :global(*) {
		pointer-events: auto;
	}

	.tr .bubbles,
	.br .bubbles {
		align-items: flex-end;
	}

	.tl .bubbles,
	.bl .bubbles {
		align-items: flex-start;
	}

	.slip {
		--soft: color-mix(in srgb, var(--on) 74%, transparent);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 100%;
		padding: 0.45rem 0.65rem 0.5rem;
		border: 0;
		border-radius: 2px;
		background:
			radial-gradient(ellipse at 15% 0%, rgb(255 248 228 / 0.2), transparent 65%),
			linear-gradient(170deg, var(--seat), color-mix(in srgb, var(--seat) 82%, #140c06));
		box-shadow: var(--slip-shadow);
		color: var(--on);
		font-family: var(--font-ui);
		text-align: left;
		cursor: pointer;
		transition:
			translate 300ms cubic-bezier(0.2, 0.9, 0.3, 1.2),
			box-shadow 300ms ease,
			opacity 250ms ease;
	}

	.slip.active {
		translate: 0 0.25rem;
		box-shadow:
			0 0 0 2px var(--on),
			0 1rem 2rem rgb(20 12 4 / 0.55);
	}

	.bl .slip.active,
	.br .slip.active {
		translate: 0 -0.25rem;
	}

	.slip.selected {
		outline: 2px dashed var(--seat);
		outline-offset: 3px;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.pawn {
		width: 0.65rem;
		height: 0.65rem;
		flex: none;
		border: 2px solid var(--on);
		border-radius: 50%;
	}

	.active .pawn {
		background: var(--on);
	}

	strong {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 400;
		line-height: 1;
	}

	.turn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: auto;
		padding: 0.05rem 0.45rem;
		border-radius: 2px;
		background: var(--slip-ink);
		color: var(--slip);
		font-size: 0.72rem;
		font-weight: 700;
		animation: tagged 380ms cubic-bezier(0.2, 1.4, 0.4, 1);
	}

	.turn.quiet {
		background: none;
		color: var(--soft);
		font-weight: 500;
	}

	.pips {
		display: flex;
		gap: 2px;
	}

	.pips i {
		width: 0.38rem;
		height: 0.38rem;
		border-radius: 50%;
		background: var(--slip);
	}

	@keyframes tagged {
		from {
			opacity: 0;
			translate: 0 0.4rem;
		}
	}

	.who {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		color: var(--soft);
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.role {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.role.covered {
		text-decoration: line-through;
	}

	.traits {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		font-size: 0.68rem;
	}

	.traits span {
		padding: 0 0.35rem;
		border-radius: 2px;
		background: color-mix(in srgb, var(--on) 16%, transparent);
	}

	.traits .scar {
		background: rgb(20 10 6 / 0.35);
		text-decoration: underline dotted;
	}

	.who em {
		flex: none;
		margin-left: auto;
		color: var(--on);
		font-family: var(--font-display);
		font-size: 0.92rem;
	}

	.hand {
		display: flex;
		align-items: center;
		gap: 3px;
		min-height: 1rem;
	}

	.hand i {
		width: 0.62rem;
		height: 0.9rem;
		border: 1px solid rgb(20 12 4 / 0.45);
		border-radius: 1px;
		background: var(--card);
		box-shadow: 0 1px 1px rgb(20 12 4 / 0.3);
	}

	.hand b,
	.row b {
		color: var(--on);
		font-weight: 700;
	}

	.hand b {
		margin-left: 0.3rem;
		font-size: 0.74rem;
	}

	.over {
		text-decoration: underline wavy;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		color: var(--soft);
		font-size: 0.74rem;
		white-space: nowrap;
	}

	.exposure {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.exposure i {
		width: 0.5rem;
		height: 0.5rem;
		border: 1px solid var(--soft);
		border-radius: 1px;
	}

	.exposure i:first-of-type {
		margin-left: 0.25rem;
	}

	.exposure i.scratched {
		background: var(--soft);
	}

	.exposure i.scar {
		border-color: #f1c35a;
		background: #f1c35a;
	}

	.exposure i.skull {
		border-color: #1d140d;
		background: #1d140d;
	}
</style>
