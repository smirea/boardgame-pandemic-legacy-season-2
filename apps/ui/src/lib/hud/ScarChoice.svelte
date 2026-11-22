<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { Command, Decide, ScarId, SeatId, World } from '@repo/game';
	import CardIcon from '#lib/cards/CardIcon.svelte';
	import { SCAR_ICON } from '#lib/cards/icons.ts';
	import OccupationIcon from '#lib/occupations/OccupationIcon.svelte';
	import { fly } from 'svelte/transition';
	import { cityName, seatName, SEAT_COLORS } from './labels.svelte.ts';
	import Portrait from './Portrait.svelte';
	import { keep } from './viewState.ts';

	type ScarDecide = Extract<Decide, { d: 'scar' }>;
	type Target = ScarDecide['target'];

	type Props = {
		world: World;
		/** Who takes the scar, or null when the table picks who. */
		seat: SeatId | null;
		/** The legal scar choices: which scar, on whom, over what. */
		decides: Decide[];
		/** Whether this screen makes the choice. Everyone else watches it being made. */
		canChoose: boolean;
		/** Who makes the choice, for everyone else's screen. */
		chooser: SeatId;
		send: (command: Command) => void;
	};

	let { world, seat, decides, canChoose, chooser, send }: Props = $props();

	const game = $derived(world.game!);
	const options = $derived(decides.filter((decide): decide is ScarDecide => decide.d === 'scar'));
	const seats = $derived(seat ? [seat] : [...new Set(options.flatMap(option => (option.seat ? [option.seat] : [])))]);

	let picked = $state<{ seat: SeatId | null; scar: ScarId | null; target: Target | null }>({
		seat: null,
		scar: null,
		target: null,
	});
	keep(
		'scar-choice',
		() => picked,
		saved => (picked = saved),
	);

	const who = $derived(seat ?? (picked.seat && seats.includes(picked.seat) ? picked.seat : seats[0]!));
	const character = $derived(world.campaign.characters[game.players[who]!.character]!);
	const color = $derived(SEAT_COLORS[game.seats.indexOf(who)] ?? '#4a4238');
	const mineOptions = $derived(options.filter(option => (option.seat ?? seat) === who));
	const legalScars = $derived(new Set(mineOptions.map(option => option.scar)));
	const scar = $derived(picked.scar && legalScars.has(picked.scar) ? picked.scar : null);
	const legalTargets = $derived(
		new Set(mineOptions.filter(option => option.scar === scar).map(option => JSON.stringify(option.target))),
	);
	const target = $derived(
		picked.target !== null && legalTargets.has(JSON.stringify(picked.target)) ? picked.target : null,
	);

	/** Every scar still in the box, the ones this character cannot take shown with the reason. */
	const scars = $derived(
		[...new Set(world.campaign.scars)]
			.filter(id => id !== 'carrier')
			.map(id => ({ def: pack.scars.find(entry => entry.id === id)!, legal: legalScars.has(id) })),
	);

	type Row =
		| { kind: 'job'; target: Target | null; name: string; text: string; struck: boolean }
		| { kind: 'ability' | 'scar'; target: Target | null; name: string; text: string }
		| { kind: 'empty'; target: Target; count: number };

	/** The card's lines in printed order. Empty slots are all alike, so they are one place to put a scar. */
	const rows = $derived.by((): Row[] => {
		const list: Row[] = [];
		const job = pack.jobs.find(entry => entry.id === character.job);
		if (job)
			list.push({ kind: 'job', target: 'job', name: job.name, text: job.text, struck: character.jobScar !== null });
		if (character.jobScar) {
			const def = pack.scars.find(entry => entry.id === character.jobScar)!;
			list.push({ kind: 'scar', target: null, name: def.name, text: def.text });
		}
		const empty = character.slots.flatMap((slot, index) => (slot ? [] : [index]));
		const seen = new Set<string>();
		character.slots.forEach((slot, index) => {
			if (!slot) return;
			if (slot.kind === 'scar') {
				if (seen.has(slot.id)) return;
				seen.add(slot.id);
				const def = pack.scars.find(entry => entry.id === slot.id)!;
				list.push({ kind: 'scar', target: null, name: def.name, text: def.text });
			} else {
				const def = pack.abilities.find(entry => entry.id === slot.id)!;
				list.push({ kind: 'ability', target: index, name: def.name, text: def.text });
			}
		});
		if (empty.length) list.push({ kind: 'empty', target: empty[0]!, count: empty.length });
		return list;
	});

	const can = (row: Row) => canChoose && row.target !== null && legalTargets.has(JSON.stringify(row.target));
	const scarName = $derived(scar ? pack.scars.find(entry => entry.id === scar)!.name : null);
	const place = $derived.by(() => {
		const row = rows.find(entry => entry.target !== null && JSON.stringify(entry.target) === JSON.stringify(target));
		if (!row) return null;
		if (row.kind === 'empty') return 'an empty slot';
		return row.kind === 'job' ? `the ${row.name} occupation` : `the ${row.name} ability`;
	});

	function pickScar(id: ScarId) {
		const targets = mineOptions.filter(option => option.scar === id).map(option => option.target);
		const covers = targets.filter(entry => entry === 'job' || character.slots[entry] !== null);
		const empty = rows.find(row => row.kind === 'empty');
		// With nowhere to put it but an empty slot, there is nothing more to ask.
		picked = { seat: who, scar: id, target: covers.length === 0 && empty ? empty.target : null };
	}

	function confirm() {
		const decide = mineOptions.find(
			option => option.scar === scar && JSON.stringify(option.target) === JSON.stringify(target),
		);
		if (decide) send({ type: 'DECIDE', decide });
	}
