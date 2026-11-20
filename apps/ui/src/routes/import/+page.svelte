<script lang="ts">
	import { importTabletop } from '@repo/tts';
	import type { ImportRow } from '@repo/tts';
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { LS } from '#lib/storage.ts';

	type Report = { name: string; date: string; at: number | null; rows: ImportRow[]; preview: boolean };

	const STATUSES: { id: ImportRow['status']; label: string; hint: string }[] = [
		{ id: 'same', label: 'Same', hint: 'The game holds what the table shows' },
		{ id: 'derived', label: 'Worked out', hint: 'Not printed on the table, worked out from what is' },
		{ id: 'differs', label: 'Differs', hint: 'The game holds something else, with the reason' },
		{ id: 'flag', label: 'Look at this', hint: 'Needs a person to check' },
	];

	const stored = LS.get('tableImport');
	let report = $state.raw<Report | null>(stored ? { ...stored, preview: false } : null);
	let error = $state('');
	let shown = $state<Set<ImportRow['status']>>(new Set(['derived', 'differs', 'flag']));
	let filter = $state('');

	const counts = $derived(
		Object.fromEntries(
			STATUSES.map(status => [status.id, report?.rows.filter(row => row.status === status.id).length ?? 0]),
		),
	);
	const topics = $derived.by(() => {
		const query = filter.trim().toLowerCase();
		const rows = (report?.rows ?? []).filter(
			row =>
				shown.has(row.status) &&
				(!query ||
					`${row.topic} ${row.item} ${row.table} ${row.imported} ${row.note ?? ''}`.toLowerCase().includes(query)),
		);
		const groups = new Map<string, ImportRow[]>();
		for (const row of rows) groups.set(row.topic, [...(groups.get(row.topic) ?? []), row]);
		return [...groups];
	});

	function toggle(status: ImportRow['status']) {
		const next = new Set(shown);
		if (next.has(status)) next.delete(status);
		else next.add(status);
		shown = next;
	}

	async function check(file: File | undefined) {
		if (!file) return;
		error = '';
		try {
			const imported = importTabletop(JSON.parse(await file.text()));
			report = { name: imported.name, date: imported.date, at: null, rows: imported.rows, preview: true };
		} catch (failure) {
			error = failure instanceof Error ? failure.message : String(failure);
		}
	}

	const when = (at: number) =>
		new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
</script>

<svelte:head>
	<title>Legacy: table import</title>
</svelte:head>

<main {@attach feedback('Table import report', () => ({ name: report?.name, rows: report?.rows.length, filter }))}>
	<header>
		<h1>Table import</h1>
		<p class="lead">
			What the game took from a Tabletop Simulator save, fact by fact: what the table shows next to what the game now
			holds. Load a save into the game from the Menu with Import campaign save. A file checked here is only read.
		</p>
		<label class="pick">
			<input type="file" accept="application/json,.json" onchange={event => check(event.currentTarget.files?.[0])} />
			Check a Tabletop Simulator save
		</label>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</header>

	{#if !report}
		<p class="hint">Nothing imported yet.</p>
	{:else}
		<section class="summary" {@attach feedback('Import summary', () => ({ counts }))}>
			<p>
				<strong>{report.name}</strong>, saved {report.date}
				{#if report.preview}<span class="tag">checked, not loaded</span>{:else if report.at}<span class="tag"
						>loaded {when(report.at)}</span
					>{/if}
			</p>
			<div class="chips" role="group" aria-label="Show rows by result">
				{#each STATUSES as status (status.id)}
					<button
						class="chip {status.id}"
						aria-pressed={shown.has(status.id)}
						title={status.hint}
						onclick={() => toggle(status.id)}>{status.label} <b>{counts[status.id]}</b></button
					>
				{/each}
				<input bind:value={filter} placeholder="Filter" aria-label="Filter rows" />
			</div>
		</section>

		{#each topics as [topic, rows] (topic)}
			<section class="topic" {@attach feedback(`Import rows: ${topic}`, () => ({ topic, rows: rows.length }))}>
				<h2>{topic}</h2>
				<table>
					<thead><tr><th>What</th><th>On the table</th><th>In the game</th><th></th></tr></thead>
					<tbody>
						{#each rows as row, index (`${row.item}-${index}`)}
							<tr class={row.status}>
								<th scope="row">{row.item}</th>
								<td>{row.table}</td>
								<td>
									{row.imported}
									{#if row.note}<span class="note">{row.note}</span>{/if}
									{#if row.evidence?.length}<span class="evidence">TTS {row.evidence.join(', ')}</span>{/if}
								</td>
								<td
									><span class="status {row.status}">{STATUSES.find(status => status.id === row.status)!.label}</span
									></td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{:else}
			<p class="hint">No row matches. Turn on Same to see everything that matched.</p>
		{/each}
	{/if}
</main>

<style>
	main {
		min-height: 100vh;
		padding: 3rem max(1.5rem, calc(50vw - 36rem));
		background: var(--table);
		color: var(--ink);
		font-family: var(--font-ui);
		font-variant-numeric: tabular-nums;
	}

	h1 {
		margin: 0 0 0.6rem;
		font-family: var(--font-display);
		font-size: 2.6rem;
		font-weight: 400;
	}

	h2 {
		margin: 0 0 0.5rem;
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 400;
	}

	.lead,
	.hint {
		max-width: 46rem;
		color: var(--muted);
	}

	.error {
		color: var(--danger);
	}

	.pick {
		display: inline-block;
		margin: 0.4rem 0 1.4rem;
		padding: 0.5rem 0.9rem;
		border: 1px solid var(--line-strong);
		background: var(--wash);
		cursor: pointer;
	}

	.pick input {
		display: none;
	}

	.summary {
		position: sticky;
		top: 0;
		z-index: 1;
		margin-bottom: 1.2rem;
		padding: 0.8rem 0;
		background: var(--table);
		border-bottom: 1px solid var(--line);
	}

	.summary p {
		margin: 0 0 0.6rem;
	}

	.tag {
		margin-left: 0.6rem;
		padding: 0.1rem 0.5rem;
		border: 1px solid var(--line-strong);
		color: var(--muted);
		font-size: 0.85rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.chip {
		padding: 0.35rem 0.8rem;
		border: 1px solid var(--line-strong);
		background: transparent;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}

	.chip[aria-pressed='true'] {
		background: var(--wash);
		color: var(--ink);
		border-color: currentColor;
	}

	.chip.same[aria-pressed='true'] {
		color: var(--good);
	}

	.chip.differs[aria-pressed='true'] {
		color: var(--warn);
	}

	.chip.flag[aria-pressed='true'] {
		color: var(--danger);
	}

	.chips input {
		margin-left: auto;
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--line-strong);
		background: var(--wash);
		color: var(--ink);
		font: inherit;
	}

	.topic {
		margin-bottom: 1.6rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.45rem 0.6rem;
		border-bottom: 1px solid var(--line);
		text-align: left;
		vertical-align: top;
	}

	thead th {
		color: var(--muted);
		font-weight: 500;
		font-size: 0.85rem;
	}

	tbody th {
		width: 16rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	tbody td:nth-child(2),
	tbody td:nth-child(3) {
		width: 36%;
		overflow-wrap: anywhere;
	}

	.note,
	.evidence {
		display: block;
		margin-top: 0.2rem;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.status {
		white-space: nowrap;
		font-size: 0.85rem;
	}

	.status.same {
		color: var(--good);
	}

	.status.derived {
		color: var(--muted);
	}

	.status.differs {
		color: var(--warn);
	}

	.status.flag {
		color: var(--danger);
	}
</style>
