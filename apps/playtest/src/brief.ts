import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pack } from '@repo/game';
import type { PublicState } from '@repo/game';
import { untouched } from './audit.ts';
import type { Audit } from './audit.ts';
import type { LabConfig } from './config.ts';
import { labRoot, repoRoot } from './config.ts';
import { monthName } from './names.ts';

type BriefInput = {
	config: LabConfig;
	state: PublicState;
	audit: Audit;
	dir: string;
	reports: string;
	leadIndex: number;
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
	const unopened = pack.reconRoutes.filter(
		route => campaign.routes.includes(route.id) && !campaign.opened.includes(route.opens),
	);
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
			isLead
				? `**You are the lead this game.** You send the setup and game-end commands: \`do begin\` if the campaign has not started, \`do start\` once all three have picked a character, \`do ack\` after reading a Legacy briefing, supply placement, event picks, \`do continue\` when the game ends, the purchases, and \`do finish-upkeep\`. Ask the table before you spend. Tell the table what each Legacy briefing unlocked.`
				: `**${lead.name} is the lead this game** and sends the setup and game-end commands. You pick your character, play your turns, answer choices that are yours, and tell the lead what you want bought.`,
			'',
			'In the lobby, choose who you play: `chars` lists the characters and the open jobs, `create <job> <haven-id> <name>` makes a new one, `pick <character-id>` takes one. You do not have to play the same character every game.',
			'',
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
			'- Play in character, and play to win.',
			'- End every `do` with `why:` and one sentence of reasoning. The game is recorded, and the replay shows your reason beside each move.',
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
