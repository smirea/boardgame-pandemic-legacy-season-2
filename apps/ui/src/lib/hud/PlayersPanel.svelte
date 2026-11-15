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
						title="Mark this seat as yours">{mine.includes(seat) ? 'me' : 'claim'}</button
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
	.players {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.player {
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--line);
		border-left: 3px solid var(--seat);
		border-radius: 0.5rem;
		background: var(--panel);
		backdrop-filter: blur(8px);
		transition:
			box-shadow 250ms ease,
			transform 250ms ease;
	}

	.player.active {
		box-shadow: 0 0 0 1px var(--seat);
		transform: translateX(0.25rem);
	}

	.main {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.pawn {
		width: 0.7rem;
		height: 0.7rem;
		flex: none;
		border-radius: 50%;
		background: var(--seat);
	}

	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.15;
	}

	.who strong {
		font-size: 0.8rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.who small {
		color: var(--muted);
		font-size: 0.62rem;
	}

	.who small.covered {
		text-decoration: line-through;
	}

	.where {
		margin-left: auto;
		color: var(--muted);
		font-size: 0.68rem;
		white-space: nowrap;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.3rem;
		color: var(--muted);
		font-size: 0.68rem;
	}

	.over {
		color: var(--danger);
	}

	.exposure {
		display: flex;
		gap: 2px;
	}

	.exposure i {
		width: 0.5rem;
		height: 0.5rem;
		border: 1px solid var(--muted);
		border-radius: 1px;
	}

	.exposure i.scratched {
		background: var(--muted);
	}

	.exposure i.scar {
		border-color: var(--warn);
		background: var(--warn);
	}

	.exposure i.skull {
		border-color: var(--danger);
		background: var(--danger);
	}

	.claim {
		margin-left: auto;
		padding: 0 0.4rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: none;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}

	.claim.on {
		border-color: var(--accent);
		color: var(--accent);
	}

	.traits {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.3rem;
		font-size: 0.6rem;
	}

	.traits span {
		padding: 0 0.35rem;
		border-radius: 0.25rem;
		background: rgb(125 252 192 / 0.14);
		color: var(--accent);
	}

	.traits .scar {
		background: rgb(255 107 107 / 0.16);
		color: var(--danger);
	}
</style>
