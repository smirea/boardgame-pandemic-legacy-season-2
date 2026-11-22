import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pack, reconned } from '@repo/game';
import type { PublicState } from '@repo/game';
import { untouched } from './audit.ts';
import type { Audit } from './audit.ts';
import type { LabConfig, PlayerConfig } from './config.ts';
import { labRoot, repoRoot } from './config.ts';
import { monthName } from './names.ts';

type BriefInput = {
	config: LabConfig;
	state: PublicState;
	audit: Audit;
	dir: string;
	reports: string;
	leadIndex: number;
	/** What a staged game tells the whole table and then each seat. */
	stage?: { table: string[]; seats: string[][] } | null;
};

/** Turns the lab's list of unused mechanics into things a player can act on this game. */
function toTry(audit: Audit, state: PublicState): string[] {
	const { campaign } = state.world;
	const live = untouched(audit, state.world).live;
	const lines: string[] = [];
	const actions = live.filter(key => key.startsWith('action:')).map(key => key.slice(7));
	if (actions.length) lines.push(`Actions nobody has used yet: ${actions.join(', ')}.`);
	const events = live.filter(key => key.startsWith('play:')).map(key => key.slice(5));
	if (events.length)
		lines.push(
			`Event cards nobody has played yet: ${events.join(', ')}. Rationed ones are in the reserve for the lead to pick at setup. Unrationed ones are always in the deck.`,
		);
	const jobs = live.filter(key => key.startsWith('job:')).map(key => key.slice(4));
	if (jobs.length)
		lines.push(`Jobs nobody has played yet: ${jobs.join(', ')}. Create a character with one, or switch to one.`);
	const buys = live
		.filter(key => key.startsWith('bought:') || key.startsWith('purchase:'))
		.map(key => key.replace(/^(bought|purchase):/, ''));
	if (buys.length) lines.push(`Never bought at game end: ${buys.join(', ')}.`);
	const objectives = live.filter(key => key.startsWith('objective:')).map(key => key.slice(10));
	if (objectives.length)
		lines.push(
			`Objectives never completed: ${objectives.map(id => pack.objectives.find(objective => objective.id === id)?.name ?? id).join(', ')}.`,
		);
	const unopened = pack.reconRoutes.filter(route => campaign.routes.includes(route.id) && !reconned(campaign, route));
	if (unopened.length)
		lines.push(
			`Recon still open: ${unopened.map(route => `${route.city} (${route.count} ${route.color} cards)`).join(', ')}.`,
		);
	const other = live
		.filter(key => /^(command|decide):/.test(key) && !key.endsWith('WAIVE_OBJECTIVE'))
		.map(key => key.split(':')[1]);
	if (other.length) lines.push(`Never happened yet: ${other.join(', ')}. Use them if a real chance comes up.`);
	return lines;
}

