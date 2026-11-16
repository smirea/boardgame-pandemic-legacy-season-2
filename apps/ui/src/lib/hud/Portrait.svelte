<script lang="ts" module>
	/** A small stable hash, so a character keeps the same face in every game and on every screen. */
	function hash(text: string) {
		let value = 2166136261;
		for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
		return value >>> 0;
	}

	const SKIN = ['#f1d2b6', '#e2b58f', '#c98f63', '#a46a43', '#7a4a2c', '#5a3520'];
	const HAIR = ['#2a1d14', '#4a2f1d', '#7a4e2a', '#b07a3e', '#d9b77a', '#8c8a86', '#1c1c22', '#6e2c1c'];
	const COAT = ['#3d4a5c', '#5a3d2e', '#2f4a3a', '#6b5a3a', '#4a3d5c', '#2e2a26', '#7a3a2a'];
	const STYLES = ['short', 'long', 'bun', 'crop', 'curly', 'side'] as const;
</script>

<script lang="ts">
	type Props = {
		/** Seeds the face. */
		id: string;
		/** The seat colour the background is washed in. */
		color: string;
		/** A haven worker is anyone in a hood. */
		hooded?: boolean;
		dead?: boolean;
	};

	let { id, color, hooded = false, dead = false }: Props = $props();

	const face = $derived.by(() => {
		const seed = hash(id);
		const pick = <T>(list: readonly T[], shift: number) => list[(seed >>> shift) % list.length]!;
		return {
			skin: pick(SKIN, 0),
			hair: pick(HAIR, 4),
			coat: pick(COAT, 8),
			style: pick(STYLES, 12),
			glasses: ((seed >>> 16) & 7) === 0,
			beard: ((seed >>> 19) & 7) < 2,
			scarf: ((seed >>> 22) & 3) === 0,
			tilt: (((seed >>> 24) & 7) - 3.5) * 0.8,
		};
	});
	const gradient = $derived(`portrait-${hash(id).toString(36)}`);
</script>

<svg viewBox="0 0 60 80" class:dead aria-hidden="true" preserveAspectRatio="xMidYMax slice">
	<defs>
		<radialGradient id="{gradient}-wash" cx="50%" cy="38%" r="75%">
			<stop offset="0" stop-color="#f3e8cf" />
			<stop offset="0.55" stop-color={color} stop-opacity="0.55" />
			<stop offset="1" stop-color={color} />
		</radialGradient>
		<linearGradient id="{gradient}-shade" x1="0" x2="1">
			<stop offset="0.45" stop-color="#000" stop-opacity="0" />
			<stop offset="1" stop-color="#2a160a" stop-opacity="0.32" />
		</linearGradient>
	</defs>
	<rect width="60" height="80" fill="url(#{gradient}-wash)" />

	<g transform="rotate({face.tilt} 30 50)">
		{#if hooded}
			<path d="M8 80 C8 52 14 20 30 18 C46 20 52 52 52 80 Z" fill={face.coat} />
		{:else if face.style === 'long'}
			<path d="M17 36 C15 18 45 18 43 36 L46 62 C38 66 22 66 14 62 Z" fill={face.hair} />
		{/if}

		<path d="M2 80 C4 64 14 58 30 58 C46 58 56 64 58 80 Z" fill={face.coat} />
		<path d="M24 58 L30 70 L36 58 Z" fill="#efe6d2" opacity="0.85" />
		<rect x="25.5" y="46" width="9" height="13" rx="3" fill={face.skin} />
		<rect x="25.5" y="46" width="9" height="13" rx="3" fill="url(#{gradient}-shade)" />
		{#if face.scarf && !hooded}
			<path d="M20 58 C26 63 34 63 40 58 L41 61 C34 67 26 67 19 61 Z" fill="#b5521f" />
		{/if}

		<ellipse cx="18.4" cy="37" rx="2" ry="3" fill={face.skin} />
		<ellipse cx="41.6" cy="37" rx="2" ry="3" fill={face.skin} />
		<ellipse cx="30" cy="35" rx="11.5" ry="14" fill={face.skin} />
		<ellipse cx="30" cy="35" rx="11.5" ry="14" fill="url(#{gradient}-shade)" />

		{#if face.beard && !hooded}
			<path d="M19 37 C20 50 25 52 30 52 C35 52 40 50 41 37 C38 44 22 44 19 37 Z" fill={face.hair} />
		{/if}

		<path d="M23.5 32 Q26 30.6 28 31.8 M32 31.8 Q34 30.6 36.5 32" stroke="#2a1d14" stroke-width="0.9" fill="none" />
		<ellipse cx="25.8" cy="35" rx="1.15" ry="1.3" fill="#2a1d14" />
		<ellipse cx="34.2" cy="35" rx="1.15" ry="1.3" fill="#2a1d14" />
		<path d="M30.4 36 Q31.6 40.4 29.4 40.8" stroke="#6b4228" stroke-width="0.8" fill="none" opacity="0.7" />
		<path d="M26.8 44 Q30 45.6 33.2 44" stroke="#7a3a2a" stroke-width="1" fill="none" stroke-linecap="round" />
		{#if face.glasses}
			<g stroke="#2a2017" stroke-width="0.8" fill="#ffffff" fill-opacity="0.15">
				<circle cx="25.8" cy="35" r="3.2" />
				<circle cx="34.2" cy="35" r="3.2" />
				<path d="M29 35 L31 35" />
			</g>
		{/if}

		{#if hooded}
			<path d="M15 40 C14 20 46 20 45 40 C42 26 18 26 15 40 Z" fill={face.coat} />
			<path d="M15 40 C14 20 46 20 45 40" stroke="#000" stroke-opacity="0.25" fill="none" />
		{:else if face.style === 'short'}
			<path d="M18.2 33 C17 19 43 19 41.8 33 C40 26 34 24 30 24.5 C25 24 20 26 18.2 33 Z" fill={face.hair} />
		{:else if face.style === 'long'}
			<path d="M18 36 C16 19 44 19 42 36 C40 26 33 23.5 30 25 C26 23.5 20 26 18 36 Z" fill={face.hair} />
		{:else if face.style === 'bun'}
			<circle cx="30" cy="18.5" r="5" fill={face.hair} />
			<path d="M18.4 33 C17.5 20 42.5 20 41.6 33 C39 25 21 25 18.4 33 Z" fill={face.hair} />
		{:else if face.style === 'crop'}
			<path d="M18.8 30 C19 21 41 21 41.2 30 C36 25.5 24 25.5 18.8 30 Z" fill={face.hair} />
		{:else if face.style === 'curly'}
			{#each [19.5, 23, 27, 31, 35, 39, 41] as x, index (x)}
				<circle cx={x} cy={index % 2 ? 22 : 24.5} r="4.2" fill={face.hair} />
			{/each}
		{:else}
			<path d="M18.2 34 C16 18 44 18 41.8 30 C36 23 24 26 21 25 C20 28 19 31 18.2 34 Z" fill={face.hair} />
		{/if}
	</g>

	<rect width="60" height="80" fill="none" stroke="#1d140d" stroke-opacity="0.35" stroke-width="1.5" />
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	svg.dead {
		filter: grayscale(1) contrast(0.85);
	}
</style>
