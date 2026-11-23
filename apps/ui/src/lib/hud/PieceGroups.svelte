<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { Campaign } from '@repo/game';
	import { fly, scale } from 'svelte/transition';
	import LegacyCard from '#lib/cards/LegacyCard.svelte';
	import BriefPiece from './BriefPiece.svelte';
	import Crate from './Crate.svelte';
	import DossierDoor from './DossierDoor.svelte';
	import type { Piece, PieceGroup } from './unboxPieces.ts';

	type Props = {
		groups: PieceGroup[];
		campaign: Campaign;
		/** Which side of the table the groups stand on; the spotlight's are larger and stand square. */
		side: 'left' | 'right' | 'spotlight';
		/** The piece under the pointer or focus, whose meaning the Unboxing shows beside it. */
		ontip: (piece: Piece | null, at?: HTMLElement) => void;
	};

	let { groups, campaign, side, ontip }: Props = $props();

	const big = $derived(side === 'spotlight');
	const label = (piece: Piece) =>
		piece.t === 'card' ? piece.card.title : piece.t === 'seal' ? piece.tip : (piece.name ?? piece.tip);
</script>

<div class="groups {side}">
	{#each groups as group, index (group.heading)}
		<section
			class="group"
			style:--tilt={big ? '0deg' : `${((index + (side === 'right' ? 1 : 0)) % 3) - 1}deg`}
			in:fly={{ x: side === 'left' ? 50 : side === 'right' ? -50 : 0, y: big ? 24 : -16, duration: 380 }}
			{@attach feedback('Unboxing group', () => ({ heading: group.heading, pieces: group.pieces.length }))}
		>
			<h3>{group.heading}</h3>
			<div class="pieces">
				{#each group.pieces as piece (piece.key)}
					<button
						type="button"
						class="piece {piece.t}"
						class:mechanic={piece.stow.cls === 'mechanic'}
						data-stow-class={piece.stow.cls}
						data-put={piece.stow.put}
						aria-label={piece.tip}
						onpointerenter={event => ontip(piece, event.currentTarget)}
						onpointerleave={() => ontip(null)}
						onfocus={event => ontip(piece, event.currentTarget)}
						onblur={() => ontip(null)}
						in:scale={{ start: 0.6, duration: 320 }}
					>
						{#if piece.t === 'card'}
							<LegacyCard card={piece.card} side="b" size="thumb" {campaign} />
						{:else if piece.t === 'seal'}
							<span class="shell {piece.seal.t}">
								{#if piece.seal.t === 'package'}
									<Crate id={piece.seal.id} open={true} />
								{:else}
									<DossierDoor id={piece.seal.id} open={true} />
								{/if}
							</span>
						{:else}
							<BriefPiece unlock={piece.unlock} {campaign} size={big ? '2.8rem' : '2.2rem'} />
						{/if}
						{#if piece.t !== 'card' && (piece.t === 'seal' || piece.name)}
							<span class="name">{label(piece)}</span>
						{/if}
					</button>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.groups {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.3rem;
	}

	.groups.left {
		align-items: flex-end;
	}

	.groups.right {
		align-items: flex-start;
	}

	/* Beside the card the groups flow across the width there is, so a reading that opens many kinds stays large. */
	.groups.spotlight {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: flex-start;
		padding: 0;
	}

	.spotlight .group {
		flex: 1 1 auto;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-width: 100%;
		padding: 0.45rem 0.65rem 0.6rem;
		border: 1px solid rgb(231 220 198 / 0.2);
		border-radius: 6px;
		background: rgb(18 15 11 / 0.8);
		backdrop-filter: blur(6px);
		box-shadow: 0 0.7rem 1.8rem rgb(0 0 0 / 0.45);
		transform: rotate(var(--tilt));
	}

	h3 {
		margin: 0;
		color: var(--muted);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.spotlight h3 {
		font-size: 0.78rem;
	}

	.pieces {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.left .pieces {
		justify-content: flex-end;
	}

	.piece {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		max-width: 7.4rem;
		padding: 0.2rem;
		border: 1px solid transparent;
		border-radius: 5px;
		background: none;
		color: var(--ink);
		font: inherit;
		cursor: help;
		transition:
			border-color 160ms ease,
			background 160ms ease;
	}

	.piece:hover,
	.piece:focus-visible {
		border-color: rgb(231 220 198 / 0.45);
		background: rgb(231 220 198 / 0.08);
		outline: none;
	}

	.piece.mechanic {
		border-color: rgb(227 178 60 / 0.45);
		background: rgb(227 178 60 / 0.1);
	}

	.piece.card :global(.legacy-card) {
		box-shadow: 0 0.35rem 0.9rem rgb(0 0 0 / 0.5);
	}

	.shell.package {
		width: 4.2rem;
	}

	.shell.door {
		width: 2.6rem;
	}

	.name {
		font-size: 0.72rem;
		line-height: 1.2;
		text-align: center;
	}

	.spotlight .name {
		font-size: 0.8rem;
	}
</style>
