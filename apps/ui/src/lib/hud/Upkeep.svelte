<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { cityDef, reject, SEAT_IDS, tablePlayers } from '@repo/game';
	import type { CharacterId, Command, PlayerId, PublicState } from '@repo/game';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { cityName, SEAT_COLORS } from './labels.svelte.ts';
	import { REASON } from './populationShow.svelte.ts';
	import Portrait from './Portrait.svelte';
	import { purchaseName, purchaseTarget, shopOf } from './upkeepShop.ts';
	import type { SectionId, ShopTarget } from './upkeepShop.ts';
	import { keep } from './viewState.ts';

	type Props = {
		snap: PublicState;
		send: (command: Command) => void;
		player: PlayerId;
		spectator: boolean;
		/** Stepped aside to a side column, so the board can be read. */
		aside: boolean;
		/** How many population changes the show has played, while it plays. */
		showing: number | null;
		onaside: (aside: boolean) => void;
		onskip: () => void;
	};

	let { snap, send, player, spectator, aside, showing, onaside, onskip }: Props = $props();

	const world = $derived(snap.world);
	const campaign = $derived(world.campaign);
	const game = $derived(world.game!);
	const upkeep = $derived(game.upkeep!);
	const outcome = $derived(game.outcome);

	const shop = $derived(shopOf(world));
	let picked = $state<SectionId | null>(null);
	keep(
		'upkeep',
		() => ({ picked }),
		saved => (picked = saved.picked),
	);
	const buyable = (id: SectionId) =>
		shop.find(section => section.id === id)?.items.filter(item => item.targets.length).length ?? 0;
	const section = $derived(
		shop.find(entry => entry.id === picked) ?? shop.find(entry => buyable(entry.id) > 0) ?? shop[0] ?? null,
	);

	const spent = $derived(upkeep.bought.reduce((sum, entry) => sum + entry.units, 0));
	const freeSpent = $derived(upkeep.bought.reduce((sum, entry) => sum + entry.free, 0));
	const players = $derived(tablePlayers(world.table));
	const seated = $derived(players.length === 0 || players.includes(player));
	const canSpend = $derived(!spectator && seated);
	const myDone = $derived(upkeep.done.includes(player));
	const waiting = $derived(
		players
			.filter(who => !upkeep.done.includes(who))
			.map(who => world.table.seats.find(entry => entry.player === who)!.name),
	);
	const seatColor = (who: PlayerId) =>
		SEAT_COLORS[SEAT_IDS.indexOf(world.table.seats.find(entry => entry.player === who)!.seat)]!;

	/** A character's colour is the seat they played this game, else a neutral ink. */
	function characterColor(id: CharacterId) {
		const seat = game.seats.find(entry => game.players[entry]?.character === id);
		return seat ? SEAT_COLORS[game.seats.indexOf(seat)]! : '#5a4e40';
	}

	function buy(target: ShopTarget) {
		send({ type: 'PURCHASE', purchase: target.purchase });
	}

	function vote() {
		send({ type: 'FINISH_UPKEEP', player, done: !myDone });
	}
</script>

