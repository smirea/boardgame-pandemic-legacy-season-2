<script lang="ts">
	import { pack } from '@repo/game';
	import type { ObjectiveId, PublicState } from '@repo/game';

	type Props = { snap: PublicState; onwaive: (objective: ObjectiveId) => void };

	let { snap, onwaive }: Props = $props();

	const campaign = $derived(snap.world.campaign);
	const game = $derived(snap.world.game);
	const objectives = $derived(pack.objectives.filter(objective => campaign.objectives.includes(objective.id)));
	const open = $derived(objectives.filter(objective => !game?.waived.includes(objective.id)));
	const needed = $derived(Math.min(campaign.required, open.length));
</script>

<section class="objectives" data-testid="objectives">
	<span class="need" title="Objectives completed out of the number needed to win"
		>{game?.completed.length ?? 0} / {needed}</span
	>
	{#each objectives as objective (objective.id)}
		{@const progress = game?.progress[objective.id] ?? 0}
		{@const done = game?.completed.includes(objective.id) ?? false}
		{@const waived = game?.waived.includes(objective.id) ?? false}
		<button
			class="objective"
			class:done
			class:waived
			class:mandatory={objective.mandatory}
			disabled={!game || done || waived}
			title={`${objective.rule}${objective.mandatory ? ' Mandatory.' : ''} Click to mark it impossible this game.`}
			onclick={() => onwaive(objective.id)}
		>
			<span class="name">{objective.name}</span>
			{#if objective.target > 1}
				<span class="steps">
					{#each { length: objective.target } as _, index (index)}<i class:on={index < progress}></i>{/each}
				</span>
			{:else if done}
				<span class="tick">✓</span>
			{/if}
		</button>
	{/each}
</section>

<style>
	/* Objectives hang over the top of the chart as paper tags. A finished one gets stamped. */
	.objectives {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.need {
		padding: 0.2rem 0.5rem;
		border-radius: 2px;
		background: var(--slip-ink);
		color: var(--slip);
		font-weight: 700;
		box-shadow: var(--slip-shadow);
	}

	.objective {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.2rem 0.65rem 0.2rem 1rem;
		border: 0;
		background: var(--slip);
		color: var(--slip-ink);
		font: inherit;
		box-shadow: var(--slip-shadow);
		clip-path: polygon(0.55rem 0, 100% 0, 100% 100%, 0.55rem 100%, 0 50%);
		cursor: pointer;
		transition:
			translate 300ms cubic-bezier(0.2, 0.9, 0.3, 1.3),
			background 400ms ease,
			color 400ms ease;
	}

	.objective::before {
		content: '';
		position: absolute;
		left: 0.45rem;
		top: 50%;
		width: 0.28rem;
		height: 0.28rem;
		border-radius: 50%;
		background: var(--table);
		translate: 0 -50%;
	}

	.objective:hover:not(:disabled) {
		translate: 0 2px;
	}

	.objective:disabled {
		cursor: default;
	}

	.objective.mandatory {
		background: #f0dfb4;
	}

	.objective.done {
		background: #c9dccd;
		color: var(--ink-good);
		animation: stamped 500ms cubic-bezier(0.2, 1.4, 0.4, 1);
	}

	@keyframes stamped {
		from {
			scale: 1.25;
		}
	}

	.objective.waived {
		opacity: 0.45;
		text-decoration: line-through;
	}

	.steps {
		display: inline-flex;
		gap: 3px;
	}

	.steps i {
		width: 0.5rem;
		height: 0.5rem;
		border: 1px solid currentcolor;
		border-radius: 50%;
		opacity: 0.6;
		transition:
			background 300ms ease,
			transform 300ms cubic-bezier(0.3, 1.6, 0.5, 1);
	}

	.steps i.on {
		background: currentcolor;
		opacity: 1;
		transform: scale(1.15);
	}

	.tick {
		font-weight: 700;
	}
</style>
