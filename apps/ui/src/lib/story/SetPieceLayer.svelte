<script lang="ts">
	import type { CardId, CityId, InfectionCard as InfectionCardData, PlayerCard as PlayerCardData } from '@repo/game';
	import { onDestroy, onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly, scale } from 'svelte/transition';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';
	import PlayerCard from '#lib/hud/PlayerCard.svelte';
	import {
		sfxCardFlip,
		sfxCityDestroyed,
		sfxCubeDrop,
		sfxEpidemic,
		sfxExposure,
		sfxInoculationMotif,
		sfxTapeSlap,
		sfxUtopiaCorrupt,
		sfxVialClink,
	} from '#lib/audio/sfx.ts';
	import type { SetPieceId } from './script.ts';

	type Props = {
		piece: SetPieceId;
		delivered?: boolean;
		compact?: boolean;
		oncomplete?: () => void;
	};

	let { piece, delivered = true, compact = false, oncomplete }: Props = $props();

	const EPIDEMIC_CARDS: PlayerCardData[] = Array.from({ length: 5 }, (_, i) => ({
		id: `setpiece-ep-${i}` as CardId,
		kind: 'epidemic',
	}));

	const UTOPIA_CARDS: InfectionCardData[] = Array.from({ length: 8 }, (_, i) => ({
		id: `setpiece-utopia-${i}` as CardId,
		kind: 'city',
		city: 'utopia' as CityId,
		improvement: null,
	}));

	const FRANKFURT_PLAYER: PlayerCardData = {
		id: 'setpiece-frankfurt-p' as CardId,
		kind: 'city',
		city: 'frankfurt' as CityId,
		search: [],
		companion: null,
		improvement: null,
	};

	const FRANKFURT_INFECT: InfectionCardData = {
		id: 'setpiece-frankfurt-i' as CardId,
		kind: 'city',
		city: 'frankfurt' as CityId,
		improvement: null,
	};

	const HOLLOW_GATHER: InfectionCardData = {
		id: 'setpiece-gather' as CardId,
		kind: 'gather',
	};

	const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	let phase = $state(0);
	/** For `wearingOff`: how many of the 5 Epidemic cards have had the tape slapped onto Step 2. */
	let tapedCount = $state(0);
	/** For `wearingOff`: true while the 5 modified cards sweep back into the Player deck. */
	let returning = $state(false);
	/** For `utopiaHell`: shifts from deceptive golden "Utopia" to crimson "Hell on Earth". */
	let corrupted = $state(false);
	/** For `selfInfect`: number of glowing amber PEARL vials revealed (0..4). */
	let vials = $state(0);
	let destroyed = false;
	let runToken = 0;

	const wait = (ms: number) =>
		new Promise<boolean>(resolve => {
			const token = runToken;
			setTimeout(() => resolve(!destroyed && runToken === token), still ? Math.min(ms, 80) : ms);
		});

	async function runChoreography(kind: SetPieceId) {
		const token = ++runToken;
		phase = 0;
		tapedCount = 0;
		returning = false;
		corrupted = false;
		vials = 0;

		if (kind === 'wearingOff') {
			// 1. Safe inoculation motif breaks, 5 Epidemic cards pull out of the Player deck & fan out
			sfxInoculationMotif(true);
			phase = 1;
			if (!(await wait(650)) || runToken !== token) return;
			// 2. One by one, crooked masking-tape stickers slap onto Step 2 ("2-It's wearing off")
			for (let i = 1; i <= 5; i++) {
				sfxTapeSlap(i - 3);
				tapedCount = i;
				if (!(await wait(520)) || runToken !== token) return;
			}
			// 3. Hold so players see all 5 vandalized cards clearly, then sweep back into the Player deck
			if (!(await wait(1150)) || runToken !== token) return;
			sfxCardFlip();
			returning = true;
			if (!(await wait(800)) || runToken !== token) return;
			phase = 2;
			oncomplete?.();
			return;
		}

		if (kind === 'epidemicsArrive') {
			sfxEpidemic('draw');
			phase = 1;
			if (!(await wait(1200)) || runToken !== token) return;
			phase = 2;
			oncomplete?.();
			return;
		}

		if (kind === 'frankfurtDestroyed') {
			phase = 1;
			if (!(await wait(450)) || runToken !== token) return;
			sfxCityDestroyed();
			phase = 2;
			oncomplete?.();
			return;
		}

		if (kind === 'utopiaHell') {
			sfxUtopiaCorrupt();
			phase = 1;
			if (!(await wait(950)) || runToken !== token) return;
			corrupted = true;
			sfxCubeDrop('plague');
			if (!(await wait(900)) || runToken !== token) return;
			phase = 2;
			oncomplete?.();
			return;
		}

		if (kind === 'selfInfect') {
			phase = 1;
			for (let i = 1; i <= 4; i++) {
				vials = i;
				sfxVialClink(i);
				if (!(await wait(340)) || runToken !== token) return;
			}
			if (!(await wait(400)) || runToken !== token) return;
			sfxExposure('scar');
			phase = 2;
			oncomplete?.();
			return;
		}

		if (kind === 'ghostHaven') {
			sfxInoculationMotif(false);
			phase = 1;
			if (!(await wait(900)) || runToken !== token) return;
			phase = 2;
			oncomplete?.();
			return;
		}

		if (kind === 'hollowMenArrive') {
			phase = 1;
			for (let i = 0; i < 3; i++) {
				sfxCubeDrop('hollow');
				if (!(await wait(260)) || runToken !== token) return;
			}
			phase = 2;
			oncomplete?.();
			return;
		}

		phase = 1;
		if (!(await wait(700)) || runToken !== token) return;
		phase = 2;
		oncomplete?.();
	}

	onMount(() => {
		void runChoreography(piece);
	});

	$effect(() => {
		void piece;
		void runChoreography(piece);
	});

	onDestroy(() => {
		destroyed = true;
		runToken++;
	});
