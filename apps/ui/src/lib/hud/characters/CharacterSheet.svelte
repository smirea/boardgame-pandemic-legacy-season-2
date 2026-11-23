<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { Character, CityId } from '@repo/game';
	import type { Snippet } from 'svelte';
	import { figureKey, figureUrl } from '#lib/characters/figures.ts';
	import { characterTraits, TRAIT_KIND } from '../traits.ts';
	import Exposure, { shownTrack } from './Exposure.svelte';
	import type { ShownBox } from './Exposure.svelte';
	import HavenChip from './HavenChip.svelte';
	import Sheet from './Sheet.svelte';
	import TraitPanel from './TraitPanel.svelte';

	type Props = {
		character: Character;
		tone: 'mine' | 'taken' | 'free' | 'dead';
		color: string | null;
		side?: 'left' | 'right';
		/** What stands on the cut under the figure, such as who holds the character. */
		base?: Snippet;
		/** What lies over the figure's foot. */
		over?: Snippet;
		/** Clicking anywhere on the card, such as taking it for the next game. */
		toggle?: () => void;
		canRename?: (city: CityId) => boolean;
		rename?: (city: CityId, name: string) => void;
		/** The track shown, when the table is watching a box scratched open. */
		exposure?: { boxes: ShownBox[]; now: number; stage: 'covered' | 'scratching' | 'open' };
		/** Drawn above the card, for the feedback tag. */
		label?: string;
	};

	let {
		character,
		tone,
		color,
		side = 'left',
		base,
		over,
		toggle,
		canRename = () => false,
		rename = () => {},
		exposure,
		label = 'Character',
	}: Props = $props();

	const traits = $derived(characterTraits(character));
	const empty = $derived(character.slots.filter(slot => slot === null).length);
	const stones = $derived(traits.length + empty);
</script>

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

{#snippet nothing()}{/snippet}

<article
	class="character"
	aria-label={character.name}
	{@attach feedback(label, () => ({ character: character.name, job: character.job, tone }))}
>
	<Sheet
		figure={figureUrl(figureKey({ ...character, hooded: character.worker }))}
		{tone}
		{side}
		{color}
		fitted={character.name}
		hit={toggle ? hit : undefined}
		{over}
		base={base ?? nothing}
	>
		{#snippet name()}{character.name}{/snippet}
		{#snippet meta()}
			{#if exposure}
				<Exposure boxes={exposure.boxes} now={exposure.now} stage={exposure.stage} />
			{:else}
				<Exposure boxes={shownTrack(character.exposureTrack, character.exposure)} />
			{/if}
			<HavenChip home={character.home} {canRename} {rename} />
			{#if character.carrier}<span class="sample" data-testid="carrier-badge">Sample</span>{/if}
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

	.sample {
		flex: none;
		padding: 0.05em 0.45em;
		border: 1px solid #3fe3b0;
		border-radius: 999px;
		background: rgb(14 48 40 / 0.92);
		color: #9bf5d7;
		font-size: 0.7em;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-shadow: none;
	}
</style>
