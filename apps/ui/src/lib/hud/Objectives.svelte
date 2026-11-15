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
	.objectives {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.45rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--panel);
		backdrop-filter: blur(8px);
		font-size: 0.72rem;
		white-space: nowrap;
	}

	.need {
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		background: var(--accent);
		color: #06120c;
		font-weight: 700;
	}

	.objective {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.15rem 0.6rem;
		border: 1px solid transparent;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.05);
		color: var(--ink);
		font: inherit;
		cursor: pointer;
		transition:
			border-color 200ms ease,
			background 400ms ease,
			color 400ms ease;
	}

	.objective:disabled {
		cursor: default;
	}

	.objective.mandatory {
		border-color: rgb(255 209 102 / 0.55);
	}

	.objective.done {
		border-color: var(--accent);
		background: rgb(125 252 192 / 0.14);
		color: var(--accent);
	}

	.objective.waived {
		opacity: 0.4;
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
