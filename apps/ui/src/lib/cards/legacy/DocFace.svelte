<script lang="ts">
	import { pack, sealKey } from '@repo/game';
	import type { Campaign, LegacyCardDef } from '@repo/game';
	import type { LegacyPrint } from '#lib/cards/print.generated.ts';
	import { fitText } from '#lib/cards/fit.ts';
	import RichText from '#lib/hud/RichText.svelte';

	type Props = { card: LegacyCardDef; print: LegacyPrint; code: string; monthLabel: string; campaign?: Campaign };

	let { card, print, code, monthLabel, campaign }: Props = $props();

	type Month = { name: string; stars: number; cubes: number; now?: boolean };
	type Block =
		| { t: 'p'; text: string }
		| { t: 'ul'; items: string[] }
		| { t: 'sub'; text: string }
		| { t: 'band'; text: string }
		| { t: 'doors'; lead: string; ids: string[] }
		| { t: 'cal'; year?: boolean; months: Month[] }
		| { t: 'coords'; rows: (readonly [string, string])[] }
		| { t: 'wells'; boxes: Well[] }
		| { t: 'panel'; blocks: Block[] }
		| { t: 'tens' };
	type Well =
		| { rule: 'package'; id: number; body: Block[] }
		| { rule: 'door'; id: string; body: Block[] }
		| { rule: 'tools'; body: Block[] }
		| { rule: 'sealed'; short?: boolean };
	type Face = {
		family: 'paper' | 'report' | 'priorities' | 'now' | 'turn' | 'close' | 'last' | 'end';
		kicker?: string;
		title?: string;
		band?: boolean;
		blocks: Block[];
		foot?: string;
	};

	const JOURNAL = 'Keep journal entries like this in the reserve in case you want to reference them in the future.';
	const PAPERS = 'Keep papers like this in the reserve.';
	const DESTROY = 'Destroy this card after resolving it.';
	const GAME_END = 'Put this card into the Game End area each game until it is destroyed.';
	const NO_OBJECTIVE = '(This does not complete any objectives.)';

	const openPkg = (id: number, ...lines: string[]): Well => ({
		rule: 'package',
		id,
		body: lines.map(text => ({ t: 'p', text })),
	});
	const openDoor = (id: string, ...lines: string[]): Well => ({
		rule: 'door',
		id,
		body: lines.map(text => ({ t: 'p', text })),
	});

	const archive = (title: string, ...blocks: Block[]): Face => ({
		family: 'paper',
		kicker: 'From the archives',
		title,
		blocks,
		foot: PAPERS,
	});
	const priorities = (blocks: Block[]): Face => ({
		family: 'priorities',
		title: 'New priorities',
		band: true,
		blocks,
	});
	const now = (blocks: Block[], title = 'Right now!'): Face => ({
		family: 'now',
		title,
		band: true,
		blocks,
	});
	const doors = (ids: string[], one = false): Block => ({
		t: 'doors',
		lead: one ? 'Open the following door:' : 'Open the following doors:',
		ids,
	});
	const report = (kicker: string, condition: string, boxes: Well[]): Face => ({
		family: 'report',
		kicker,
		blocks: [
			{ t: 'p', text: condition },
			{ t: 'wells', boxes },
		],
		foot: DESTROY,
	});

	// Instructions only. Narrative on the same face is left off. Dates and titles stay, because they name the paper.
	// 03-01's two boxes are not stored on the campaign (the report forces nothing), so they stay covered.
	// 02-06's three 10s follow losingStreakBonusGames, which counts down at game end: during a game the
	// cross-out from this setup is still ahead by one.
	const FACES: Record<string, Face> = {
		'00-01': now(
			[
				{ t: 'sub', text: 'Play using all the rules except:' },
				{
					t: 'ul',
					items: [
						'Do not open the Legacy deck.',
						'Your character cannot get exposed.',
						'You cannot do the Recon action.',
						'You cannot do System-Wide Production when you play Produce Supplies cards.',
						'Do not do Game End steps.',
					],
				},
				{ t: 'sub', text: 'When you have played the Prologue enough times to feel comfortable:' },
				{
					t: 'ul',
					items: [
						'Destroy this card and the Prologue Objective card.',
						'Open the Legacy deck.',
						'Start your campaign.',
					],
				},
			],
			'Prologue',
		),
		'01-01': { family: 'paper', kicker: 'Journal entry', blocks: [], foot: JOURNAL },

		'02-01': report('Perimeter report', 'If you have not opened {{d:66}}, scratch the box below.', [
			openPkg(
				1,
				`Open {{p:1}} and follow the instructions inside.${NO_OBJECTIVE}`,
				'Destroy the "Decontamination Kit" Unrationed Event card inside.',
			),
		]),
		'03-01': report('Perimeter report', 'If you have not opened {{d:67}}, scratch the first box below.', [
			{ rule: 'sealed' },
			{ rule: 'sealed', short: true },
		]),
		'04-01': report('Perimeter report', 'If you have not opened {{d:67}} (South America), scratch the box below.', [
			openPkg(
				5,
				`Open {{p:5}} and follow the instructions inside. ${NO_OBJECTIVE}`,
				'Destroy the "Strategic Reserves" Unrationed Event card inside.',
			),
		]),
		'05-01': report('Perimeter report', 'If you have not opened {{d:60}}, scratch the box below.', [
			openDoor('60', 'Open {{d:60}} and put it on the board. You have not yet accessed this haven.'),
		]),
		'06-01': report('Perimeter report', 'If you have not opened {{d:64}} (Europe), scratch the box below.', [
			openPkg(
				4,
				`Open {{p:4}} and follow the instructions inside. ${NO_OBJECTIVE}`,
				'Destroy the "Relocation" Unrationed Event card inside.',
				'Then, open {{d:21}}.',
			),
		]),
		'07-01': report('Perimeter report', 'If you have not opened {{d:57}} (Africa), scratch the box below.', [
			openPkg(
				7,
				`Open {{p:7}} and follow the instructions inside. ${NO_OBJECTIVE}`,
				'Destroy the "TOPAZ Experimental Vaccine" Unrationed Event card inside.',
			),
		]),
		'08-01': report('Perimeter report', 'If you have not opened {{d:62}} (the Middle East), scratch the box below.', [
			openPkg(
				2,
				`Open {{p:2}} and follow the instructions inside. ${NO_OBJECTIVE}`,
				'Destroy the "Renewal" Unrationed Event card inside.',
			),
		]),
		'09-01': report('Perimeter report', 'If you have not opened {{d:65}}, scratch the box below.', [
			openDoor('65', 'Open {{d:65}} and place it on the board. You have not yet accessed this haven.'),
		]),
		'10-01': report(
			'Perimeter report',
			'If you have not opened {{d:56}} and {{d:63}} (East Asia), scratch the box below.',
			[
				{
					rule: 'package',
					id: 3,
					body: [
						{ t: 'p', text: 'Do the following:' },
						{
							t: 'ul',
							items: [
								`Open {{p:3}} and follow the instructions inside. ${NO_OBJECTIVE}`,
								'After selecting characters for this game, add a scar to 1 of these characters.',
								'Destroy the "Biodome Prototype" Unrationed Event card inside.',
							],
						},
					],
				},
			],
		),
		'11-01': report('Intelligence report', 'If Hollow Men have not yet defected, scratch the box below.', [
			openDoor(
				'17',
				`Open {{d:17}} and follow the instructions inside. ${NO_OBJECTIVE}`,
				'Then, after selecting characters for this game, add a scar to 2 of these characters.',
			),
		]),
		'12-01': report('Perimeter report', 'If you have not completed the plan, scratch the box below.', [
			openPkg(
				8,
				`Open {{p:8}} and follow the instructions inside. ${NO_OBJECTIVE}`,
				'Destroy the "Riot Control" Unrationed Event card inside.',
			),
		]),
		'12-05': {
			family: 'last',
			title: 'At last',
			blocks: [
				{
					t: 'p',
					text: 'Look at the following two cards to see what happens next, then calculate your score to determine the ultimate fate of your world.',
				},
			],
		},

		'01-02': archive('October 15, year 70'),
		'02-02': archive('April 24, year 40'),
		'03-02': archive('Year 57 summary'),
		'04-02': archive('Year 42', {
			t: 'coords',
			rows: [
				['J', '26°11\'28"S  28°02\'45"E'],
				['O', '34°29\'38"S  58°31\'35"W'],
				['T', '41°11\'46"S  174°56\'29"E'],
				['P', '53°19\'21"N  1'],
			],
		}),
		'05-02': archive('November 5, year 70'),
		'06-02': archive('May 23, year 14 after the fall'),
		'07-02': archive('July, year 38'),
		'08-02': archive('December 19, year 48'),
		'09-02': archive('April 15, year 44'),
		'10-02': archive('October, year 1'),
		'11-02': archive('June 18, year 10'),
		'12-02': archive('December, year 70'),

		'01-03': priorities([
			{ t: 'p', text: 'Our objectives follow.' },
			{ t: 'p', text: 'This month we have 2 mandatory objectives.' },
			{
				t: 'p',
				text: 'Remember you can always check to see how many objectives you need to complete for a given month by checking the objective calendar on the board.',
			},
			{
				t: 'cal',
				year: true,
				months: [
					{ name: 'Prologue', stars: 1, cubes: 36 },
					{ name: 'January', stars: 2, cubes: 36, now: true },
					{ name: 'February', stars: 2, cubes: 33 },
				],
			},
		]),
		'02-03': priorities([
			{ t: 'p', text: 'Destroy the following objective:' },
			{ t: 'ul', items: ['Recon North America'] },
			{ t: 'p', text: 'New objectives follow.' },
			{ t: 'p', text: 'We still need to complete 2 objectives.' },
			{
				t: 'p',
				text: 'Remember to place Supply cubes in the stockpile as shown on the projection calendar on the board (33 for February).',
			},
			{
				t: 'p',
				text: 'Also, as you complete months, you can cross them off the projected supplies calendar (on the board) to help you keep track of where you are in the campaign.',
			},
		]),
		'03-03': priorities([
			{ t: 'p', text: 'We now need to complete 3 objectives each month.' },
			{
				t: 'p',
				text: 'Use the objective calendar on the board to help you remember how many objectives you need to complete each month.',
			},
			{
				t: 'cal',
				months: [
					{ name: 'February', stars: 2, cubes: 33 },
					{ name: 'March', stars: 3, cubes: 30, now: true },
					{ name: 'April', stars: 3, cubes: 27 },
				],
			},
		]),
		'08-03': now([doors(['M', '25'])]),
		'09-03': priorities([
			{ t: 'p', text: 'Destroy the following objective:' },
			{ t: 'ul', items: ['Recon 1 unknown region'] },
			{
				t: 'p',
				text: 'The "Recon East Asia" objective is enclosed. If you have already Reconned East Asia, count this objective as complete during September!',
			},
			{ t: 'sub', text: 'Right now!' },
			doors(['R', '55', 'D', 'Y', 'U']),
		]),
		'10-03': priorities([
			{ t: 'p', text: 'Destroy the following objectives:' },
			{ t: 'ul', items: ['Recon East Asia', 'Connect 2 new cities', 'Complete 2 searches'] },
			{
				t: 'p',
				text: 'A new mandatory objective is enclosed. We need to complete 2 objectives this month.',
			},
			{
				t: 'cal',
				months: [
					{ name: 'September', stars: 3, cubes: 12 },
					{ name: 'October', stars: 2, cubes: 8, now: true },
					{ name: 'November', stars: 1, cubes: 4 },
				],
			},
			doors(['P', '37']),
		]),
		'11-03': priorities([
			{ t: 'p', text: 'Destroy the following objectives:' },
			{ t: 'ul', items: ['Build 3 new supply centers', 'Get Hollow Men to defect'] },
			{
				t: 'p',
				text: 'A new mandatory objective is enclosed. We only need to complete this 1 objective in November.',
			},
			{
				t: 'cal',
				months: [
					{ name: 'October', stars: 2, cubes: 8 },
					{ name: 'November', stars: 1, cubes: 4, now: true },
					{ name: 'December', stars: 1, cubes: 0 },
				],
			},
		]),
		'12-03': priorities([
			{ t: 'p', text: 'Destroy the following cards if you have not done so already:' },
			{ t: 'ul', items: ['Complete the Plan', 'The Plan'] },
			{
				t: 'p',
				text: 'A new mandatory objective is enclosed. We only need to complete this 1 objective in December.',
			},
			{ t: 'cal', months: [{ name: 'December', stars: 1, cubes: 0, now: true }] },
		]),

		'01-06': {
			family: 'turn',
			kicker: 'Turning point #1',
			title: 'Forsaken cities',
			blocks: [
				{
					t: 'panel',
					blocks: [
						{
							t: 'p',
							text: 'If there is at least one city with 0 population, open {{d:A}} {{d:12}} and destroy this card.',
						},
					],
				},
			],
			foot: GAME_END,
		},
		'02-06': {
			family: 'turn',
			kicker: 'Turning point #2',
			title: 'Give us the tools and we will finish the job!',
			blocks: [
				{
					t: 'panel',
					blocks: [
						{ t: 'p', text: 'If you have lost 4 games in a row, scratch this box:' },
						{
							t: 'wells',
							boxes: [
								{
									rule: 'tools',
									body: [
										{
											t: 'p',
											text: 'Each game, during step 1 of setup, you may cross out a stockpile bonus below to add up to 10 Supply cubes from the reserve to the stockpile. Destroy this card after all 3 stockpile bonuses have been crossed out.',
										},
										{ t: 'tens' },
									],
								},
							],
						},
					],
				},
			],
			foot: GAME_END,
		},
		'10-05': {
			family: 'turn',
			kicker: 'Turning point #3',
			title: 'Hollow Men have defected',
			blocks: [
				{
					t: 'panel',
					blocks: [
						{
							t: 'p',
							text: 'If there is at least 1 Hollow Men figure on 3 different havens at the end of the game, open door {{d:17}} and destroy this card.',
						},
					],
				},
			],
			foot: GAME_END,
		},

		'01-07': {
			family: 'now',
			blocks: [
				{ t: 'p', text: 'New Rationed Event cards follow.' },
				{ t: 'p', text: 'Keep these cards in the reserve.' },
				{
					t: 'p',
					text: 'These add to the pool of Rationed Event cards you can select from at the beginning of each game.',
				},
			],
		},
		'02-07': now([doors(['34'], true)]),
		'03-06': now([doors(['K', '24', '47', 'E'])]),
		'04-03': now([doors(['42'], true)]),
		'05-03': now([doors(['31', '36'])]),
		'06-03': now([doors(['44', '49'])]),
		'08-05': now([doors(['29', '48'])]),
		'09-05': now([doors(['33'], true)]),
		'10-06': now([doors(['28', '45'])]),

		'12-06': { family: 'close', kicker: 'Ending', title: 'If you failed to deliver the sample...', blocks: [] },
		'12-07': { family: 'close', kicker: 'Ending', title: 'If you delivered the sample...', blocks: [] },
		'12-09': {
			family: 'close',
			kicker: 'Ending',
			blocks: [
				{ t: 'band', text: 'Did not deliver: 851 and above' },
				{ t: 'band', text: 'Did not deliver: 701–850' },
			],
		},
		'12-10': { family: 'close', kicker: 'Ending', title: 'Did not deliver: 400 and below', blocks: [] },
		'12-11': {
			family: 'close',
			kicker: 'Ending',
			blocks: [
				{ t: 'band', text: 'Delivered: 851 and above' },
				{ t: 'band', text: 'Delivered: 701–850' },
			],
		},
		'12-12': { family: 'close', kicker: 'Ending', title: 'Delivered: 400 and below', blocks: [] },
		'12-13': {
			family: 'end',
			kicker: 'Legacy deck',
			title: 'Congratulations!',
			blocks: [{ t: 'p', text: 'You have reached the end of the Legacy deck.' }],
		},
	};

	const face = $derived.by(() => {
		if (card.id === '12-13' && !/congrat/i.test(print.a.header))
			throw new Error(`Legacy card 12-13 is showing ${print.a.header}, not the end of the deck`);
		const found = FACES[card.id];
		if (!found) throw new Error(`No document face for Legacy card ${card.id}`);
		return found;
	});

	const fitKey = $derived(
		`${card.id}|${campaign?.legacyIndex ?? ''}|${campaign?.forced.join(',') ?? ''}|${campaign?.turningPoints.join(',') ?? ''}|${campaign?.losingStreakBonusGames ?? ''}`,
	);

	const bonusUsed = $derived.by(() => {
		if (!campaign) return 0;
		const index = pack.legacyDeck.findIndex(entry => entry.id === '02-06');
		const scratched = campaign.legacyIndex > index && !campaign.turningPoints.includes('losingStreak');
		return scratched ? 3 - campaign.losingStreakBonusGames : 0;
	});

	function wellOpen(box: Well): boolean {
		if (!campaign || box.rule === 'sealed') return false;
		if (box.rule === 'package') return campaign.forced.includes(sealKey({ t: 'package', id: box.id }));
		if (box.rule === 'door') return campaign.forced.includes(sealKey({ t: 'door', id: box.id }));
		const index = pack.legacyDeck.findIndex(entry => entry.id === '02-06');
		return campaign.legacyIndex > index && !campaign.turningPoints.includes('losingStreak');
	}

	function openBody(box: Well): Block[] | null {
		if (box.rule === 'sealed' || !wellOpen(box)) return null;
		return box.body;
	}

	type Part = { kind: 'text' | 'door' | 'pkg'; value: string };
	function parts(text: string): Part[] {
		const token = /\{\{(d|p):([^}]+)\}\}/g;
		const out: Part[] = [];
		let from = 0;
		for (const match of text.matchAll(token)) {
			if (match.index > from) out.push({ kind: 'text', value: text.slice(from, match.index) });
			out.push({ kind: match[1] === 'd' ? 'door' : 'pkg', value: match[2]! });
			from = match.index + match[0].length;
		}
		if (from < text.length) out.push({ kind: 'text', value: text.slice(from) });
		return out;
	}
