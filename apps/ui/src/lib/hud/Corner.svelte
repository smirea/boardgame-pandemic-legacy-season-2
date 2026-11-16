<script lang="ts">
	import { handLimit, pack } from '@repo/game';
	import type { SeatId, World } from '@repo/game';
	import { inkOn } from '#lib/color.ts';
	import Bubble from '#lib/replay/Bubble.svelte';
	import type { SaidNote } from '#lib/replay/replay.svelte.ts';
	import { flip } from 'svelte/animate';
	import { cubicIn } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { deal } from './deal.ts';
	import { cardName, cityName } from './labels.svelte.ts';
	import { cardColor } from './PlayerCard.svelte';
	import Portrait from './Portrait.svelte';
	import type { Place } from './seats.ts';
	import { turnSteps } from './turn.ts';

	type Props = {
		/** Who sits here: the player in a replay, the character at a live table. */
		name: string;
		seat: SeatId;
		color: string;
		world: World;
		place: Place;
		/** False for the hand the dock is already holding up, so it is not shown twice. */
		showHand?: boolean;
		notes?: SaidNote[];
		dimmed?: boolean;
		/** Followed in a replay, or the hand the dock shows at a live table. */
		selected: boolean;
		/** What clicking the card does, as its tooltip. */
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
		showHand = true,
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
	// At a live table the card is headed with the character's name, so it is not repeated underneath.
	const subtitle = $derived(
		[character && character.name !== name ? character.name : null, character?.worker ? 'Haven worker' : null]
			.filter(Boolean)
			.join(', '),
	);
	const active = $derived(game !== null && game.active === seat && !game.outcome);
	const top = $derived(place === 'tl' || place === 'tr');
	const right = $derived(place === 'tr' || place === 'br');

	/** The character card, one line each: the job, then every ability and scar written on it. */
	const traits = $derived.by(() => {
		if (!character) return [];
		const lines: { kind: 'job' | 'ability' | 'scar'; name: string; text: string; struck?: boolean }[] = [];
		if (job) lines.push({ kind: 'job', name: job.name, text: job.text, struck: character.jobScar !== null });
		if (character.jobScar) {
			const scar = pack.scars.find(candidate => candidate.id === character.jobScar);
			if (scar) lines.push({ kind: 'scar', name: scar.name, text: scar.text });
		}
		for (const slot of character.slots) {
			if (!slot) continue;
			const def =
				slot.kind === 'ability'
					? pack.abilities.find(ability => ability.id === slot.id)
					: pack.scars.find(scar => scar.id === slot.id);
			if (def) lines.push({ kind: slot.kind, name: def.name, text: def.text });
		}
		return lines;
	});

	const hand = $derived((player?.hand ?? []).flatMap(id => world.campaign.playerCards[id] ?? []));
	// Cards drawn this turn come from the Player deck. Anything else, such as a shared card, settles in where it lands.
	const drawnThisTurn = $derived.by(() => {
		const log = game?.log ?? [];
		const since = log.slice(log.findLastIndex(entry => entry.t === 'turn') + 1);
		return new Set(since.flatMap(entry => (entry.t === 'draw' && entry.seat === seat ? [entry.card] : [])));
	});
	const steps = $derived(active ? turnSteps(world, seat) : []);
</script>

<div class="corner {place}" class:dimmed data-testid="corner" data-player={name}>
	{#if top}
		{@render card()}
		{@render held()}
		{@render bubbles()}
	{:else}
		{@render bubbles()}
		{@render held()}
		{@render card()}
	{/if}
</div>

{#snippet card()}
	<div class="seat" style:--seat={color} style:--on={inkOn(color)}>
		<button class="slip" class:active class:selected onclick={onselect} title={action} aria-pressed={selected}>
			<span class="portrait">
				<Portrait
					id={character?.id ?? seat}
					{color}
					hooded={character?.worker ?? false}
					dead={character?.dead ?? false}
				/>
			</span>
			<span class="body">
				<span class="head">
					<strong>{name}</strong>
					{#if player}
						<span class="cubes" title="Supply cubes carried">
							{#each { length: player.supplies } as _, index (index)}<i></i>{/each}
						</span>
					{/if}
				</span>
				{#if player && character}
					<span class="where">
						{#if subtitle}<span class="role">{subtitle}</span>{/if}
						<em>{cityName(player.location)}</em>
					</span>
					<span class="traits">
						{#each traits as trait (`${trait.kind}:${trait.name}`)}
							<span class="trait {trait.kind}" class:struck={trait.struck} title={`${trait.name}: ${trait.text}`}>
								<b>{trait.name}</b>
								{trait.text}
							</span>
						{/each}
					</span>
					<span class="foot">
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
						<span
							class="count"
							class:over={player.hand.length > handLimit(world, seat)}
							title="Cards in hand, out of the hand limit">{player.hand.length}/{handLimit(world, seat)} cards</span
						>
					</span>
				{:else}
					<span class="where">At the table</span>
				{/if}
			</span>
		</button>
		{#if active}
			<span class="turn" data-testid="corner-turn"
				>Playing{#if game && game.actionsLeft > 0}<span class="pips"
						>{#each { length: game.actionsLeft } as _, index (index)}<i></i>{/each}</span
					>{/if}</span
			>
		{:else if selected && selectedTag}
			<span class="turn quiet">{selectedTag}</span>
		{/if}
		{#if claim}
			<button
				class="claim"
				class:on={claim.mine}
				onclick={claim.toggle}
				title={claim.mine ? `Stop playing ${name} on this browser` : `Mark ${name} as the character you play`}
				>{claim.mine ? 'you' : 'claim'}</button
			>
		{/if}
		{#if steps.length}
			<!-- The turn so far, beside the card on the side facing the board. -->
			<ol class="steps" data-testid="turn-steps">
				{#each steps as step, index (step.seq)}
					<li class={step.kind} in:fly={{ x: right ? 24 : -24, duration: 320 }} animate:flip={{ duration: 260 }}>
						<i>{index + 1}</i>
						<b>{step.name}</b>
						{#if step.detail}<span>{step.detail}</span>{/if}
					</li>
				{/each}
			</ol>
		{/if}
	</div>
{/snippet}

{#snippet held()}
	{#if showHand && hand.length}
		<!-- The hand fans along the card's width, each card showing its name down its visible edge. -->
		<div class="hand" style:--n={hand.length} data-testid="corner-hand">
			{#each hand as held (held.id)}
				{@const label = held.kind === 'epidemic' ? 'Epidemic' : cardName(world, held.id)}
				<button
					class="mini"
					style:--band={cardColor(held)}
					style:--ink={inkOn(cardColor(held))}
					title={label}
					onclick={onselect}
					data-name={label}
					animate:flip={{ duration: 320 }}
					in:deal={{ drawn: drawnThisTurn.has(held.id) }}
					out:fly={{ y: top ? 16 : -16, duration: 220, easing: cubicIn }}
				>
					<span>{label}</span>
				</button>
			{/each}
		</div>
	{/if}
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
		gap: 0.45rem;
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

	.dimmed .slip {
		opacity: 0.55;
	}

	.seat {
		position: relative;
		width: 100%;
	}

	/* A character card laid on the table: the portrait down the left, the card's lines beside it. */
	.slip {
		--soft: color-mix(in srgb, var(--on) 74%, transparent);
		display: grid;
		grid-template-columns: 4.1rem minmax(0, 1fr);
		width: 100%;
		min-height: 6.4rem;
		padding: 0;
		overflow: hidden;
		border: 0;
		border-radius: 3px;
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

	.portrait {
		display: block;
		min-height: 100%;
		border-right: 1px solid rgb(20 12 4 / 0.35);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
		padding: 0.4rem 0.55rem 0.45rem;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 1.35rem;
	}

	strong {
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 400;
		line-height: 1;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Carried cubes stack two high and grow sideways, so any load fits beside the name. */
	.cubes {
		display: grid;
		grid-auto-flow: column;
		grid-template-rows: repeat(2, 0.5rem);
		gap: 2px;
		margin-left: auto;
	}

	.cubes i {
		width: 0.5rem;
		height: 0.5rem;
		border: 1px solid rgb(20 12 4 / 0.55);
		border-radius: 1px;
		background: linear-gradient(135deg, #fbf5e6, #d9cfb8);
		box-shadow: 0 1px 0 rgb(20 12 4 / 0.35);
	}

	.where {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		color: var(--soft);
		font-size: 0.74rem;
		white-space: nowrap;
	}

	.role {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.where em {
		flex: none;
		margin-left: auto;
		color: var(--on);
		font-family: var(--font-display);
		font-size: 0.9rem;
	}

	.traits {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.trait {
		overflow: hidden;
		padding: 0.05rem 0.3rem;
		border-left: 2px solid color-mix(in srgb, var(--on) 45%, transparent);
		background: color-mix(in srgb, var(--on) 10%, transparent);
		color: var(--soft);
		font-size: 0.68rem;
		line-height: 1.35;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.trait b {
		color: var(--on);
		font-weight: 700;
	}

	.trait.struck b {
		text-decoration: line-through;
	}

	.trait.scar {
		border-left-color: #1d140d;
		background: rgb(20 10 6 / 0.3);
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: auto;
		color: var(--soft);
		font-size: 0.68rem;
	}

	.count {
		margin-left: auto;
	}

	.count.over {
		color: var(--on);
		font-weight: 700;
		text-decoration: underline wavy;
	}

	.exposure {
		display: flex;
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

	/* The turn tab sits on the card's edge facing the board's middle. */
	.turn {
		position: absolute;
		top: -0.6rem;
		right: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.05rem 0.45rem;
		border-radius: 2px;
		background: var(--slip-ink);
		color: var(--slip);
		font-size: 0.7rem;
		font-weight: 700;
		pointer-events: none;
		animation: tagged 380ms cubic-bezier(0.2, 1.4, 0.4, 1);
	}

	.bl .turn,
	.br .turn {
		top: auto;
		bottom: calc(100% - 0.6rem);
	}

	.turn.quiet {
		background: color-mix(in srgb, var(--seat) 70%, #140c06);
		color: var(--on);
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

	.claim {
		position: absolute;
		right: 0.55rem;
		bottom: 0.35rem;
		padding: 0 0.4rem;
		border: 1px solid color-mix(in srgb, var(--on) 45%, transparent);
		border-radius: 2px;
		background: var(--seat);
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

	/* The active player's turn so far, floating beside the card toward the board. */
	.steps {
		position: absolute;
		top: 0;
		left: calc(100% + 0.5rem);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: max-content;
		max-width: 14rem;
		margin: 0;
		padding: 0;
		list-style: none;
		pointer-events: none;
	}

	.tr .steps,
	.br .steps {
		right: calc(100% + 0.5rem);
		left: auto;
		align-items: flex-end;
	}

	.bl .steps,
	.br .steps {
		top: auto;
		bottom: 0;
	}

	.steps li {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		padding: 0.22rem 0.55rem 0.24rem 0.3rem;
		border-left: 3px solid var(--seat);
		border-radius: 2px;
		background: rgb(240 231 210 / 0.95);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font-size: 0.74rem;
		line-height: 1.25;
	}

	.steps li.event {
		border-left-color: #b08628;
	}

	.steps i {
		min-width: 1rem;
		color: rgb(42 32 23 / 0.55);
		font-style: normal;
		font-weight: 700;
		text-align: center;
	}

	.steps b {
		font-weight: 700;
	}

	.steps span {
		color: rgb(42 32 23 / 0.75);
	}

	/* Mini cards overlap just enough that the whole hand spans the card's width and no more. */
	.hand {
		--card: 2.45rem;
		display: flex;
		width: 100%;
	}

	.tr .hand,
	.br .hand {
		justify-content: flex-end;
	}

	.mini {
		position: relative;
		flex: none;
		width: var(--card);
		height: 4.3rem;
		padding: 0.25rem 0 0.25rem 0.18rem;
		border: 1px solid rgb(20 12 4 / 0.45);
		border-radius: 3px;
		background:
			linear-gradient(90deg, var(--band) 0 0.95rem, color-mix(in srgb, var(--band) 30%, #f1e9d6) 0.95rem), var(--band);
		box-shadow:
			-2px 0 4px rgb(20 12 4 / 0.25),
			0 2px 3px rgb(20 12 4 / 0.3);
		color: var(--ink);
		cursor: pointer;
		transition: translate 160ms ease;
	}

	.mini + .mini {
		margin-left: min(0.2rem, calc((100% - var(--n) * var(--card)) / max(1, var(--n) - 1)));
	}

	.mini:hover {
		z-index: 2;
		translate: 0 -0.3rem;
	}

	.tl .mini:hover,
	.tr .mini:hover {
		translate: 0 0.3rem;
	}

	.mini span {
		display: block;
		width: 0.85rem;
		overflow: hidden;
		max-height: 100%;
		font-family: var(--font-display);
		font-size: 0.64rem;
		line-height: 0.9rem;
		text-overflow: ellipsis;
		white-space: nowrap;
		writing-mode: vertical-rl;
		rotate: 180deg;
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
</style>