/** The brief of a player who has only the screen. It names no control and no place on the screen: finding them is the test. */
function screenBrief(input: {
	player: PlayerConfig;
	others: string[];
	game: string;
	lead: PlayerConfig;
	isLead: boolean;
	history: string[];
	suggestions: string[];
	report: string;
	month: number;
}): string {
	const { player, others, game, lead, isLead, history, suggestions, report } = input;
	return [
		`# Brief for ${player.name}: ${game}`,
		'',
		`You are **${player.name}**, one of three playtesters at a co-op board game played on a laptop each. The other two are ${others.join(' and ')}. This session is one game: **${game}**.`,
		'',
		'Read these two files first, in this order:',
		'',
		`1. The playtester guide: \`${join(labRoot, 'GUIDE-screen.md')}\``,
		`2. Who you are: \`${player.persona}\``,
		'',
		'## Your command',
		'',
		'```',
		`cd ${repoRoot}`,
		`./apps/playtest/play ${player.id} <command>`,
		'```',
		'',
		`Your id is \`${player.id}\`. At the table you are called ${player.name}: keep that name. Your laptop is already open on the game, and the three of you are connected.`,
		'',
		'## This session',
		'',
		history.length
			? `The campaign is under way. The year so far: ${history.join(', ')}. Other testers played those games, and you remember nothing of them. What they changed for good is on the board and in whatever records the game keeps. Finding out where the campaign stands is part of your review.`
			: 'This is the first game of the campaign. Nothing has been played. The table has agreed to start with January and to skip the Prologue.',
		'',
		isLead
			? '**You are the lead this game.** The steps that are for the whole table are yours to press. Ask the table before you decide anything that spends or commits something, and tell them what you learn when the game presents something new.'
			: `**${lead.name} is the lead this game** and presses the steps that are for the whole table. You do your own part of each, play your turns, answer what the screen asks of you, and tell the lead what you think.`,
		'',
		...(suggestions.length
			? [
					'## Not yet seen in this campaign',
					'',
					'Nobody has done these yet. Do them if a real chance comes up, and say how the screen handled it:',
					'',
					...suggestions.map(line => `- ${line}`),
					'',
				]
			: []),
		'## Rules of the session',
		'',
		'- Keep going until `wait` says **SESSION COMPLETE**. That comes after the game ends and the spending after it is finished. The others can take several minutes over a turn. Keep running `wait`, and use the time to explore your screen. Do not stop early for any reason short of the lab not answering three times in a row.',
		'- Play to win, in character, and review as you go. Both matter.',
		'- `say` your plan before each of your turns.',
		'- `report` every finding the moment you meet it.',
		'',
		'## When the session is complete',
		'',
		`Run \`myreports\`, then write your review to \`${report}\`. Write it for the people who build the game. Be specific and be honest: no praise to be polite, no complaint to fill a section.`,
		'',
		'1. **The game in five lines**: who you played, what happened, how it ended.',
		'2. **Could a new player play this?** What you understood at once, what took you a while, what you never worked out. How you learned where the campaign stands and what was new this month.',
		'3. **Friction, worst first**: each thing that was slow, annoying or took too many steps. What you were doing, what it took, what it should take.',
		'4. **Inconsistencies**: the same thing behaving or looking different in two places.',
		'5. **How it looks**: layout, legibility, hierarchy, colour, motion. What works and what does not, with positions on the screen.',
		'6. **Bugs**: what was wrong, and how to see it again.',
		'7. **What you explored**: every panel, tool and way of doing things you found, and what you could not find or did not get to.',
		'8. **Your five best suggestions**, in order of how much they would improve the game.',
		'9. **Scores out of 10** for: learning it, the speed of playing a turn, knowing what is going on, and looks. One line of reason each.',
		'',
		'Then reply with a ten-line summary: the result, your worst three findings, your best suggestion, and anything that stopped you playing properly.',
		'',
	].join('\n');
}

