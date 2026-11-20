<script lang="ts">
	/** A numbered cardboard package: taped shut while sealed, its lid lifted once open. */
	type Props = { id: number; open: boolean };

	let { id, open }: Props = $props();
</script>

<span class="crate" class:open aria-hidden="true">
	<span class="lid"></span>
	<span class="front"><b>{id}</b></span>
	{#if !open}<span class="tape"></span>{/if}
</span>

<style>
	.crate {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 1.25;
		margin-top: 18%;
	}

	.front,
	.lid {
		position: absolute;
		left: 0;
		right: 0;
		border: 1px solid rgb(70 46 20 / 0.55);
		background:
			repeating-linear-gradient(90deg, rgb(255 255 255 / 0.04) 0 3px, transparent 3px 7px),
			linear-gradient(180deg, #b48a57, #9a7243);
	}

	.front {
		top: 22%;
		bottom: 0;
		display: grid;
		place-items: center;
		border-radius: 0 0 3px 3px;
		box-shadow: 0 0.4rem 0.8rem rgb(40 24 8 / 0.3);
	}

	.front b {
		font-family: var(--font-display);
		font-size: 2.2em;
		font-weight: 400;
		color: rgb(40 24 8 / 0.75);
	}

	.lid {
		top: 6%;
		height: 22%;
		z-index: 1;
		border-radius: 3px 3px 0 0;
		background: linear-gradient(180deg, #c49b66, #a77d4b);
		transform-origin: 0 100%;
		transition: transform 600ms cubic-bezier(0.2, 0.9, 0.3, 1.2);
	}

	.open .lid {
		transform: translateY(-38%) rotate(-11deg);
	}

	/* The inside shows once the lid is off. */
	.open .front {
		background:
			linear-gradient(180deg, rgb(30 18 6 / 0.65), transparent 38%), linear-gradient(180deg, #b48a57, #9a7243);
	}

	.tape {
		position: absolute;
		top: 2%;
		bottom: 8%;
		left: 50%;
		z-index: 2;
		width: 22%;
		translate: -50% 0;
		background: rgb(236 228 206 / 0.82);
		box-shadow: 0 0 0 1px rgb(60 44 28 / 0.12);
	}
</style>