</script>

<div
	class="scar-choice"
	data-testid="scar-choice"
	{@attach feedback('Scar choice', () => ({ seat: who, scar, target, canChoose }))}
	in:fly={{ y: 30, duration: 320 }}
>
	<header>
		<span class="icon"><CardIcon path={SCAR_ICON} size="1.4rem" /></span>
		<div>
			<h2>{seat ? `${character.name} is scarred` : 'A scar is owed'}</h2>
			<p>
				{#if canChoose}
					{seat
						? 'Choose the scar, then where it goes on the card.'
						: 'Choose who takes it, the scar, then where it goes.'}
				{:else}
					Waiting for {seatName(world, chooser)} to choose.
				{/if}
			</p>
		</div>
	</header>

	{#if seats.length > 1}
		<div class="who" role="tablist" aria-label="Who takes the scar">
			{#each seats as other (other)}
				{@const them = world.campaign.characters[game.players[other]!.character]!}
				<button
					role="tab"
					aria-selected={other === who}
					class:on={other === who}
					style:--seat={SEAT_COLORS[game.seats.indexOf(other)]}
					disabled={!canChoose}
					onclick={() => (picked = { seat: other, scar: null, target: null })}
				>
					<span class="face"
						><Portrait portrait={them.portrait} color={SEAT_COLORS[game.seats.indexOf(other)]!} job={them.job} /></span
					>
					{them.name}
				</button>
			{/each}
		</div>
	{/if}

	<div class="table">
		<article class="card" style:--seat={color} aria-label={`${character.name}'s character card`}>
			<div class="top">
				<span class="portrait"><Portrait portrait={character.portrait} {color} job={character.job} /></span>
				<div class="title">
					<strong>{character.name}</strong>
					<small>Home: {cityName(character.home)}</small>
				</div>
			</div>
			<ol class="rows">
				{#each rows as row, index (index)}
					{@const open = can(row)}
					{@const chosen = target !== null && JSON.stringify(row.target) === JSON.stringify(target)}
					<li>
						<button
							class="row {row.kind}"
							class:open
							class:chosen
							disabled={!open}
							onclick={() => (picked = { ...picked, seat: who, target: row.target })}
							data-target={row.target === null ? undefined : String(row.target)}
						>
							{#if row.kind === 'empty'}
								<span class="kind">Empty slot{row.count > 1 ? `, ${row.count} left` : ''}</span>
								{#if chosen && scarName}<b class="incoming">{scarName}</b>{/if}
							{:else}
								<span class="kind">
									{#if row.kind === 'job' && character.job}<span class="glyph"
											><OccupationIcon job={character.job} /></span
										>{/if}
									{#if row.kind === 'scar'}<span class="glyph"><CardIcon path={SCAR_ICON} size="0.8rem" /></span>{/if}
									{row.kind === 'job' ? 'Occupation' : row.kind === 'ability' ? 'Ability' : 'Scar'}
								</span>
								<b class:struck={(row.kind === 'job' && row.struck) || chosen}>{row.name}</b>
								<span class="text" class:struck={(row.kind === 'job' && row.struck) || chosen}>{row.text}</span>
								{#if chosen && scarName}<b class="incoming">Covered by {scarName}</b>{/if}
							{/if}
						</button>
					</li>
				{/each}
			</ol>
		</article>

		<section class="scars" aria-label="Scars in the box">
			{#each scars as { def, legal } (def.id)}
				<button
					class="scar"
					class:chosen={scar === def.id}
					disabled={!canChoose || !legal}
					onclick={() => pickScar(def.id)}
					data-scar={def.id}
				>
					<span class="name"
						><span class="glyph"><CardIcon path={SCAR_ICON} size="0.9rem" /></span><b>{def.name}</b></span
					>
					<span class="text">{def.text}</span>
					{#if !legal}<small>Already carried</small>{/if}
				</button>
			{/each}
		</section>
	</div>

	{#if canChoose}
		<footer>
			<button class="primary" disabled={!scar || target === null} onclick={confirm} data-testid="scar-confirm">
				{#if scar && place}
					Scar {character.name} with {scarName} over {place}
				{:else if scar}
					Now pick where {scarName} goes on the card
				{:else}
					Pick a scar
				{/if}
			</button>
		</footer>
	{/if}
</div>

<style>
	/* Header, the card beside the scars (only the scars scroll), and the confirm button always in view. */
	.scar-choice {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: min(68rem, calc(100vw - 4rem));
		height: min(46rem, calc(100vh - 7rem));
		padding: 1.3rem 1.5rem;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--panel);
		backdrop-filter: blur(12px);
		box-shadow: 0 2rem 5rem rgb(0 0 0 / 0.6);
	}

	header {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	header .icon {
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 50%;
		background: rgb(163 48 28 / 0.25);
		color: #f0a08f;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-weight: 400;
	}

	header p {
		margin: 0.15rem 0 0;
		color: var(--muted);
	}

	.who {
		display: flex;
		gap: 0.5rem;
	}

	.who button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.8rem 0.25rem 0.25rem;
		border: 1px solid var(--line);
		border-bottom: 3px solid var(--seat);
		border-radius: 3px;
		background: none;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	.who button.on {
		background: color-mix(in srgb, var(--seat) 25%, transparent);
	}

	.who .face {
		position: relative;
		width: 2rem;
		height: 2rem;
		overflow: hidden;
		border-radius: 2px;
	}

	.table {
		display: grid;
		grid-template-columns: minmax(20rem, 1fr) minmax(22rem, 1.25fr);
		gap: 1.4rem;
		flex: 1 1 0;
		align-items: start;
		min-height: 0;
	}

	.card,
	.scars {
		max-height: 100%;
		overflow: auto;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1rem 1.1rem 1.1rem;
		border-top: 6px solid var(--seat);
		border-radius: 5px;
		background: var(--document);
		box-shadow: var(--document-shadow);
		color: var(--slip-ink);
	}

	.top {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.portrait {
		position: relative;
		width: 5.2rem;
		height: 5.2rem;
		overflow: hidden;
		border-radius: 4px;
	}

	.title strong {
		display: block;
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 400;
		line-height: 1.05;
	}

	.title small,
	.kind,
	.scar small {
		color: var(--slip-muted);
		font-size: 0.78rem;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row,
	.scar {
		display: flex;
		flex-direction: column;
		gap: 0.12rem;
		width: 100%;
		padding: 0.5rem 0.7rem 0.55rem;
		border: 2px solid transparent;
		border-left: 4px solid var(--ink-good);
		border-radius: 3px;
		background: rgb(255 255 255 / 0.28);
		color: inherit;
		font: inherit;
		text-align: left;
	}

	.row.ability {
		border-left-color: #6a7fa8;
	}

	.row.scar,
	.scar {
		border-left-color: var(--ink-danger);
	}

	.row.empty {
		min-height: 2.6rem;
		justify-content: center;
		border: 2px dashed rgb(42 32 23 / 0.28);
		background: none;
	}

	.row:disabled,
	.scar:disabled {
		cursor: default;
	}

	.row.open {
		border-color: rgb(163 48 28 / 0.55);
		border-left-color: var(--ink-danger);
		cursor: pointer;
		animation: invite 1.4s ease-in-out 2;
	}

	.row.open:hover {
		background: rgb(163 48 28 / 0.1);
	}

	.row.chosen {
		border-color: var(--ink-danger);
		background: rgb(163 48 28 / 0.14);
	}

	@keyframes invite {
		50% {
			border-color: rgb(163 48 28 / 0.95);
		}
	}

	.row b,
	.scar b {
		font-size: 1rem;
	}

	.text {
		font-size: 0.86rem;
		line-height: 1.3;
	}

	.struck {
		text-decoration: line-through;
		text-decoration-color: var(--ink-danger);
	}

	.incoming {
		color: var(--ink-danger);
	}

	.glyph {
		display: inline-flex;
		width: 0.85rem;
		height: 0.85rem;
		margin-right: 0.2rem;
		vertical-align: -0.12em;
	}

	.scars {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-content: start;
		gap: 0.5rem;
		padding: 0.2rem 0.3rem 0.6rem 0.2rem;
	}

	.scar {
		padding: 0.4rem 0.6rem 0.45rem;
	}

	.scar .name {
		display: flex;
		align-items: center;
		gap: 0.1rem;
	}

	.scar b {
		font-size: 0.92rem;
	}

	.scar .text {
		font-size: 0.8rem;
	}

	.scar {
		background: var(--document);
		box-shadow: 0 0.3rem 0.9rem rgb(0 0 0 / 0.35);
		color: var(--slip-ink);
		cursor: pointer;
		transition:
			translate 150ms ease,
			box-shadow 150ms ease;
	}

	.scar .glyph {
		color: var(--ink-danger);
	}

	.scar:not(:disabled):hover {
		translate: 0 -2px;
		box-shadow: 0 0.6rem 1.3rem rgb(0 0 0 / 0.45);
	}

	.scar.chosen {
		border-color: var(--ink-danger);
		box-shadow:
			0 0 0 3px rgb(163 48 28 / 0.35),
			0 0.6rem 1.3rem rgb(0 0 0 / 0.45);
	}

	.scar:disabled:not(.chosen) {
		opacity: 0.5;
	}

	footer {
		display: flex;
		justify-content: flex-end;
	}

	footer .primary {
		padding: 0.6rem 1.2rem;
		border: 1px solid var(--warn);
		border-radius: 3px;
		background: var(--warn);
		color: #1c140a;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	footer .primary:disabled {
		border-color: var(--line);
		background: none;
		color: var(--muted);
		cursor: default;
	}
</style>
