<script lang="ts">
	import { handLimit, pack } from '@repo/game';
	import type { SeatId, World } from '@repo/game';
	import { inkOn } from '#lib/color.ts';
	import { backOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
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
			in:fly={{ x: -80, duration: 520, delay: 120 + index * 110, easing: backOut }}
			class="player"
			class:active={game.active === seat}
			class:viewing={viewing === seat}
			style:--seat={SEAT_COLORS[index]}
			style:--on={inkOn(SEAT_COLORS[index] ?? '#000000')}
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
				{#if game.active === seat}<span class="turnmark">Playing</span>{/if}
			</button>
			<div class="row">
				<span title="Supply cubes carried">Supplies <b>{player.supplies}</b></span>
				<span title="Cards in hand, out of the hand limit" class:over={player.hand.length > handLimit(world, seat)}
					>Cards <b>{player.hand.length}/{handLimit(world, seat)}</b></span
				>
				{#if !solo}
					<button
						class="claim"
						class:on={mine.includes(seat)}
						onclick={() => onclaim(seat)}
						title={`Mark ${character.name} as the character you play`}>{mine.includes(seat) ? 'you' : 'claim'}</button
					>
				{/if}
			</div>
			<div class="row">
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
		position: relative;
		--soft: color-mix(in srgb, var(--on) 74%, transparent);
		--rule: color-mix(in srgb, var(--on) 35%, transparent);
		padding: 0.45rem 0.6rem 0.5rem;
		border-radius: 2px;
		background:
			radial-gradient(ellipse at 15% 0%, rgb(255 248 228 / 0.2), transparent 65%),
			linear-gradient(170deg, var(--seat), color-mix(in srgb, var(--seat) 82%, #140c06));
		color: var(--on);
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
		border: 2px solid var(--on);
		border-radius: 50%;
		background: var(--seat);
	}

	.player.active .pawn {
		animation: beat 1.8s ease-in-out infinite;
	}

	@keyframes beat {
		50% {
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--on) 35%, transparent);
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
		color: var(--soft);
		font-size: 0.72rem;
	}

	.who small.covered {
		text-decoration: line-through;
	}

	.turnmark {
		position: absolute;
		top: -0.55rem;
		right: 0.5rem;
		padding: 0 0.4rem;
		border-radius: 2px;
		background: var(--slip-ink);
		color: var(--slip);
		font-family: var(--font-ui);
		font-size: 0.68rem;
		font-style: normal;
		font-weight: 700;
		line-height: 1.1rem;
		animation: tagged 380ms cubic-bezier(0.2, 1.4, 0.4, 1);
	}

	@keyframes tagged {
		from {
			opacity: 0;
			translate: 0 0.4rem;
		}
	}

	.where {
		margin-left: auto;
		max-width: 5.5rem;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--soft);
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-style: italic;
		white-space: nowrap;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		white-space: nowrap;
		margin-top: 0.3rem;
		color: var(--soft);
		font-size: 0.74rem;
	}

	.over {
		color: var(--on);
		font-weight: 700;
		text-decoration: underline wavy;
	}

	.row b {
		color: var(--on);
		font-weight: 700;
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

	.claim {
		margin-left: auto;
		padding: 0 0.4rem;
		border: 1px solid var(--rule);
		border-radius: 2px;
		background: none;
		color: var(--soft);
		font: inherit;
		cursor: pointer;
	}

	.claim.on {
		border-color: var(--on);
		background: var(--on);
		color: var(--seat);
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
		border-radius: 2px;
		background: color-mix(in srgb, var(--on) 16%, transparent);
	}

	.traits .scar {
		background: rgb(20 10 6 / 0.35);
		text-decoration: underline dotted;
	}
</style>