</script>

<div class="setpiece {piece}" class:compact class:corrupted data-testid="setpiece-{piece}">
	{#if piece === 'wearingOff'}
		<div class="stage-frame wearing-off-stage">
			<div class="alert-strip" in:fade={{ duration: 280 }}>
				<span class="dot"></span>
				<strong>INOCULATION FAILING · STEP 2 OVERWRITTEN</strong>
				<span class="sub">
					{#if returning}
						Returning 5 modified Epidemic cards to Player deck…
					{:else if tapedCount < 5}
						Applying “2-It’s wearing off” ({tapedCount} / 5)
					{:else}
						Every Epidemic now pulls from Package 6
					{/if}
				</span>
			</div>

			<div class="epidemic-fan" class:returning>
				{#each EPIDEMIC_CARDS as card, i (card.id)}
					{@const stamped = i < tapedCount}
					{@const fresh = i === tapedCount - 1 && !returning}
					<div
						class="fan-slot"
						class:stamped
						class:fresh
						style:--idx={i}
						style:--spread={(i - 2) * 8.5}
						style:--arc={Math.abs(i - 2) * 14}
						in:fly={{ y: -90, duration: 420, delay: i * 70, easing: cubicOut }}
					>
						<PlayerCard {card} wearingOff={stamped} />
						{#if stamped}
							<span class="tape-flash" aria-hidden="true"></span>
						{/if}
					</div>
				{/each}
			</div>

			{#if phase >= 2}
				<button
					type="button"
					class="replay-chip"
					onclick={() => runChoreography('wearingOff')}
					data-testid="replay-wearing-off"
				>
					Replay sticker swap
				</button>
			{/if}
		</div>
	{:else if piece === 'epidemicsArrive'}
		<div class="stage-frame">
			<div class="alert-strip danger" in:fade={{ duration: 240 }}>
				<strong>EPIDEMICS ENTER THE PLAYER DECK</strong>
				<span class="sub">5 Epidemic cards added · Infection Rate now escalates</span>
			</div>
			<div class="epidemic-fan tight">
				{#each EPIDEMIC_CARDS as card, i (card.id)}
					<div
						class="fan-slot"
						style:--idx={i}
						style:--spread={(i - 2) * 7}
						style:--arc={Math.abs(i - 2) * 10}
						in:fly={{ y: -110, duration: 480, delay: i * 95, easing: cubicOut }}
					>
						<PlayerCard {card} wearingOff={false} />
					</div>
				{/each}
			</div>
		</div>
	{:else if piece === 'betrayal'}
		<div class="stage-frame betrayal-stage" in:fade={{ duration: 400 }}>
			<div class="summit-seal">
				<span class="kicker">ARCHIVE · NOVEMBER 5, YEAR 70</span>
				<strong>“THE LIST IS MADE.”</strong>
				<p>Haven leadership marched east to Utopia—and left the rest of us behind.</p>
			</div>
		</div>
	{:else if piece === 'frankfurtDestroyed'}
		<div class="stage-frame destroy-stage">
			<div class="shred-pair" class:burned={phase >= 2}>
				<div class="card-victim"><PlayerCard card={FRANKFURT_PLAYER} /></div>
				<div class="card-victim inf"><InfectionCard card={FRANKFURT_INFECT} /></div>
				{#if phase >= 2}
					<div class="stamp-obliterated" in:scale={{ start: 2.1, duration: 320, easing: cubicOut }}>
						<strong>FRANKFURT DESTROYED</strong>
						<span>ERASED FROM THE GRID</span>
					</div>
				{/if}
			</div>
		</div>
	{:else if piece === 'forsakenCities'}
		<div class="stage-frame forsaken-stage" in:fade={{ duration: 360 }}>
			<div class="pop-drop">
				<span class="pop-zero">0</span>
				<div class="pop-meta">
					<strong>FORSAKEN CITY</strong>
					<span>Lights out · Immediately infested · Drive / Ferry only</span>
				</div>
			</div>
		</div>
	{:else if piece === 'ghostHaven'}
		<div class="stage-frame haven-stage" in:fade={{ duration: 420 }}>
			<div class="haven-relics">
				<div class="cube-cluster" aria-label="15 supply cubes">
					{#each { length: 15 } as _, i (i)}
						<i style:--d="{i * 35}ms"></i>
					{/each}
				</div>
				<div class="haven-caption">
					<strong>PACKAGE 6 UNSEALED</strong>
					<span>+15 Supply Cubes · Inoculation Storage · Portable Antiviral Lab</span>
				</div>
			</div>
		</div>
	{:else if piece === 'hollowMenArrive'}
		<div class="stage-frame hollow-stage">
			<div class="hollow-row">
				{#each [0, 1, 2] as idx (idx)}
					<div class="hollow-card" style:--rot="{(idx - 1) * 7}deg" in:fly={{ y: 70, duration: 420, delay: idx * 140 }}>
						<InfectionCard card={HOLLOW_GATHER} />
					</div>
				{/each}
			</div>
			<div class="alert-strip danger">
				<strong>THE HOLLOW MEN ENTER THE BOARD</strong>
				<span class="sub">Gather cards shuffled in · Leaving their cities exposes you</span>
			</div>
		</div>
	{:else if piece === 'shanghaiMassacre'}
		<div class="stage-frame shanghai-stage" in:fade={{ duration: 500 }}>
			<div class="memorial-plate">
				<span class="kicker">OUTSIDE THE WALLS OF UTOPIA</span>
				<strong>NO SURVIVORS</strong>
				<p>“Utopia accepts no outsiders. Utopia leaves no survivors.”</p>
			</div>
		</div>
	{:else if piece === 'fadedTruth'}
		<div class="stage-frame faded-stage" in:fade={{ duration: 420 }}>
			<div class="truth-plate">
				<span class="kicker">DOOR 17 · AN EXCHANGE OF SECRETS</span>
				<strong>WE ARE THE FADED</strong>
				<p>Quarantined after COdA. Seventy years on the sea. Now the Hollow Men bring us inside Utopia’s walls.</p>
			</div>
		</div>
	{:else if piece === 'utopiaHell'}
		<div class="stage-frame utopia-stage">
			<div class="utopia-banner" class:corrupted>
				<span class="kicker">{corrupted ? 'PACKAGE 8 · TRUTH EXPOSED' : 'ACCESSING UTOPIA'}</span>
				<strong>{corrupted ? 'THIS IS HELL ON EARTH' : 'UTOPIA'}</strong>
			</div>
			{#if corrupted}
				<div class="utopia-cascade" in:fade={{ duration: 300 }}>
					{#each UTOPIA_CARDS as card, i (card.id)}
						<div class="u-card" style:--u={i} in:fly={{ y: -60, x: (i - 3.5) * 18, duration: 380, delay: i * 65 }}>
							<InfectionCard {card} />
						</div>
					{/each}
				</div>
				<span class="utopia-note"
					>8 Utopia Infection cards flood the discard pile · PEARL Lab revealed at Lake Baikal</span
				>
			{/if}
		</div>
	{:else if piece === 'selfInfect'}
		<div class="stage-frame pearl-stage">
			<div class="vial-rack" aria-label={`${vials} of 4 PEARL sample doses`}>
				{#each [0, 1, 2, 3] as idx (idx)}
					<div class="vial" class:lit={idx < vials}>
						<span class="cap"></span>
						<span class="glass"><i class="liquid"></i></span>
						<b>DOSE {idx + 1}</b>
					</div>
				{/each}
			</div>
			{#if phase >= 2}
				<div class="carrier-stamp" in:scale={{ start: 1.45, duration: 360, easing: cubicOut }}>
					<strong>CARRIER · 2-SLOT SCAR</strong>
					<span>1000× Lethal Dose · Drive/Ferry only · Discard matching color to enter · Dies at Game End</span>
				</div>
			{/if}
		</div>
	{:else if piece === 'finalReckoning'}
		<div class="stage-frame reckoning-stage" class:delivered in:fade={{ duration: 500 }}>
			<div class="reckoning-plate">
				<span class="kicker">YEAR 71 OF THE FALL · CAMPAIGN COMPLETE</span>
				<strong>{delivered ? 'WE ARE HERE TO STAY' : 'PLEASE REMEMBER US'}</strong>
			</div>
		</div>
	{/if}
</div>

<style>
	.setpiece {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		pointer-events: auto;
	}

	.stage-frame {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.8rem;
		max-width: 100%;
	}

	.alert-strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.4rem 0.75rem;
		padding: 0.38rem 0.95rem;
		border: 1px solid rgb(232 198 122 / 0.55);
		border-radius: 999px;
		background: rgb(26 14 10 / 0.9);
		box-shadow: 0 0.6rem 1.8rem rgb(0 0 0 / 0.55);
		color: #f6e7c6;
		font-size: 0.78rem;
		letter-spacing: 0.06em;
	}

	.alert-strip.danger {
		border-color: rgb(220 72 52 / 0.75);
		background: rgb(38 11 10 / 0.92);
	}

	.alert-strip strong {
		color: #ff9c86;
		font-weight: 800;
	}

	.alert-strip .sub {
		color: #e4d5b8;
		letter-spacing: 0.02em;
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: #e5513c;
		box-shadow: 0 0 8px #e5513c;
	}

	/* === Signature Set-Piece: 5 Epidemic Cards Fanning Out & Getting Taped === */
	.epidemic-fan {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.65rem 0.5rem 0.35rem;
		transition:
			transform 680ms cubic-bezier(0.45, 0, 0.2, 1),
			opacity 680ms ease;
	}

	.epidemic-fan.returning {
		transform: translateY(-7.5rem) scale(0.32);
		opacity: 0.15;
	}

	.fan-slot {
		--card-size: 0.84rem;
		position: relative;
		margin: 0 -0.55rem;
		transform: translateY(calc(var(--arc) * 1px)) rotate(calc(var(--spread) * 1deg));
		transition:
			transform 320ms cubic-bezier(0.2, 1.35, 0.4, 1),
			filter 320ms ease;
	}

	.compact .fan-slot {
		--card-size: 0.68rem;
		margin: 0 -0.9rem;
	}

	.fan-slot.stamped {
		z-index: 2;
	}

	.fan-slot.fresh {
		z-index: 4;
		transform: translateY(calc(var(--arc) * 1px - 12px)) rotate(calc(var(--spread) * 1deg)) scale(1.09);
		filter: drop-shadow(0 0 1.2rem rgb(224 72 48 / 0.7));
	}

	.tape-flash {
		position: absolute;
		inset: 28% -4% 28% -4%;
		border-radius: 4px;
		background: radial-gradient(ellipse at center, rgb(255 215 140 / 0.72), transparent 72%);
		pointer-events: none;
		animation: slap-flash 460ms ease-out forwards;
	}

	@keyframes slap-flash {
		from {
			opacity: 1;
			transform: scale(0.7);
		}
		to {
			opacity: 0;
			transform: scale(1.35);
		}
	}

	.replay-chip {
		padding: 0.25rem 0.8rem;
		border: 1px solid rgb(231 220 198 / 0.45);
		border-radius: 999px;
		background: rgb(24 18 14 / 0.84);
		color: #f3e4c2;
		font: inherit;
		font-size: 0.76rem;
		cursor: pointer;
	}

	.replay-chip:hover {
		border-color: #f3e4c2;
	}

	/* === Betrayal / Shanghai / Faded / Reckoning Plates === */
	.summit-seal,
	.memorial-plate,
	.truth-plate,
	.reckoning-plate {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.28rem;
		max-width: 28rem;
		padding: 0.85rem 1.45rem;
		border: 1px solid rgb(227 178 60 / 0.42);
		border-radius: 4px;
		background: linear-gradient(175deg, rgb(22 18 15 / 0.92), rgb(14 11 9 / 0.95));
		box-shadow: 0 1.1rem 2.8rem rgb(0 0 0 / 0.65);
		text-align: center;
	}

	.memorial-plate {
		border-color: rgb(196 58 42 / 0.65);
	}

	.reckoning-stage.delivered .reckoning-plate {
		border-color: rgb(226 195 106 / 0.75);
		background: linear-gradient(170deg, rgb(26 32 22 / 0.94), rgb(16 14 10 / 0.96));
	}

	.kicker {
		color: #c8b282;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.summit-seal strong,
	.memorial-plate strong,
	.truth-plate strong,
	.reckoning-plate strong {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 400;
		letter-spacing: 0.04em;
		color: #f7e9cc;
		line-height: 1.05;
	}

	.memorial-plate strong {
		color: #f07664;
	}

	.summit-seal p,
	.memorial-plate p,
	.truth-plate p {
		margin: 0;
		color: #d6c7ac;
		font-size: 0.86rem;
		line-height: 1.38;
	}

	/* === Frankfurt Destroyed === */
	.shred-pair {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.5rem;
	}

	.card-victim {
		--card-size: 0.82rem;
		transition:
			filter 500ms ease,
			opacity 500ms ease,
			transform 500ms ease;
	}

	.shred-pair.burned .card-victim {
		filter: grayscale(1) contrast(1.4) brightness(0.45);
		opacity: 0.58;
		transform: rotate(-4deg) scale(0.95);
	}

	.shred-pair.burned .card-victim.inf {
		transform: rotate(5deg) scale(0.95);
	}

	.stamp-obliterated {
		position: absolute;
		inset: auto;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%) rotate(-7deg);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.45rem 1.2rem;
		border: 3px double #e04a38;
		background: rgb(28 9 8 / 0.92);
		color: #f46d58;
		box-shadow: 0 0.8rem 2rem rgb(0 0 0 / 0.75);
		white-space: nowrap;
	}

	.stamp-obliterated strong {
		font-family: var(--font-display);
		font-size: 1.45rem;
		font-weight: 400;
		letter-spacing: 0.06em;
	}

	.stamp-obliterated span {
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		color: #f3d7c8;
	}

	/* === Forsaken City === */
	.pop-drop {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.65rem 1.2rem;
		border: 1.5px solid rgb(208 66 48 / 0.7);
		border-radius: 6px;
		background: rgb(22 11 10 / 0.92);
		box-shadow: 0 1rem 2.4rem rgb(0 0 0 / 0.65);
	}

	.pop-zero {
		display: grid;
		place-items: center;
		width: 2.8rem;
		height: 2.8rem;
		border-radius: 50%;
		border: 2px solid #d44d3b;
		background: #140808;
		color: #f26c5a;
		font-family: var(--font-display);
		font-size: 1.8rem;
	}

	.pop-meta {
		display: flex;
		flex-direction: column;
		gap: 0.12rem;
	}

	.pop-meta strong {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 400;
		color: #f7c7bc;
	}

	.pop-meta span {
		font-size: 0.78rem;
		color: #cbb8a8;
	}

	/* === Package 6 Ghost Haven === */
	.haven-relics {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		padding: 0.75rem 1.2rem;
		border: 1px solid rgb(138 196 196 / 0.45);
		border-radius: 6px;
		background: rgb(14 24 28 / 0.9);
		box-shadow: 0 0.9rem 2.2rem rgb(0 0 0 / 0.55);
	}

	.cube-cluster {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.32rem;
		max-width: 14rem;
	}

	.cube-cluster i {
		width: 0.95rem;
		height: 0.95rem;
		background: conic-gradient(from 30deg at 50% 35%, #b1a38a 0deg 120deg, #e0d5bb 120deg 240deg, #fff5dc 240deg);
		clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
		animation: cube-pop 380ms var(--d, 0ms) cubic-bezier(0.2, 1.4, 0.4, 1) both;
	}

	@keyframes cube-pop {
		from {
			opacity: 0;
			transform: translateY(-10px) scale(0.4);
		}
	}

	.haven-caption {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.12rem;
		text-align: center;
	}

	.haven-caption strong {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 400;
		color: #bce4e0;
	}

	.haven-caption span {
		font-size: 0.78rem;
		color: #d6e4e2;
	}

	/* === Hollow Men Arrive === */
	.hollow-row {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.hollow-card {
		--card-size: 0.74rem;
		margin: 0 -0.65rem;
		transform: rotate(var(--rot, 0deg));
		filter: drop-shadow(0 0.6rem 1.4rem rgb(0 0 0 / 0.7));
	}

	/* === Utopia Hope → Hell on Earth === */
	.utopia-banner {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem 1.6rem;
		border: 1.5px solid #e6cb7a;
		border-radius: 4px;
		background: linear-gradient(170deg, rgb(42 36 18 / 0.92), rgb(22 18 10 / 0.94));
		transition:
			border-color 600ms ease,
			background 600ms ease;
	}

	.utopia-banner strong {
		font-family: var(--font-display);
		font-size: 1.9rem;
		font-weight: 400;
		letter-spacing: 0.08em;
		color: #fae6a8;
		transition: color 600ms ease;
	}

	.utopia-banner.corrupted {
		border-color: #d44432;
		background: linear-gradient(170deg, rgb(48 11 10 / 0.94), rgb(20 7 7 / 0.96));
	}

	.utopia-banner.corrupted strong {
		color: #ff7e6b;
	}

	.utopia-cascade {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem 0;
	}

	.u-card {
		--card-size: 0.62rem;
		margin: 0 -1.55rem;
		transform: rotate(calc((var(--u) - 3.5) * 4deg));
		filter: drop-shadow(0 0.5rem 1rem rgb(0 0 0 / 0.65));
	}

	.utopia-note {
		padding: 0.22rem 0.75rem;
		border-radius: 999px;
		background: rgb(22 10 10 / 0.85);
		color: #f3c4b8;
		font-size: 0.76rem;
	}

	/* === PEARL Self-Infect Vials === */
	.vial-rack {
		display: flex;
		align-items: flex-end;
		gap: 0.95rem;
		padding: 0.65rem 1.2rem;
		border-radius: 6px;
		background: rgb(14 18 22 / 0.88);
		border: 1px solid rgb(226 178 72 / 0.35);
	}

	.vial {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		opacity: 0.22;
		transform: translateY(8px);
		transition:
			opacity 360ms ease,
			transform 360ms cubic-bezier(0.2, 1.3, 0.4, 1);
	}

	.vial.lit {
		opacity: 1;
		transform: translateY(0);
	}

	.vial .cap {
		width: 1rem;
		height: 0.38rem;
		border-radius: 2px 2px 0 0;
		background: linear-gradient(90deg, #7d6234, #c9a45c, #7d6234);
	}

	.vial .glass {
		position: relative;
		width: 1.35rem;
		height: 3.1rem;
		border: 1.5px solid rgb(240 232 212 / 0.55);
		border-radius: 0.25rem 0.25rem 0.65rem 0.65rem;
		background: rgb(16 20 24 / 0.7);
		overflow: hidden;
	}

	.vial .liquid {
		position: absolute;
		inset: 28% 2px 2px 2px;
		border-radius: 0.1rem 0.1rem 0.5rem 0.5rem;
		background: linear-gradient(180deg, #ffe078, #e68a1c);
		box-shadow: 0 0 12px rgb(242 162 42 / 0.85);
	}

	.vial b {
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		color: #d8c7a2;
	}

	.carrier-stamp {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.16rem;
		max-width: 27rem;
		padding: 0.55rem 1.1rem;
		border: 1.5px solid #cf3d2e;
		border-radius: 4px;
		background: rgb(32 10 9 / 0.94);
		text-align: center;
		box-shadow: 0 0.8rem 2rem rgb(0 0 0 / 0.7);
	}

	.carrier-stamp strong {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 400;
		letter-spacing: 0.06em;
		color: #ff8e7b;
	}

	.carrier-stamp span {
		font-size: 0.76rem;
		color: #ead3c8;
	}
</style>
