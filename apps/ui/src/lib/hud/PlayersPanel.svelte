<script lang="ts">
	import { handLimit, pack } from '@repo/game';
	import type { SeatId, World } from '@repo/game';
	import { cityName, SEAT_COLORS } from './labels.svelte.ts';

	type Props = {
		world: World;
		mine: SeatId[];
		solo: boolean;
		viewing: SeatId | null;
		onview: (seat: SeatId) => void;
		onclaim: (seat: SeatId) => void;
	};

	let { world, mine, solo, viewing, onview, onclaim }: Props = $props();

	const game = $derived(world.game!);
</script>

<section class="players">
	{#each game.seats as seat, index (seat)}
		{@const player = game.players[seat]!}
		{@const character = world.campaign.characters[player.character]!}
		{@const job = pack.jobs.find(candidate => candidate.id === character.job)}
		<div
			class="player"
			class:active={game.active === seat}
			class:viewing={viewing === seat}
			style:--seat={SEAT_COLORS[index]}
			style:--tilt={`${[-0.6, 0.45, -0.3, 0.55][index] ?? 0}deg`}
		>
			<button class="main" onclick={() => onview(seat)} title="Show this hand">
				<span class="pawn"></span>
				<span class="who">
					<strong>{character.name}</strong>
					<small class:covered={character.jobScar !== null} title={job?.text}
						>{character.worker ? 'Haven worker' : (job?.name ?? '')}</small
					>
				</span>
				<span class="where">{cityName(player.location)}</span>
			</button>
			<div class="row">
				<span title="Supply cubes carried">▪ {player.supplies}</span>
				<span title="Cards in hand" class:over={player.hand.length > handLimit(world, seat)}
					>✋ {player.hand.length}/{handLimit(world, seat)}</span
				>
				{#if !character.worker}
					<span class="exposure" title="Exposure track. A scar or a skull hides under some boxes.">
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
				{#if !solo}
					<button
						class="claim"
						class:on={mine.includes(seat)}
						onclick={() => onclaim(seat)}
						title="Mark this seat as yours">{mine.includes(seat) ? 'you' : `play ${character.name}`}</button
					>
				{/if}
			</div>
			{#if character.jobScar || character.slots.some(slot => slot)}
				<div class="traits">
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
				</div>
			{/if}
		</div>
	{/each}
</section>

<style>
	/* Each character is a slip of card laid on the chart. Whoever's turn it is gets pulled out of the stack. */
	.players {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.player {
		padding: 0.45rem 0.6rem 0.5rem;
		border-left: 3px solid var(--seat);
		border-radius: 2px;
		background: var(--slip);
		color: var(--slip-ink);
		box-shadow: var(--slip-shadow);
		rotate: var(--tilt);
		transition:
			translate 300ms cubic-bezier(0.2, 0.9, 0.3, 1.2),
			rotate 300ms ease,
			box-shadow 300ms ease;
	}

	.player.active {
		translate: 0.4rem 0;
		rotate: 0deg;
		box-shadow:
			0 1px 1px rgb(40 26 12 / 0.35),
			0 0.9rem 1.8rem rgb(20 12 4 / 0.45);
	}

	.main {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.pawn {
		width: 0.6rem;
		height: 0.6rem;
		flex: none;
		border: 1px solid rgb(42 32 23 / 0.6);
		border-radius: 50%;
		background: var(--seat);
	}

	.player.active .pawn {
		animation: beat 1.8s ease-in-out infinite;
	}

	@keyframes beat {
		50% {
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--seat) 35%, transparent);
		}
	}

	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.1;
	}

	.who strong {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 400;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.who small {
		color: var(--slip-muted);
		font-size: 0.72rem;
	}

	.who small.covered {
		text-decoration: line-through;
	}

	.where {
		margin-left: auto;
		max-width: 5.5rem;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--slip-muted);
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-style: italic;
		white-space: nowrap;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.3rem;
		color: var(--slip-muted);
		font-size: 0.74rem;
	}

	.over {
		color: var(--ink-danger);
		font-weight: 600;
	}

	.exposure {
		display: flex;
		gap: 2px;
	}

	.exposure i {
		width: 0.5rem;
		height: 0.5rem;
		border: 1px solid var(--slip-muted);
		border-radius: 1px;
	}

	.exposure i.scratched {
		background: var(--slip-muted);
	}

	.exposure i.scar {
		border-color: var(--ink-warn);
		background: var(--ink-warn);
	}

	.exposure i.skull {
		border-color: var(--ink-danger);
		background: var(--ink-danger);
	}

	.claim {
		margin-left: auto;
		padding: 0 0.4rem;
		border: 1px solid var(--slip-line);
		border-radius: 2px;
		background: none;
		color: var(--slip-muted);
		font: inherit;
		cursor: pointer;
	}

	.claim.on {
		border-color: var(--slip-ink);
		background: var(--slip-ink);
		color: var(--slip);
	}

	.traits {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.35rem;
		font-size: 0.68rem;
	}

	.traits span {
		padding: 0 0.35rem;
		border: 1px solid rgb(61 107 85 / 0.45);
		border-radius: 2px;
		color: var(--ink-good);
	}

	.traits .scar {
		border-color: rgb(163 48 28 / 0.4);
		color: var(--ink-danger);
	}
</style>