</script>

{#snippet bits(text: string)}
	{#each parts(text) as part, index (index)}
		{#if part.kind === 'text'}
			<RichText text={part.value} />
		{:else}
			<span
				class="badge"
				class:pkg={part.kind === 'pkg'}
				aria-label={part.kind === 'pkg' ? `Package ${part.value}` : `door ${part.value}`}>{part.value}</span
			>
		{/if}
	{/each}
{/snippet}

{#snippet show(block: Block)}
	{#if block.t === 'p'}
		<p>{@render bits(block.text)}</p>
	{:else if block.t === 'ul'}
		<ul>
			{#each block.items as item (item)}
				<li>{@render bits(item)}</li>
			{/each}
		</ul>
	{:else if block.t === 'sub'}
		<p class="sub">{block.text}</p>
	{:else if block.t === 'band'}
		<p class="band-title">{block.text}</p>
	{:else if block.t === 'doors'}
		<div class="door-row">
			<p>{block.lead}</p>
			<div class="badges">
				{#each block.ids as id (id)}
					<span class="badge" aria-label={`door ${id}`}>{id}</span>
				{/each}
			</div>
		</div>
	{:else if block.t === 'cal'}
		<div class="cal" role="table" aria-label="Required objectives and projected supply cubes">
			{#if block.year}<p class="year">Year 71 of the Fall</p>{/if}
			<div class="cols">
				{#each block.months as month (month.name)}
					<div class="col" class:now={month.now} role="cell">
						<b>{month.name}</b>
						<span class="stars" aria-label={`${month.stars} required`}>{'\u2605'.repeat(month.stars)}</span>
						<span class="cubes">{month.cubes}</span>
					</div>
				{/each}
			</div>
		</div>
	{:else if block.t === 'coords'}
		<dl class="coords">
			{#each block.rows as row (row[0])}
				<div>
					<dt>{row[0]}</dt>
					<dd>{row[1]}</dd>
				</div>
			{/each}
		</dl>
	{:else if block.t === 'panel'}
		<div class="panel">
			{#each block.blocks as child, index (index)}
				{@render show(child)}
			{/each}
		</div>
	{:else if block.t === 'wells'}
		<div class="wells">
			{#each block.boxes as box, index (index)}
				{@const body = openBody(box)}
				{#if body}
					<div class="well open">
						{#each body as child, childIndex (childIndex)}
							{@render show(child)}
						{/each}
					</div>
				{:else}
					<div
						class="well"
						class:short={box.rule === 'sealed' && box.short}
						aria-label="Scratch-off box, covered"
					></div>
				{/if}
			{/each}
		</div>
	{:else if block.t === 'tens'}
		<div class="tens" aria-label="Stockpile bonuses">
			{#each [0, 1, 2] as index (index)}
				<span class="ten" class:crossed={index < bonusUsed} aria-label={index < bonusUsed ? '10, crossed out' : '10'}>
					<i aria-hidden="true"></i>
					10
				</span>
			{/each}
		</div>
	{/if}
{/snippet}

<div class="inner face {face.family}" aria-label={`${face.kicker ?? face.title ?? 'Legacy card'}, ${monthLabel}`}>
	{#if face.kicker || face.title}
		<header class:band={face.band}>
			{#if face.kicker}<span class="kicker">{face.kicker}</span>{/if}
			{#if face.title}
				<h3 {@attach fitText(face.title, { max: 1.4, min: 0.8, across: true })}>{face.title}</h3>
			{/if}
		</header>
	{/if}
	<div class="sheet" {@attach fitText(fitKey, { max: 1, min: 0.5 })}>
		{#each face.blocks as block, index (index)}
			{@render show(block)}
		{/each}
	</div>
	{#if face.foot}<p class="foot">{face.foot}</p>{/if}
	<span class="code">{code}</span>
</div>

<style>
	.face {
		gap: 0.5em;
		color: var(--paper-ink);
		background: var(--document);
		box-shadow: inset 0 0 0 1.5px rgb(42 32 23 / 0.35);
	}

	header {
		display: flex;
		flex-direction: column;
		gap: 0.12em;
		flex: none;
	}

	.kicker {
		font-size: 0.68em;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.4em;
		font-weight: 400;
		line-height: 1.05;
	}

	.sheet {
		display: flex;
		flex-direction: column;
		gap: 0.45em;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		line-height: 1.28;
	}

	.sheet p,
	.foot {
		margin: 0;
	}

	ul {
		margin: 0;
		padding-left: 1.1em;
		list-style: disc;
	}

	li + li {
		margin-top: 0.15em;
	}

	.foot {
		flex: none;
		padding-right: 4.5em;
		font-size: 0.78em;
		font-weight: 700;
		line-height: 1.25;
	}

	.badge {
		display: inline-block;
		margin: 0 0.12em;
		padding: 0.02em 0.38em 0.06em;
		border-radius: 0.2em;
		background: #f4efe6;
		color: #8d2e24;
		font-size: 0.92em;
		font-weight: 800;
		line-height: 1.2;
		vertical-align: 0.05em;
		box-shadow: inset 0 0 0 1px rgb(141 46 36 / 0.45);
	}

	.badge.pkg::before {
		content: 'Pkg ';
		font-size: 0.72em;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35em;
	}

	.door-row {
		display: flex;
		flex-direction: column;
		gap: 0.35em;
	}

	.sub {
		margin-top: 0.2em;
		font-size: 1.05em;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #e7b4a4;
	}

	.cal {
		display: flex;
		flex-direction: column;
		gap: 0.3em;
		margin-top: auto;
	}

	.year {
		font-size: 0.68em;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.8;
	}

	.cols {
		display: flex;
		gap: 0.28em;
	}

	.col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.12em;
		flex: 1;
		min-width: 0;
		padding: 0.28em 0.15em 0.32em;
		border-radius: 0.25em;
		background: rgb(8 18 32 / 0.35);
		text-align: center;
	}

	.col.now {
		box-shadow: inset 0 0 0 1.5px #f4efe4;
	}

	.col b {
		font-size: 0.62em;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.stars {
		color: #f4efe4;
		font-size: 0.72em;
		letter-spacing: 0.04em;
	}

	.cubes {
		font-size: 1.05em;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	.coords {
		display: flex;
		flex-direction: column;
		gap: 0.28em;
		margin: auto 0 0;
		padding: 0.55em 0.6em;
		background: rgb(255 252 246 / 0.55);
		box-shadow: inset 0 0 0 1px rgb(42 32 23 / 0.2);
	}

	.coords div {
		display: grid;
		grid-template-columns: 1.2em 1fr;
		gap: 0.45em;
		align-items: baseline;
	}

	.coords dt {
		font-weight: 800;
	}

	.coords dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.01em;
	}

	.panel {
		padding: 0.55em 0.65em;
		border-radius: 0.35em;
		background: rgb(0 0 0 / 0.22);
	}

	.panel:has(.wells) {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.4em;
		min-height: 0;
	}

	.wells {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.4em;
		min-height: 0;
	}

	.well {
		flex: 1;
		min-height: 2.4em;
		border-radius: 0.28em;
		background-color: #d9d6cf;
		background-image: repeating-linear-gradient(
			-45deg,
			rgb(255 255 255 / 0.45) 0 0.42em,
			rgb(70 64 56 / 0.16) 0.42em 0.84em
		);
		box-shadow: inset 0 0 0 1px rgb(42 32 23 / 0.35);
	}

	.well.short {
		flex: 0.78;
		min-height: 2em;
	}

	.well.open {
		display: flex;
		flex: none;
		flex-direction: column;
		gap: 0.4em;
		padding: 0.45em 0.5em;
		background: rgb(255 252 246 / 0.88);
		color: #241c14;
	}

	.tens {
		display: flex;
		gap: 0.7em;
		margin-top: 0.15em;
	}

	.ten {
		display: inline-flex;
		align-items: center;
		gap: 0.28em;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	.ten i {
		width: 0.72em;
		height: 0.72em;
		background: #efe6d2;
		box-shadow: inset 0 0 0 1px #2a2017;
	}

	.ten.crossed {
		position: relative;
		opacity: 0.45;
	}

	.ten.crossed::after {
		content: '';
		position: absolute;
		left: -0.08em;
		right: -0.08em;
		top: 50%;
		height: 0.14em;
		background: currentColor;
		transform: rotate(-18deg);
	}

	.band-title {
		font-family: var(--font-display);
		font-size: 1.25em;
		line-height: 1.15;
	}

	.report {
		background: linear-gradient(180deg, #f3e6cf, #e7d3ae);
	}

	.report .kicker {
		color: #243044;
	}

	.report .foot {
		color: #8d2a22;
	}

	.priorities,
	.now,
	.last {
		background: #1a3358;
		color: #f4efe4;
		box-shadow: inset 0 0 0 1.5px rgb(244 239 228 / 0.28);
	}

	.now {
		background: #163044;
	}

	.priorities header.band,
	.now header.band {
		margin: -1.1em -1em 0.15em;
		padding: 0.42em 1em 0.38em;
		background: #f4efe4;
		color: #9d2c22;
	}

	.priorities header.band h3,
	.now header.band h3 {
		font-family: var(--font-ui);
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.turn {
		background: #1a403c;
		color: #f4efe4;
		box-shadow: inset 0 0 0 1.5px rgb(226 195 106 / 0.45);
	}

	.turn h3,
	.turn .foot {
		color: #e2c36a;
	}

	.close {
		background: #f6efe4;
		box-shadow: inset 0 0 0 2px #9d2c22;
	}

	.close .kicker,
	.close h3,
	.close .band-title {
		color: #9d2c22;
	}

	.end {
		justify-content: center;
		background: #241c16;
		color: #f0e2c0;
		box-shadow: inset 0 0 0 1.5px rgb(226 195 106 / 0.4);
		text-align: center;
	}

	.end header,
	.end .sheet {
		align-items: center;
	}

	.end h3 {
		color: #e2c36a;
		font-size: 1.7em;
	}

	.end .kicker {
		color: #cbb892;
	}
</style>