{#snippet pips(count: number, kind = '')}
	<span class="pips {kind}" role="img" aria-label={`${count} production unit${count === 1 ? '' : 's'}`}>
		{#each { length: count }, index (index)}<i></i>{/each}
	</span>
{/snippet}

<div
	class="upkeep"
	class:aside
	data-testid="upkeep"
	{@attach feedback('Upkeep', () => ({
		units: upkeep.units,
		bought: upkeep.bought.length,
		aside,
		section: section?.id,
	}))}
>
	<header>
		<div class="title">
			<h1 class:won={outcome?.won}>{outcome?.won ? 'Victory' : 'Defeat'}</h1>
			<p>{outcome?.reason}</p>
		</div>
		<div class="budget" {@attach feedback('Production units', () => ({ left: upkeep.units, spent }))}>
			<span class="pips big" role="img" aria-label={`${upkeep.units} of ${upkeep.units + spent} production units left`}>
				{#each { length: upkeep.units + spent }, index (index)}<i class:spent={index >= upkeep.units}></i>{/each}
			</span>
			<small>
				<b>{upkeep.units}</b> of {upkeep.units + spent} production units left{#if campaign.freeAbilityUnits + freeSpent}
					· <b>{campaign.freeAbilityUnits}</b> free for abilities{/if}
			</small>
		</div>
		<button class="aside-toggle" onclick={() => onaside(!aside)} data-testid="upkeep-aside" disabled={showing !== null}>
			{#if aside}
				Back to spending
			{:else}
				<svg viewBox="0 0 16 16" aria-hidden="true"
					><path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5Z" /><circle cx="8" cy="8" r="2.2" /></svg
				> Show board
			{/if}
		</button>
	</header>

	<section
		class="population"
		aria-label="Population"
		{@attach feedback('Population changes', () => upkeep.populationChanges)}
	>
		<h2>
			Population
			{#if showing !== null}<button class="link" onclick={onskip}>Skip</button>{/if}
		</h2>
		<ol
			class="changes"
			{@attach node => {
				if (showing === null) node.scrollTop = 0;
			}}
		>
			{#each upkeep.populationChanges as change, index (change.city)}
				{@const hidden = showing !== null && index >= showing}
				{@const now = showing !== null && index === showing - 1}
				<li
					class:up={change.delta > 0}
					class:hidden
					class:now
					{@attach node => {
						if (now) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
					}}
				>
					<b>{cityName(change.city)}</b>
					<span class="delta">{change.delta > 0 ? '+' : '−'}{Math.abs(change.delta)}</span>
					<small>{REASON[change.reason]}</small>
				</li>
			{:else}
				<li class="none">No city changed</li>
			{/each}
		</ol>
	</section>

	{#if !aside && section}
		<div class="shop">
			<div class="sections" role="tablist" aria-label="Ways to spend">
				{#each shop as entry (entry.id)}
					{@const open = buyable(entry.id)}
					<button
						role="tab"
						aria-selected={entry.id === section.id}
						class:on={entry.id === section.id}
						class:empty={open === 0}
						onclick={() => (picked = entry.id)}
						data-section={entry.id}
					>
						<b>{entry.title}</b>
						<small>{open === 0 ? 'Nothing now' : entry.items.length > 1 ? `${open} on offer` : 'Open'}</small>
					</button>
				{/each}
			</div>
			<div class="items" role="tabpanel" aria-label={section.title} {@attach feedback(section.title, () => section)}>
				<p class="blurb">{section.blurb}</p>
				<div class="grid">
					{#each section.items as item (item.key)}
						<article class="item" class:closed={item.targets.length === 0} data-item={item.key}>
							<div class="head">
								<b>{item.name}</b>
								{#if item.left !== null && item.left > 1}<small class="left">×{item.left}</small>{/if}
								{@render pips(item.cost)}
							</div>
							<p class="text">{item.text}</p>
							{#if item.targets.length}
								<div class="targets">
									{#each item.targets as target (target.key)}
										<button disabled={!canSpend} onclick={() => buy(target)} data-target={target.label}>
											{#if target.character}
												{@const character = campaign.characters[target.character]!}
												<span class="face"
													><Portrait
														portrait={character.portrait}
														color={characterColor(character.id)}
														job={character.job}
													/></span
												>
											{:else if target.city}
												<i class="dot" style:background={CITY_COLOR[cityDef(target.city).color ?? 'haven']}></i>
											{/if}
											{target.label}
											{#if target.purchase.t === 'population'}
												{@const now = campaign.locations[target.purchase.city]!.population}
												<small>{now} → {now + 1}</small>
											{/if}
										</button>
									{/each}
								</div>
							{:else}
								<small class="reason">{item.reason}</small>
							{/if}
						</article>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<footer>
		<section class="cart" aria-label="Allocated" {@attach feedback('Allocated units', () => upkeep.bought)}>
			<h2>Allocated</h2>
			{#if upkeep.bought.length}
				<ol>
					{#each upkeep.bought as entry, index (JSON.stringify(entry.purchase) + index)}
						{@const blocked = reject(world, 'upkeep', { type: 'REFUND', index })}
						<li animate:flip={{ duration: 200 }} in:fly={{ y: 12, duration: 220 }}>
							{@render pips(entry.units)}
							{#if entry.free}{@render pips(entry.free, 'free')}{/if}
							<span class="what"><b>{purchaseName(entry.purchase)}</b> {purchaseTarget(world, entry.purchase)}</span>
							<button
								class="undo"
								disabled={!canSpend || blocked !== null}
								aria-label={blocked ?? `Give back ${purchaseName(entry.purchase)}`}
								onclick={() => send({ type: 'REFUND', index })}
								data-testid="refund">Undo</button
							>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="none">Nothing yet. Units left unspent are lost once everyone is done.</p>
			{/if}
		</section>
		<div class="vote">
			<button
				class="done"
				class:voted={myDone}
				aria-pressed={myDone}
				disabled={spectator || !seated}
				onclick={vote}
				data-testid="finish-upkeep"
			>
				<span>{myDone ? 'Done ✓' : 'Done'}{players.length ? ` (${upkeep.done.length}/${players.length})` : ''}</span>
				{#if players.length}
					<span class="seats" role="img" aria-label={`${upkeep.done.length} of ${players.length} done`}>
						{#each players as who (who)}<i class:voted={upkeep.done.includes(who)} style:--seat={seatColor(who)}
							></i>{/each}
					</span>
				{/if}
			</button>
			<small>
				{#if waiting.length && upkeep.done.length}
					Waiting for {waiting.join(', ')}
				{:else if upkeep.units > 0}
					{upkeep.units} unspent unit{upkeep.units === 1 ? '' : 's'} will be lost
				{:else}
					Every unit is allocated
				{/if}
			</small>
		</div>
	</footer>
</div>

<style>
	/* The game-end requisition: the result, what each way to spend can buy, and the allocations, which stay undoable until the table agrees. */
	.upkeep {
		--unit: #e8892b;
		--unit-free: #6a9fd0;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		width: min(68rem, calc(100vw - 4rem));
		height: min(46rem, calc(100vh - 7rem));
		padding: 1.2rem 1.4rem;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--panel);
		backdrop-filter: blur(12px);
		box-shadow: 0 2rem 5rem rgb(0 0 0 / 0.6);
		color: var(--ink);
		animation: laid 420ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
	}

	@keyframes laid {
		from {
			opacity: 0;
			translate: 0 1.5rem;
		}
	}

	.upkeep.aside {
		gap: 0.7rem;
		width: 19rem;
		height: auto;
		max-height: 100%;
		padding: 0.9rem 1rem;
		animation: docked 320ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
	}

	@keyframes docked {
		from {
			opacity: 0;
			translate: 2rem 0;
		}
	}

	header {
		display: flex;
		flex: none;
		align-items: center;
		gap: 1.4rem;
		padding-bottom: 0.8rem;
		border-bottom: 1px solid var(--line);
	}

	.aside header {
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	h1 {
		margin: 0;
		color: var(--danger);
		font-family: var(--font-display);
		font-size: 2.3rem;
		font-weight: 400;
		line-height: 1;
	}

	h1.won {
		color: var(--good);
	}

	.aside h1 {
		font-size: 1.6rem;
	}

	.title p {
		margin: 0.25rem 0 0;
		color: var(--muted);
		font-size: 0.9rem;
	}

	.budget {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-left: auto;
	}

	.aside .budget {
		order: 3;
		width: 100%;
		margin-left: 0;
	}

	.budget small {
		color: var(--muted);
		font-size: 0.82rem;
	}

	.budget b {
		color: var(--unit);
	}

	.aside-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.8rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: 0.88rem;
		cursor: pointer;
	}

	.aside .aside-toggle {
		margin-left: auto;
	}

	.aside-toggle:hover:not(:disabled) {
		background: var(--wash);
	}

	.aside-toggle:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.aside-toggle svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
	}

	/* A production unit is an orange pip, as on the box's tokens. A spent one is an empty socket. */
	.pips {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.2rem;
		align-items: center;
	}

	.pips i {
		width: 0.62rem;
		height: 0.62rem;
		border-radius: 50%;
		background: var(--unit);
		box-shadow:
			inset 0 -1px 0 rgb(0 0 0 / 0.3),
			0 0 0.3rem rgb(232 137 43 / 0.45);
	}

	.pips.free i {
		background: var(--unit-free);
		box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.3);
	}

	.pips.big {
		gap: 0.3rem;
	}

	.pips.big i {
		width: 1rem;
		height: 1rem;
		transition:
			background 220ms ease,
			box-shadow 220ms ease;
	}

	.pips.big i.spent {
		background: none;
		box-shadow: inset 0 0 0 1.5px rgb(232 137 43 / 0.45);
	}

	h2 {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin: 0 0 0.4rem;
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 400;
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-family: var(--font-ui);
		font-size: 0.8rem;
		text-decoration: underline;
		cursor: pointer;
	}

	.changes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Two rows at most on the sheet, so the shop keeps its height on a small laptop. */
	.upkeep:not(.aside) .changes {
		max-height: 3.9rem;
		overflow: auto;
		scrollbar-width: thin;
	}

	.aside .population {
		display: flex;
		flex: 0 1 auto;
		flex-direction: column;
		min-height: 4rem;
	}

	.aside .changes {
		flex-direction: column;
		flex-wrap: nowrap;
		min-height: 0;
		overflow: auto;
		scrollbar-width: thin;
	}

	.changes li {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
		padding: 0.15rem 0.5rem;
		border-left: 3px solid var(--danger);
		border-radius: 2px;
		background: var(--wash);
		font-size: 0.85rem;
		transition:
			opacity 300ms ease,
			background 300ms ease;
	}

	.changes li.up {
		border-left-color: var(--good);
	}

	.changes .delta {
		color: var(--danger);
		font-weight: 700;
	}

	.changes .up .delta {
		color: var(--good);
	}

	.changes small {
		color: var(--muted);
	}

	.changes li.hidden {
		opacity: 0.25;
	}

	.changes li.now {
		background: rgb(231 220 198 / 0.16);
	}

	.changes li.none {
		border-left-color: var(--line-strong);
		color: var(--muted);
	}

	.shop {
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		gap: 1rem;
		flex: 1 1 0;
		min-height: 0;
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-height: 0;
		overflow: auto;
	}

	.sections button {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.3rem 0.7rem;
		border: 1px solid transparent;
		border-left: 3px solid var(--line-strong);
		border-radius: 3px;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.sections button:hover {
		background: var(--wash);
	}

	.sections button.on {
		border-color: var(--line-strong);
		border-left-color: var(--unit);
		background: rgb(232 137 43 / 0.1);
	}

	.sections button.empty {
		color: var(--muted);
	}

	.sections small {
		color: var(--muted);
		font-size: 0.78rem;
	}

	.items {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		min-height: 0;
		padding: 0.1rem 0.3rem 0.4rem 0.1rem;
		overflow: auto;
		scrollbar-width: thin;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
		gap: 0.55rem;
	}

	.blurb {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.item {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.55rem 0.7rem 0.65rem;
		border-left: 4px solid var(--unit);
		border-radius: 3px;
		background: var(--document);
		box-shadow: 0 0.3rem 0.9rem rgb(0 0 0 / 0.35);
		color: var(--slip-ink);
	}

	.item.closed {
		border-left-color: rgb(42 32 23 / 0.3);
		opacity: 0.6;
	}

	.item .head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.item .head b {
		font-size: 1rem;
	}

	.item .head .pips {
		margin-left: auto;
	}

	.left {
		color: var(--slip-muted);
		font-size: 0.78rem;
	}

	.item .text {
		margin: 0;
		font-size: 0.84rem;
		line-height: 1.3;
	}

	.reason {
		color: var(--slip-muted);
		font-size: 0.8rem;
		font-style: italic;
	}

	.targets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.15rem;
	}

	.targets button {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.5rem;
		border: 1px solid rgb(42 32 23 / 0.3);
		border-radius: 3px;
		background: rgb(255 255 255 / 0.3);
		color: var(--slip-ink);
		font: inherit;
		font-size: 0.82rem;
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease,
			translate 150ms ease;
	}

	.targets button:hover:not(:disabled) {
		translate: 0 -1px;
		border-color: var(--unit);
		background: rgb(232 137 43 / 0.16);
	}

	.targets button:disabled {
		cursor: default;
		opacity: 0.6;
	}

	.targets small {
		color: var(--slip-muted);
	}

	.face {
		position: relative;
		width: 1.4rem;
		height: 1.4rem;
		overflow: hidden;
		border-radius: 2px;
	}

	.dot {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
	}

	footer {
		display: flex;
		align-items: flex-end;
		gap: 1.2rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--line);
	}

	.aside footer {
		flex: 0 0 auto;
		flex-direction: column;
		align-items: stretch;
		gap: 0.7rem;
	}

	.cart {
		flex: 1;
		min-width: 0;
	}

	.cart ol {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		max-height: 5.6rem;
		margin: 0;
		padding: 0;
		overflow: auto;
		list-style: none;
	}

	.aside .cart ol {
		flex-direction: column;
		flex-wrap: nowrap;
		max-height: 12rem;
	}

	.cart li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.2rem 0.25rem 0.2rem 0.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--wash);
		font-size: 0.84rem;
	}

	.cart .what {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cart .what b {
		font-weight: 700;
	}

	.undo {
		padding: 0.1rem 0.45rem;
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.aside .undo {
		margin-left: auto;
	}

	.undo:hover:not(:disabled) {
		border-color: var(--danger);
		color: var(--ink);
	}

	.undo:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.none {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.vote {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.3rem;
	}

	.aside .vote {
		align-items: stretch;
	}

	.vote small {
		color: var(--muted);
		font-size: 0.8rem;
	}

	.done {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.7rem;
		min-width: 12rem;
		padding: 0.6rem 1.2rem;
		border: 1px solid var(--paper);
		border-radius: 3px;
		background: var(--paper);
		color: var(--paper-ink);
		font: inherit;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
	}

	.done:hover:not(:disabled) {
		background: #e9dec5;
	}

	.done.voted {
		border-color: var(--ink-good);
		background: var(--ink-good);
		color: #f3ecdc;
	}

	.done.voted:hover:not(:disabled) {
		background: #335c48;
	}

	.done:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.seats {
		display: flex;
		gap: 0.3rem;
	}

	.seats i {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1.5px currentColor;
		opacity: 0.45;
		transition:
			background 220ms ease,
			opacity 220ms ease;
	}

	.seats i.voted {
		background: var(--seat);
		box-shadow:
			inset 0 0 0 1.5px rgb(255 252 242 / 0.75),
			0 0 0.4rem var(--seat);
		opacity: 1;
	}
</style>
