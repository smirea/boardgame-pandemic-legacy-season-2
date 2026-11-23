<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { Character, CityId } from '@repo/game';
	import { figureKey, figureUrl } from '#lib/characters/figures.ts';
	import { characterTraits, TRAIT_KIND } from '../traits.ts';
	import Exposure from './Exposure.svelte';
	import HavenChip from './HavenChip.svelte';
	import Sheet from './Sheet.svelte';
	import TraitPanel from './TraitPanel.svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		character: Character;
		/** Whose it is for the next game: this browser's player, someone else, or nobody. */
		tone: 'mine' | 'taken' | 'free';
		color: string | null;
		/** Who holds it, drawn on the cut under the figure. */
		owner: Snippet;
		toggle: () => void;
		canRename: (city: CityId) => boolean;
		rename: (city: CityId, name: string) => void;
	};

	let { character, tone, color, owner, toggle, canRename, rename }: Props = $props();

	const traits = $derived(characterTraits(character));
	const empty = $derived(character.slots.filter(slot => slot === null).length);
	const stones = $derived(traits.length + empty);
</script>

<article
	class="character"
	aria-label={character.name}
	{@attach feedback('Character', () => ({ character: character.name, job: character.job, tone }))}
>
	<Sheet figure={figureUrl(figureKey(character))} {tone} {color} fitted={character.name}>
		{#snippet hit()}
			<button
				class="hit"
				onclick={toggle}
				disabled={tone === 'taken'}
				aria-pressed={tone === 'mine'}
				aria-label={tone === 'mine' ? `Let go of ${character.name}` : `Take ${character.name}`}
				data-testid={`claim-${character.id}`}
			></button>
		{/snippet}
		{#snippet name()}{character.name}{/snippet}
		{#snippet meta()}
			<Exposure track={character.exposureTrack} exposure={character.exposure} />
			<HavenChip home={character.home} {canRename} {rename} />
		{/snippet}
		{#snippet arch()}
			{#each traits as trait, index (`${trait.kind}:${trait.name}:${index}`)}
				<TraitPanel
					at={(index + 0.5) / stones}
					kind={trait.kind}
					label={TRAIT_KIND[trait.kind]}
					name={trait.name}
					text={trait.text}
					struck={trait.struck}
					taken={trait.taken}
				/>
			{/each}
			{#each { length: empty } as _, index (index)}
				<TraitPanel at={(traits.length + index + 0.5) / stones} kind="empty" />
			{/each}
		{/snippet}
		{#snippet base()}{@render owner()}{/snippet}
	</Sheet>
</article>

<style>
	.character {
		width: 100%;
		height: 100%;
	}

	.hit {
		position: absolute;
		inset: 0;
		z-index: 1;
		padding: 0;
		border: 0;
		border-radius: 1cqh;
		background: none;
		cursor: pointer;
	}

	.hit:disabled {
		cursor: default;
	}

	.hit:focus-visible {
		outline: 2px solid rgb(226 195 106 / 0.7);
		outline-offset: 0.4cqh;
	}
</style>