/** Writes one brief per player for the game about to start and returns the paths. */
export function writeBriefs(input: BriefInput): string[] {
	const { config, state, audit } = input;
	const { campaign } = state.world;
	const month = monthName(campaign.month === 0 ? 1 : campaign.month);
	const attempt = campaign.month === 0 ? 1 : campaign.attempt;
	const game = `${month}, ${attempt === 1 ? 'first' : 'second'} attempt`;
	const lead = config.players[input.leadIndex]!;
	const suggestions = toTry(audit, state);
	const history = campaign.results
		.filter(result => result.month > 0)
		.map(
			result =>
				`${monthName(result.month)}${result.attempt === 2 ? ' (second attempt)' : ''}: ${result.won ? 'won' : 'lost'}`,
		);
	return config.players.map((player, index) => {
		const others = config.players.filter(other => other.id !== player.id).map(other => other.name);
		const slug = `g${String(campaign.results.length).padStart(2, '0')}-${month.toLowerCase()}-${attempt}`;
		const report = join(input.reports, `${slug}-${player.id}.md`);
		const isLead = index === input.leadIndex;
		if (player.harness === 'screen') {
			const text = screenBrief({
				player,
				others,
				game,
				lead,
				isLead,
				history,
				suggestions,
				report,
				month: campaign.month,
			});
			const path = join(input.dir, `${player.id}.md`);
			writeFileSync(path, text);
			return path;
		}
		const text = [
			`# Brief for ${player.name}: ${game}`,
			'',
			`You are **${player.name}**, one of three players in a year-long co-op campaign. The other two are ${others.join(' and ')}. You are playing the whole year, January to December, one game per session. This session is **${game}**.`,
			'',
			'Read these three files first, in this order:',
			'',
			`1. The player guide: \`${join(labRoot, 'GUIDE.md')}\``,
			`2. Who you are: \`${player.persona}\``,
			`3. What you remember from earlier games: \`${player.memory}\``,
			'',
			'## Your command',
			'',
			'Run every command from the repo root:',
			'',
			'```',
			`cd ${repoRoot}`,
			`./apps/playtest/play ${player.id} <command>`,
			'```',
			'',
			`Your id is \`${player.id}\`. Your seat is \`seat-${index + 1}\`. ${player.harness === 'ui' ? 'This run you play through the real screen: `look` lists what is on screen with numbered controls, `click <number>` presses one, `choose <number> <entry>` picks from a drop-down, `tap <city-id>` clicks a city on the map. You may still read `status`, `board` and `options`, but `do` is off for you.' : 'You send commands with `do <key>`, using the exact keys that `options` lists.'}`,
			'',
			'## This session',
			'',
			history.length ? `The year so far: ${history.join(', ')}.` : 'This is the first game of the year.',
			'',
			...(player.harness === 'ui'
				? [
						isLead
							? `**You are the lead this game.** You press the buttons that move the table along: the button that closes a Legacy briefing, supply placement, event picks, the button that ends the game, the purchases, and the button that finishes the game-end step. Ask the table before you spend. Tell the table what each Legacy briefing unlocked.`
							: `**${lead.name} is the lead this game** and presses the setup and game-end buttons. You ready up in the lobby, play your turns, answer choices that are yours, and tell the lead what you want bought.`,
						'',
						'Everything goes through the screen. `look` shows the text on screen and numbers every control. `click <number>` presses a button, `type <number> <text>` fills a field, `choose <number> <entry>` picks from a drop-down, `tap <city-id>` clicks a city on the map, `key <key>` presses a key such as Escape. The numbers change whenever the screen changes, so `look` again before each click. In the lobby you are seated as you arrive. Before the campaign begins, everyone presses Prologue or January, and the one you all press is chosen. Then, and before every later month, the lobby shows every character card: click one to take it, or make a new one with the New character card. Press Ready; the game starts once everyone has, and each of you plays the character you took, or the one you played last, or a new one named after you. `status`, `board`, `options` and `chars` still work for reading. `do`, `create` and `pick` are off.',
						'',
						'If something the game should let you do has no control on screen, `report` it as a bug: that is exactly what this run is looking for.',
						'',
					]
				: [
						isLead
							? `**You are the lead this game.** You send the setup and game-end commands: \`do begin\` if the campaign has not started, \`do start\` once all three have picked a character, \`do ack\` after reading a Legacy briefing, supply placement, event picks, \`do continue\` when the game ends, the purchases, and \`do finish-upkeep\`. Ask the table before you spend. Tell the table what each Legacy briefing unlocked.`
							: `**${lead.name} is the lead this game** and sends the setup and game-end commands. You pick your character, play your turns, answer choices that are yours, and tell the lead what you want bought.`,
						'',
						'In the lobby, choose who you play: `chars` lists the characters and the open jobs, `create <job> <haven-id> <name>` makes a new one, `pick <character-id>` takes one. You do not have to play the same character every game.',
						'',
					]),
			...(input.stage
				? [
						'## This game is staged',
						'',
						...input.stage.table.map(line => `- ${line}`),
						'',
						'Your list, in order:',
						'',
						...(input.stage.seats[index] ?? []).map((line, at) => `${at + 1}. ${line}`),
						'',
						'Say in chat when your list is done, and `report` anything on it that the game refused or that worked differently from what the list says.',
						'',
					]
				: []),
			...(suggestions.length
				? [
						'## Worth trying this game',
						'',
						'The run exists to exercise every part of the game. These have not been touched yet:',
						'',
						...suggestions.map(line => `- ${line}`),
						'',
					]
				: []),
			'## Rules of the session',
			'',
			'- Keep going until `wait` or `status` says **SESSION COMPLETE**. That comes after the game ends and the game-end spending is finished. A turn can take the others a few minutes. Keep running `wait`. Do not stop early for any reason short of the lab not answering three times in a row.',
			input.stage
				? '- Play in character. Your list comes first, winning second.'
				: '- Play in character, and play to win.',
			player.harness === 'ui'
				? '- Before each move, `say` one sentence on why you are making it. The game is recorded, and the replay shows the table talk beside each move.'
				: '- End every `do` with `why:` and one sentence of reasoning. The game is recorded, and the replay shows your reason beside each move.',
			'- `report` every bug, rule surprise and rough edge the moment you meet it.',
			'- Do not open or edit any file other than the three above and your report file. Do not look at source code. Do not run any command other than `./apps/playtest/play`.',
			'',
			'## When the session is complete',
			'',
			`1. Write your report to \`${report}\`: what happened in the game in five lines, every problem you met (what you did, what you expected, what happened), anything about the rules you were unsure of, and which new mechanics you used.`,
			`2. Rewrite your memory file \`${player.memory}\`. Keep it under 80 lines. Keep what will change how you play next game and prune the rest.`,
			'3. Reply with a five-line summary: result, your character, what you tried that was new, the worst problem you hit, and one thing you would do differently.',
			'',
		].join('\n');
		const path = join(input.dir, `${player.id}.md`);
		writeFileSync(path, text);
		return path;
	});
}
