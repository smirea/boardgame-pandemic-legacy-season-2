#!/usr/bin/env bun
/**
 * The playtest lab's long-running process. It builds and serves the app, runs the signaling Worker,
 * opens one browser tab per player, and answers the `play` and `lab` command lines over HTTP.
 * Every command goes through the player's own tab, so the real session and network code carry it.
 */
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	actionBriefs,
	gameIndexOf,
	legalPlays,
	newCampaign,
	newTable,
	openings,
	overLimit,
	parseRecord,
	parseSave,
	recordStep,
	reject,
	ruleBriefs,
	startRecord,
} from '@repo/game';
import type { CharacterId, Command, GameRecord, PublicState, RecordNote, Save, SeatId } from '@repo/game';
import { newAudit, observe, renderParity, untouched } from './audit.ts';
import type { Audit, Issue } from './audit.ts';
import { writeBriefs } from './brief.ts';
import { composite, heldUnplayable, mayRaw, optionsFor, parseVerb, seatOf } from './commands.ts';
import type { Who } from './commands.ts';
import { loadConfig, repoRoot } from './config.ts';
import { coverageOfRun } from './coverage.ts';
import { recordFile, replaysUrl, servePages } from './replays.ts';
import {
	clickAt,
	closeTool,
	dragTo,
	holdKey,
	moveTo,
	point,
	pressCombo,
	scrollAt,
	shot,
	typeText,
	VIEW,
	zoom,
} from './screen.ts';
import { labScenarios, stages } from './stages.ts';
import type { RecordMeta } from './replays.ts';
import { isCity, monthName } from './names.ts';
import {
	renderBoard,
	renderCity,
	renderDecks,
	renderHeader,
	renderLobby,
	renderLog,
	renderOptions,
	renderStatus,
} from './render.ts';
import {
	chooseOption,
	click,
	connection,
	lastHostStep,
	launch,
	loadSave,
	look,
	openTab,
	pressKey,
	readState,
	sendCommand,
	tapCity,
	typeInto,
} from './tabs.ts';
import type { Tab } from './tabs.ts';

const argv = process.argv.slice(2);
const configPath = argv.find(arg => !arg.startsWith('--'));
if (!configPath) throw new Error('usage: daemon.ts <config.json> [--fresh] [--no-build]');
const config = loadConfig(configPath);
const { runDir } = config;
const dirs = {
	saves: join(runDir, 'saves'),
	shots: join(runDir, 'shots'),
	briefs: join(runDir, 'briefs'),
	reports: join(runDir, 'reports'),
	records: join(runDir, 'records'),
	screens: join(runDir, 'screens'),
};
for (const dir of Object.values(dirs)) mkdirSync(dir, { recursive: true });

const files = {
	latest: join(dirs.saves, 'latest.json'),
	audit: join(runDir, 'audit.json'),
	lab: join(runDir, 'lab-state.json'),
	journal: join(runDir, 'journal.jsonl'),
	issues: join(runDir, 'issues.jsonl'),
	parity: join(runDir, 'parity.md'),
	pid: join(runDir, 'daemon.json'),
};

type LabState = {
	/** The game the current briefs were written for, by its index in the campaign's results. */
	session: { startIndex: number; at?: string } | null;
	picks: (CharacterId | null)[];
	chat: { at: string; from: string; text: string }[];
	chatSeen: Record<string, number>;
	logSeen: Record<string, { game: number; seq: number }>;
	/** Games whose table the configured stage has already arranged. */
	staged?: number[];
};

const readJson = <T>(path: string, fallback: T): T =>
	existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
const fresh = argv.includes('--fresh');
const lab: LabState = fresh
	? { session: null, picks: config.players.map(() => null), chat: [], chatSeen: {}, logSeen: {} }
	: readJson<LabState>(files.lab, {
			session: null,
			picks: config.players.map(() => null),
			chat: [],
			chatSeen: {},
			logSeen: {},
		});
const audit: Audit = fresh ? newAudit() : readJson<Audit>(files.audit, newAudit());
const stageOf = config.start.stage ? stages[config.start.stage] : null;
if (config.start.stage && !stageOf) throw new Error(`unknown stage "${config.start.stage}"`);
if (!existsSync(files.audit))
	for (const run of config.start.coverage ?? [])
		for (const [key, count] of Object.entries(coverageOfRun(run).audit.exercised))
			audit.exercised[key] = (audit.exercised[key] ?? 0) + count;
const persist = () => {
	writeFileSync(files.lab, JSON.stringify(lab, null, '\t'));
	writeFileSync(files.audit, JSON.stringify(audit));
};
const journal = (entry: Record<string, unknown>) =>
	appendFileSync(files.journal, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
const issues = (): Issue[] =>
	existsSync(files.issues)
		? readFileSync(files.issues, 'utf8')
				.split('\n')
				.filter(Boolean)
				.map(line => JSON.parse(line) as Issue)
		: [];

function startingSave(): Save {
	if (!fresh && existsSync(files.latest)) return parseSave(JSON.parse(readFileSync(files.latest, 'utf8')));
	if (config.start.save) return parseSave(JSON.parse(readFileSync(config.start.save, 'utf8')));
	if (config.start.scenario) {
		const scenario = labScenarios[config.start.scenario as keyof typeof labScenarios];
		if (!scenario) throw new Error(`unknown scenario "${config.start.scenario}"`);
		return scenario(config.seed);
	}
	return { v: 1, phase: 'lobby', world: { campaign: newCampaign(config.seed), game: null, table: newTable() } };
}
const initialSave = startingSave();

const uiDir = join(repoRoot, 'apps/ui');
if (!argv.includes('--no-build')) {
	console.log('building the app');
	await Bun.$`bun run build`.cwd(uiDir).quiet();
}
const envFile = (name: string) => (existsSync(join(repoRoot, name)) ? readFileSync(join(repoRoot, name), 'utf8') : '');
// env-manager quotes the values it writes to `.env.local`.
const built = (
	envFile('.env.local').match(/^SIGNAL_URL=['"]?([^\s'"]+)/m) ?? envFile('.env').match(/^SIGNAL_URL=['"]?([^\s'"]+)/m)
)?.[1];
if (built !== `http://127.0.0.1:${config.signalPort}`)
	throw new Error(
		`the app is built for the signaling server at ${built}, but this run wants port ${config.signalPort}`,
	);

const pages = servePages(config.port);

const wranglerLog: string[] = [];
const wrangler = Bun.spawn(
	[
		'bun',
		'x',
		'wrangler',
		'dev',
		'--ip',
		'127.0.0.1',
		'--port',
		String(config.signalPort),
		'--var',
		`SIGNAL_SECRET:${config.passphrase}`,
		'--persist-to',
		mkdtempSync(join(tmpdir(), 'playtest-signal-')),
		'--show-interactive-dev-session=false',
		'--log-level',
		'warn',
	],
	{
		cwd: join(repoRoot, 'apps/signal'),
		stdout: 'pipe',
		stderr: 'pipe',
		env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
	},
);
for (const stream of [wrangler.stdout, wrangler.stderr])
	void (async () => {
		for await (const chunk of stream) wranglerLog.push(new TextDecoder().decode(chunk));
	})();
for (const deadline = performance.now() + 60_000; ;) {
	const response = await fetch(`http://127.0.0.1:${config.signalPort}/`).catch(() => null);
	if (response?.status === 426) break;
	if (wrangler.exitCode !== null || performance.now() > deadline)
		throw new Error(`the signaling Worker did not start:\n${wranglerLog.join('')}`);
	await Bun.sleep(200);
}

await Bun.$`bun x playwright install chromium-headless-shell`.cwd(uiDir).quiet();
// A browser each: pages that share one take turns drawing, and a page that is not drawing freezes its animations.
const browsers: Awaited<ReturnType<typeof launch>>[] = [];
const tabUrl = (id: string) => `http://127.0.0.1:${pages.port}/?DEBUG_ID=${config.run}-${id}`;
const tabs: Tab[] = [];
/** The id the starting save knows this player by. A browser is new every time the lab starts, and the player is not. */
const identityOf = (player: { id: string; name: string }) => {
	const seat = initialSave.world.table.seats.find(entry => entry.name === player.name);
	return seat ? { key: `legacy-DEBUG_ID=${config.run}-${player.id}:playerId`, player: seat.player } : undefined;
};
for (const [index, player] of config.players.entries()) {
	browsers.push(await launch(config.headed, player.harness === 'desktop' ? player.id : undefined));
	tabs.push(
		await openTab(browsers.at(-1)!.context, {
			id: player.id,
			url: tabUrl(player.id),
			name: player.name,
			passphrase: config.passphrase,
			host: index === 0,
			identity: identityOf(player),
			onError: text => journal({ kind: 'tab-error', agent: player.id, text }),
		}),
	);
	if (index === 0) await loadSave(tabs[0]!, initialSave);
}
const host = tabs[0]!;

let current: PublicState | null = null;
let currentRaw = '';
let chain: Promise<unknown> = Promise.resolve();
const locked = <T>(run: () => Promise<T>): Promise<T> => {
	const next = chain.then(run, run);
	chain = next.catch(() => {});
	return next;
};

const gameIndex = (state: PublicState) => state.world.campaign.results.length;
const tag = (state: PublicState) =>
	`g${String(gameIndex(state)).padStart(2, '0')}-m${String(state.world.campaign.month).padStart(2, '0')}a${state.world.campaign.attempt}`;

const metaFile = join(dirs.records, 'meta.json');
const recordMeta = readJson<Record<string, RecordMeta>>(metaFile, {});
let recording: GameRecord | null = null;
/** Notes made before the game they belong to has its first step. */
let earlyNotes: RecordNote[] = [];

function saveRecording() {
	if (!recording) return;
	const index = gameIndexOf(recording.initial);
	const key = recordFile(index).slice(0, -5);
	writeFileSync(join(dirs.records, recordFile(index)), JSON.stringify(recording));
	const game = current?.world.game;
	const players =
		game && current && gameIndex(current) === index
			? game.seats.map((seat, at) => {
					const character = current!.world.campaign.characters[game.players[seat]!.character];
					return {
						name: config.players[at]?.name ?? seat,
						character: character?.name ?? seat,
						job: character?.job ?? 'none',
					};
				})
			: (recordMeta[key]?.players ?? []);
	recordMeta[key] = {
		id: recording.id,
		steps: recording.steps.length,
		startedAt: recording.startedAt,
		endedAt: recording.steps.at(-1)?.at ?? recording.startedAt,
		players,
	};
	writeFileSync(metaFile, JSON.stringify(recordMeta));
}

/** Adds one state change to the recording of the game it belongs to. A restarted lab picks its recording back up. */
function remember(previous: PublicState, next: PublicState, command: Command | null, by: string | null) {
	const index = gameIndex(previous);
	if (!recording || gameIndexOf(recording.initial) !== index) {
		const file = join(dirs.records, recordFile(index));
		recording = existsSync(file)
			? parseRecord(JSON.parse(readFileSync(file, 'utf8')))
			: startRecord(previous, Date.now());
		recording.notes.push(...earlyNotes);
		earlyNotes = [];
	}
	if (recordStep(recording, previous, next, { at: Date.now(), by, command })) saveRecording();
}

function note(kind: RecordNote['kind'], by: string, text: string) {
	const entry: RecordNote = { at: Date.now(), by, kind, text };
	if (recording && current && gameIndexOf(recording.initial) === gameIndex(current)) {
		recording.notes.push(entry);
		saveRecording();
	} else earlyNotes.push(entry);
}

async function ingest(next: PublicState, raw: string, sent: Command | null, agent: string | null) {
	// A change that came from a click has no command here, but the host tab recorded what the click sent and who sent it.
	const clicked = sent ? null : await lastHostStep(host).catch(() => null);
	const command = sent ?? clicked?.command ?? null;
	const previous = current;
	current = next;
	currentRaw = raw;
	observe(audit, previous, next, command);
	// Once a game is under way the seats are whoever it started with, whatever anyone picked since.
	if (next.world.game)
		lab.picks = config.players.map((_, index) => next.world.game!.players[seatOf(index)]?.character ?? null);
	if (previous)
		remember(previous, next, command, config.players.find(player => player.id === agent)?.name ?? clicked?.by ?? null);
	const save: Save = { v: 1, phase: next.phase, world: next.world };
	writeFileSync(files.latest, JSON.stringify(save));
	if (command)
		journal({
			kind: 'command',
			agent: agent ?? clicked?.by ?? null,
			via: sent ? 'key' : 'click',
			phase: previous?.phase,
			command,
		});
	const seen =
		previous?.world.game && gameIndex(previous) === gameIndex(next) ? (previous.world.game.log.at(-1)?.seq ?? -1) : -1;
	for (const entry of next.world.game?.log ?? [])
		if (entry.seq > seen)
			journal({ kind: 'log', game: gameIndex(next), seq: entry.seq, text: renderLog(next.world, entry), entry });
	if (!previous || previous.phase !== next.phase || gameIndex(previous) !== gameIndex(next)) {
		const name = `${tag(next)}-${next.phase}`;
		const firstOfPhase = !existsSync(join(dirs.saves, `${name}.json`));
		if (firstOfPhase) writeFileSync(join(dirs.saves, `${name}.json`), JSON.stringify(save));
		journal({
			kind: 'phase',
			from: previous?.phase ?? null,
			to: next.phase,
			month: next.world.campaign.month,
			attempt: next.world.campaign.attempt,
		});
		writeFileSync(files.parity, renderParity(audit, next.world, issues()));
		if (firstOfPhase) await host.page.screenshot({ path: join(dirs.shots, `${name}.png`) }).catch(() => {});
	}
	persist();
}

async function refresh(command: Command | null = null, agent: string | null = null): Promise<boolean> {
	const raw = await readState(host);
	if (raw === currentRaw || raw === 'null') return false;
	await ingest(JSON.parse(raw) as PublicState, raw, command, agent);
	await stageIfDue();
	return true;
}

/** Arranges the table once per game, the moment setup hands over to the first action step. */
async function stageIfDue() {
	const state = current;
	const game = state?.world.game;
	if (!stageOf || !state || !game || state.phase !== 'playing.actions' || game.turn !== 1) return;
	const index = gameIndex(state);
	if (lab.staged?.includes(index)) return;
	lab.staged = [...(lab.staged ?? []), index];
	const stage = stageOf(state.world);
	const world = structuredClone(state.world);
	stage.apply(world);
	await loadSave(host, { v: 1, phase: state.phase, world });
	const raw = await readState(host);
	await ingest(JSON.parse(raw) as PublicState, raw, null, null);
	note('note', 'lab', stage.summary);
	journal({ kind: 'stage', stage: config.start.stage, text: stage.summary });
	lab.chat.push({
		at: new Date().toISOString(),
		from: 'lab',
		text: `TABLE STAGED. ${stage.summary} Run status and options again.`,
	});
	persist();
}

const sessionDone = (state: PublicState) =>
	lab.session !== null &&
	gameIndex(state) > lab.session.startIndex &&
	(state.phase === 'lobby' || state.phase === 'finished');

/** Players who know the game only by looking at it, whoever takes the pictures. */
const sees = (index: number) => ['screen', 'desktop'].includes(config.players[index]!.harness);

function whoOf(id: string): Who | null {
	const index = config.players.findIndex(player => player.id === id);
	if (index < 0) return null;
	const leadIndex = (lab.session?.startIndex ?? (current ? gameIndex(current) : 0)) % config.players.length;
	const name = config.players[index]!.name;
	// A player on the screen sits where the lobby put them, which is seat order only while nobody has moved.
	const seat = sees(index)
		? (current?.world.table.seats.find(entry => entry.name === name)?.seat ?? seatOf(index))
		: seatOf(index);
	return { index, id, name, seat, lead: index === leadIndex };
}

/** Who plays whom. A click-only player is dealt a character when the table readies, so has no pick before. */
const lobbyPicks = () =>
	config.players.map((player, index) => ({ name: player.name, character: lab.picks[index] ?? null }));

/** The same needs, worded for a player who may only use the screen. */
const forScreen = (line: string) =>
	line.replaceAll(/`do [^`]+`/g, 'the matching control on screen (`look` lists them)');

/** What the game is waiting on this player for. Empty means it is someone else's move. */
function needs(state: PublicState, who: Who): string[] {
	const harness = config.players[who.index]!.harness;
	if (sees(who.index)) return needsOnScreen(state, who);
	const lines = needsByKey(state, who);
	return harness === 'ui' ? lines.map(forScreen) : lines;
}

const TABLE_CHOICE = 'A CHOICE IS OPEN TO THE TABLE.';

const SESSION_COMPLETE =
	'SESSION COMPLETE. This game and its game-end step are finished. Write your report now, then stop.';

/**
 * Whether the table waits on a player who has only the screen. It says that much and no more:
 * what to do about it is for the screen to tell them.
 */
function needsOnScreen(state: PublicState, who: Who): string[] {
	if (sessionDone(state)) return [SESSION_COMPLETE];
	const { world, phase } = state;
	const { campaign, table } = world;
	const yours = 'The table is waiting on you. Look at your screen.';
	const lead = 'The table is waiting on you: this step is for the whole table, and you are this game’s lead.';
	const me = table.seats.find(entry => entry.name === who.name)?.player ?? null;
	if (phase === 'finished') return ['The campaign is over. Write your report now, then stop.'];
	if (campaign.briefing.length && phase !== 'lobby') {
		if (table.briefing.stowing) return [];
		const opened = table.briefing.drawn >= openings(campaign.briefing).length && table.briefing.flipped;
		if (!opened) return who.lead ? [lead] : [];
		return me && table.briefing.ready.includes(me) ? [] : [yours];
	}
	switch (phase) {
		case 'lobby':
			return me && table.ready[me] !== undefined ? [] : [yours];
		case 'setup.supply':
		case 'setup.infect':
		case 'setup.events':
		case 'over':
		case 'upkeep':
			return who.lead ? [lead] : [];
		default: {
			// A choice open to the table is the active player's to pass, and anyone's who holds a card that answers it.
			const answers = world.game?.active === who.seat || legalPlays(world, phase).some(play => play.seat === who.seat);
			return needsByKey(state, who).some(line => answers || !line.startsWith(TABLE_CHOICE)) ? [yours] : [];
		}
	}
}

function needsByKey(state: PublicState, who: Who): string[] {
	const { world, phase } = state;
	const { campaign, game } = world;
	if (sessionDone(state))
		return [
			'SESSION COMPLETE. This game and its game-end step are finished. Write your report and memory file now, then stop.',
		];
	const out: string[] = [];
	if (campaign.briefing.length && who.lead)
		out.push('LEAD: read the Legacy briefing in `status`, tell the table what changed with `say`, then `do ack`.');
	const allPicked = lab.picks.every(
		pick => pick !== null && campaign.characters[pick] && !campaign.characters[pick]!.dead,
	);
	switch (phase) {
		case 'lobby':
			if (config.players[who.index]!.harness === 'ui') {
				out.push('Ready up on screen: everyone picks the same game, then takes a character and presses Ready.');
				break;
			}
			if (!lab.picks[who.index] || campaign.characters[lab.picks[who.index]!]?.dead)
				out.push(
					'Choose your character for this game: `pick <character-id>`, or `create <job> <haven-id> <name>` and then pick it.',
				);
			if (who.lead && campaign.month === 0) out.push('LEAD: `do begin` leaves the prologue and starts January.');
			else if (who.lead && allPicked) out.push('LEAD: everyone has picked. `do start`.');
			break;
		case 'setup.supply':
			if (who.lead)
				out.push('LEAD: place the supply cubes (`supply <city> <n>`, `do autosupply`), then `do confirm-supply`.');
			break;
		case 'setup.infect':
			if (who.lead)
				out.push(
					`LEAD: flip the ${game?.infectionsLeft ?? 0} Infection card(s) that open the game, one at a time, with \`do infect\`.`,
				);
			break;
		case 'setup.events':
			if (who.lead) out.push('LEAD: pick the Rationed Events (`events <card> ...`), then `do confirm-events`.');
			break;
		case 'playing.actions':
		case 'playing.draw':
		case 'playing.infect': {
			if (!game) break;
			const pending = game.pending[0];
			if (pending) {
				const owner = 'seat' in pending ? pending.seat : null;
				if (owner === who.seat) out.push('A CHOICE IS WAITING ON YOU. See `options decide`.');
				if (owner === null)
					out.push(`${TABLE_CHOICE} See \`options decide\`. The active player passes with \`do decide:skip\`.`);
			}
			if (
				optionsFor(state, who, lab.picks).some(option => option.key.startsWith('decide:discard')) &&
				pending?.t !== 'discard'
			)
				out.push(
					'You are over your hand limit. Discard with the exact key from `options decide`, which names your seat and the card.',
				);
			// While another player owes the game a discard or a choice, the active player can do nothing, so nothing needs them.
			if (game.active === who.seat && !blockedBy(state, who)) {
				const step =
					phase === 'playing.actions'
						? `YOUR TURN: ${game.actionsLeft} action(s) left. \`do <key> ...\`, then \`do end\`.`
						: phase === 'playing.draw'
							? reject(world, phase, { type: 'DRAW' }) === null
								? `YOUR TURN: draw ${game.drawsLeft} card(s) with \`do draw\`.`
								: null
							: reject(world, phase, { type: 'INFECT' }) === null
								? `YOUR TURN: flip ${game.infectionsLeft} Infection card(s) with \`do infect\`.`
								: null;
				if (step) out.push(step);
			}
			break;
		}
		case 'over':
			if (who.lead) out.push('LEAD: the game is over. `do continue` opens the game-end step.');
			break;
		case 'upkeep':
			if (who.lead)
				out.push('LEAD: spend the production units (`options buy`), then `do finish-upkeep`. Ask the table first.');
			break;
		case 'finished':
			out.push('The campaign is over. Write your report and memory file, then stop.');
			break;
	}
	return out;
}

/** Unlocked actions with nothing legal right now, so a player can tell locked from not-possible-here. */
function idleActions(state: PublicState, who: Who): string[] {
	const listed = new Set(optionsFor(state, who, lab.picks).map(option => option.group));
	const idle = state.world.campaign.actions.filter(action => !listed.has(action));
	return idle.length
		? [
				`Unlocked, but not possible where you stand with what you hold: ${idle.join(', ')}. (Base costs, before any ability or job lowers them: a supply line, sea lane or tower takes 2 cubes from your character, a supply center takes 5 cards of the city's colour, and a shelter takes 1 card of the city's colour. The actions command says what each one does.)`,
			]
		: [];
}

/** Why the game cannot move on, when the reason is another player's to clear. */
function blockedBy(state: PublicState, who: Who): string | null {
	const { world } = state;
	const game = world.game;
	if (!game || !state.phase.startsWith('playing')) return null;
	const name = (seat: SeatId) => world.campaign.characters[game.players[seat]!.character]?.name ?? seat;
	const pending = game.pending[0];
	if (pending && 'seat' in pending && pending.seat && pending.seat !== who.seat)
		return `the game waits on ${name(pending.seat)} to answer a choice (${pending.t}). Nothing else can happen until they do.`;
	const over = overLimit(world).filter(seat => seat !== who.seat);
	if (over.length)
		return `${over.map(name).join(' and ')} must discard down to the hand limit before the turn can go on. Tell them with \`say\`. Do not undo.`;
	return null;
}

function digest(state: PublicState, who: Who): string[] {
	const lines: string[] = [];
	const from = lab.chatSeen[who.id] ?? 0;
	const unread = lab.chat.slice(from).filter(message => message.from !== who.name);
	lab.chatSeen[who.id] = lab.chat.length;
	if (unread.length) lines.push('TABLE TALK:', ...unread.map(message => `  ${message.from}: ${message.text}`));
	const game = state.world.game;
	if (sees(who.index)) {
		const list = needs(state, who);
		lines.push(...(list.length ? list : ['Nothing is waiting on you right now.']));
		return lines;
	}
	if (game) {
		const seen = lab.logSeen[who.id];
		const after = seen && seen.game === gameIndex(state) ? seen.seq : -1;
		const fresh = game.log.filter(entry => entry.seq > after);
		if (fresh.length)
			lines.push('SINCE YOU LAST LOOKED:', ...fresh.slice(-40).map(entry => `  ${renderLog(state.world, entry)}`));
		lab.logSeen[who.id] = { game: gameIndex(state), seq: game.log.at(-1)?.seq ?? -1 };
	}
	const list = needs(state, who);
	lines.push(list.length ? 'NEEDS YOU:' : 'Nothing needs you right now.', ...list.map(text => `  ${text}`));
	const holdup = blockedBy(state, who);
	if (holdup) lines.push(`HELD UP: ${holdup}`);
	return lines;
}

const NO_CHANGE = 'nothing changed, which means it was already so';

async function reconnect(tab: Tab) {
	await tab.page.reload();
	await tab.page.waitForFunction('Boolean(window.DEBUG && window.DEBUG.getState())', null, { timeout: 30_000 });
	journal({ kind: 'tab-reload', agent: tab.id });
}

async function send(who: Who, command: Command): Promise<string | null> {
	await refresh();
	const state = current!;
	const reason =
		command.type === 'UNDO' && !state.canUndo ? 'Nothing to undo' : reject(state.world, state.phase, command);
	if (reason) {
		journal({ kind: 'rejected', agent: who.id, command, reason });
		return reason;
	}
	const tab = tabs[who.index]!;
	let local = await sendCommand(tab, command);
	if (local) {
		const link = await connection(tab);
		if (!link || link.status !== 'connected' || link.fatal) await reconnect(tab);
		else await Bun.sleep(500);
		local = await sendCommand(tab, command);
		if (local) {
			journal({ kind: 'tab-rejected', agent: who.id, command, reason: local });
			return `your tab refused it: ${local}`;
		}
	}
	for (let tries = 0; tries < 50; tries++) {
		if (await refresh(command, who.id)) return null;
		await Bun.sleep(100);
	}
	journal({ kind: 'no-change', agent: who.id, command });
	return NO_CHANGE;
}

async function doKeys(who: Who, keys: string[]): Promise<string> {
	const lines: string[] = [];
	for (const key of keys) {
		await refresh();
		const state = current!;
		const offered = optionsFor(state, who, lab.picks);
		const several = composite(offered, key);
		const option = offered.find(candidate => candidate.key === key) ?? (several ? { command: several } : undefined);
		if (!option) {
			lines.push(`STOPPED at "${key}": not one of your options right now. Run \`options\` to see the exact keys.`);
			break;
		}
		const before = state.world.game?.log.at(-1)?.seq ?? -1;
		const sameGame = gameIndex(state);
		const reason = await send(who, option.command);
		if (reason) {
			lines.push(`STOPPED at "${key}": ${reason}`);
			break;
		}
		lines.push(`ok ${key}`);
		const game = current!.world.game;
		if (game && gameIndex(current!) === sameGame)
			for (const entry of game.log) if (entry.seq > before) lines.push(`   ${renderLog(current!.world, entry)}`);
		if (game) lab.logSeen[who.id] = { game: gameIndex(current!), seq: game.log.at(-1)?.seq ?? -1 };
	}
	lines.push('', renderHeader(current!), ...digest(current!, who));
	return lines.join('\n');
}

function report(who: Who | null, agent: string, severity: string, text: string): string {
	const state = current!;
	const count = issues().length + 1;
	const saved = join(dirs.saves, `issue-${String(count).padStart(3, '0')}.json`);
	writeFileSync(saved, JSON.stringify({ v: 1, phase: state.phase, world: state.world }));
	const issue: Issue & { save: string } = {
		at: new Date().toISOString(),
		agent: who?.name ?? agent,
		severity,
		text,
		month: state.world.campaign.month,
		attempt: state.world.campaign.attempt,
		phase: state.phase,
		turn: state.world.game?.turn ?? null,
		save: saved,
	};
	appendFileSync(files.issues, `${JSON.stringify(issue)}\n`);
	if (who && sees(who.index))
		void tabs[who.index]!.page.screenshot({ path: saved.replace(/\.json$/, '.png') }).catch(() => {});
	note('issue', issue.agent, `[${severity}] ${text}`);
	journal({ kind: 'issue', ...issue });
	return `Recorded issue ${count} with a save of this moment.`;
}

const HELP = `Commands (run as: ./play <you> <command>):
  status              the whole situation, table talk, and what needs you
  wait [seconds]      block until something needs you or someone speaks (default 45)
  options [filter]    every command you may send right now, by exact key
  do <key> [<key>..] why: <reason>   send commands in order; stops at the first that fails.
                      End every do with why: and one sentence on why you chose it
  board               every revealed location, by region, with links
  actions             what every action and rule unlocked this year does
  city <id>           one location in detail
  decks               discard piles and the known layers of the Infection deck
  log [n]             the last n log lines of this game
  chars               every character in the campaign
  say <text>          talk to the table
  listen [seconds]    block until another player speaks (for a lead waiting on answers before confirming)
  report <bug|rules|ux|idea> <text>   record an issue with a save of this moment
  create <job> <haven-id> <name>   make a new character (lobby)
  pick <character-id>              choose who you play this game (lobby)
  supply <city-id> <count>         place setup cubes by hand (lead)
  events <card> <card> ...         pick Rationed Events (lead)
  rename <haven-id> <name>         name a haven (lobby)
  A choice with several targets takes them joined by +, for example
    do play:safeHouses.241:cairo+lagos+london   or   do decide:removeHollow:tehran+riyadh
  raw '<json>'        send a command that options does not list
UI harness only: look · click <number|text> · tap <city-id> · choose <number> <entry> · type <number> <text> · key <key> · shot`;

const SCREEN_HELP = `You have the screen and nothing else. Run as: ./apps/playtest/play <you> <command>
  shot [seconds]          take a picture of your screen (after waiting that many seconds) and print its path.
                          The screen is ${VIEW.width} by ${VIEW.height}. A position is x across from the left edge and y down from the top
  shot grid               the same picture with a grid every 100 pixels, to check your aim
  zoom <x> <y> <w> <h>    a picture of that part of the screen at three times the size, for small print
  click <x> <y>           move the pointer there and click
  rclick <x> <y>          right click
  dblclick <x> <y>        double click
  move <x> <y>            rest the pointer there without clicking, as you would to read a tooltip
  drag <x1> <y1> <x2> <y2>   press at the first position, move to the second, let go
  scroll <x> <y> <amount>  turn the wheel there: a positive amount scrolls down, about 100 a notch
  key <key>               press a key: Escape, Enter, Space, Tab, ArrowLeft, a, 1, or a combination such as Shift+Tab
  keydown <key>           hold a key down, for what the game does while a key is held. It stays down until keyup <key>
  type <text>             type into whatever has the keyboard
  wait [seconds]          block until the table is waiting on you or someone speaks (default 45)
  say <text>              talk to the table, as you would out loud
  listen [seconds]        block until another player speaks
  report <bug|ux|visual|rules|idea> <text>   record a finding, with a picture of your screen at that moment
  myreports               the findings you have recorded this game
Every pointer and keyboard command answers with a new picture of the screen, taken half a second later.`;

const DESKTOP_HELP = `Your game is in a real browser window on this desktop, and you drive it with your own computer-use tool.
The lab gives you only these. Run as: ./apps/playtest/play <you> <command>
  window                  which window is yours: the app, its process id, its window id and where it is on the desktop
  focus                   take the desktop: blocks until no other player has it, then brings your window to the front.
                          It is yours for two minutes. Run it again to keep it
  release                 give the desktop up, the moment you stop using the pointer and keyboard
  wait [seconds]          block until the table is waiting on you or someone speaks (default 45)
  say <text>              talk to the table, as you would out loud
  listen [seconds]        block until another player speaks
  report <bug|ux|visual|rules|idea> <text>   record a finding, with a picture of your page at that moment
  myreports               the findings you have recorded this game`;

/** One desktop, one pointer, one keyboard: who has them, and until when unless they ask again. */
let desk: { id: string; until: number } | null = null;
const DESK_HOLD = 120_000;

const cua = async (tool: string, input: object) => {
	const run = Bun.spawn(['cua-driver', tool, JSON.stringify(input)], { stdout: 'pipe', stderr: 'pipe' });
	const text = await new Response(run.stdout).text();
	await run.exited;
	try {
		return JSON.parse(text) as Record<string, unknown>;
	} catch {
		return { error: text.trim() || 'cua-driver gave no answer' };
	}
};

/** The window of a player's own browser, found by the mark its process was launched with. */
async function windowOf(id: string) {
	const list = await Bun.$`ps -axo pid=,command=`.quiet().text();
	const line = list.split('\n').find(row => row.includes(`--playtest-player=${id}`) && !row.includes('--type='));
	const pid = Number(line?.trim().split(/\s+/)[0]);
	if (!pid) return null;
	type Listed = { window_id: number; title: string; bounds: { x: number; y: number; width: number; height: number } };
	const found = (await cua('list_windows', { pid })) as { windows?: Listed[] };
	const window = (found.windows ?? []).toSorted(
		(a, b) => b.bounds.width * b.bounds.height - a.bounds.width * a.bounds.height,
	)[0];
	return window ? { pid, ...window } : null;
}

/** The commands of a player who drives their own window: the lab only says which window, and whose turn the desktop is. */
async function handleDesktop(who: Who, verb: string): Promise<string> {
	switch (verb) {
		case 'help':
			return DESKTOP_HELP;
		case 'window': {
			const window = await windowOf(who.id);
			if (!window) return 'Your window is not open. Tell the operator.';
			const { x, y, width, height } = window.bounds;
			return `Your window: app "Google Chrome for Testing", pid ${window.pid}, window_id ${window.window_id}, titled "${window.title}". On the desktop its top left is at (${x}, ${y}) and it is ${width} by ${height} points. The game page is the part under the toolbar.`;
		}
		case 'focus': {
			for (const deadline = Date.now() + 45_000; ;) {
				if (!desk || desk.id === who.id || desk.until < Date.now()) break;
				if (Date.now() > deadline) {
					const holder = config.players.find(player => player.id === desk!.id)?.name;
					return `${holder} has the desktop. Run \`focus\` again.`;
				}
				await Bun.sleep(300);
			}
			const window = await windowOf(who.id);
			if (!window) return 'Your window is not open. Tell the operator.';
			desk = { id: who.id, until: Date.now() + DESK_HOLD };
			const raised = await cua('bring_to_front', { pid: window.pid, window_id: window.window_id });
			journal({ kind: 'desk', agent: who.id, raised: raised['status'] ?? raised['error'] ?? null });
			return `The desktop is yours for two minutes, and your window (pid ${window.pid}, window_id ${window.window_id}) is in front. Run \`focus\` again to keep it, and \`release\` when you are done.`;
		}
		case 'release':
			if (desk?.id === who.id) desk = null;
			return 'Released.';
		case 'myreports':
			return myReports(who);
		default:
			return `"${verb}" is not one of your commands.\n${DESKTOP_HELP}`;
	}
}

function myReports(who: Who): string {
	// Since the brief, not by month: the report is written after the game has moved the campaign on.
	const since = lab.session?.at ?? '';
	const mine = issues().filter(issue => issue.agent === who.name && issue.at >= since);
	return mine.length
		? mine
				.map((issue, index) => `${index + 1}. [${issue.severity}] turn ${issue.turn ?? '-'}: ${issue.text}`)
				.join('\n')
		: 'You have recorded nothing this game.';
}

let screenShots = 0;

/** The commands of a player who has only the screen: pictures out, pointer and keys in. */
async function handleScreen(who: Who, tab: Tab, verb: string, rest: string[]): Promise<string> {
	const dir = join(dirs.screens, who.id);
	mkdirSync(dir, { recursive: true });
	const next = (kind: string) =>
		join(dir, `${tag(current!)}-${String(Date.now()).slice(-9)}-${String(++screenShots).padStart(4, '0')}-${kind}.png`);
	const after = async (did: string, pause = 500) => {
		journal({ kind: 'screen', agent: who.id, verb, args: rest });
		await tab.page.waitForTimeout(pause);
		return `${did}\nScreen now: ${await shot(tab, next(verb))}`;
	};
	switch (verb) {
		case 'help':
			return SCREEN_HELP;
		case 'shot': {
			const grid = rest[0] === 'grid';
			const seconds = Math.min(Number(grid ? rest[1] : rest[0]) || 0, 20);
			if (seconds) await tab.page.waitForTimeout(seconds * 1000);
			return shot(tab, next(grid ? 'grid' : 'shot'), grid);
		}
		case 'zoom': {
			const [x, y, width, height] = rest.map(Number);
			const fits =
				rest.length === 4 &&
				[x, y, width, height].every(Number.isFinite) &&
				x! >= 0 &&
				y! >= 0 &&
				width! >= 20 &&
				height! >= 20 &&
				x! + width! <= VIEW.width &&
				y! + height! <= VIEW.height;
			if (!fits)
				return `usage: zoom <x> <y> <width> <height>, a box inside the ${VIEW.width} by ${VIEW.height} screen and at least 20 on a side`;
			return zoom(tab, next('zoom'), { x: x!, y: y!, width: width!, height: height! });
		}
		case 'click':
		case 'rclick':
		case 'dblclick': {
			const at = point(rest[0], rest[1]);
			if (typeof at === 'string') return `usage: ${verb} <x> <y>. ${at}`;
			return after(await clickAt(tab, at, verb === 'rclick' ? 'right' : 'left', verb === 'dblclick' ? 2 : 1));
		}
		case 'move': {
			const at = point(rest[0], rest[1]);
			if (typeof at === 'string') return `usage: move <x> <y>. ${at}`;
			return after(await moveTo(tab, at), 900);
		}
		case 'drag': {
			const from = point(rest[0], rest[1]);
			const to = point(rest[2], rest[3]);
			if (typeof from === 'string' || typeof to === 'string')
				return `usage: drag <x1> <y1> <x2> <y2>. ${typeof from === 'string' ? from : to}`;
			return after(await dragTo(tab, from, to));
		}
		case 'scroll': {
			const at = point(rest[0], rest[1]);
			const amount = Number(rest[2]);
			if (typeof at === 'string' || !Number.isFinite(amount) || amount === 0)
				return `usage: scroll <x> <y> <amount>. ${typeof at === 'string' ? at : 'A positive amount scrolls down.'}`;
			return after(await scrollAt(tab, at, amount));
		}
		case 'key':
			if (!rest[0]) return 'usage: key <key>';
			return after(await pressCombo(tab, rest[0]));
		case 'keydown':
		case 'keyup':
			if (!rest[0]) return `usage: ${verb} <key>`;
			return after(await holdKey(tab, rest[0], verb === 'keydown'));
		case 'type':
			if (!rest.length) return 'usage: type <text>';
			return after(await typeText(tab, rest.join(' ')));
		case 'myreports':
			return myReports(who);
		default:
			return `You have the screen and nothing else this run: "${verb}" is not one of your commands.\n${SCREEN_HELP}`;
	}
}

async function handle(agent: string, words: string[]): Promise<string> {
	const [verb = 'status', ...rest] = words;
	await locked(() => refresh());
	if (!current) return 'The host tab has no game state yet.';
	const state = current;

	if (agent === 'lab') {
		switch (verb) {
			case 'brief': {
				lab.session = { startIndex: gameIndex(state), at: new Date().toISOString() };
				for (const [index, pick] of lab.picks.entries())
					if (pick && (state.world.campaign.characters[pick]?.dead ?? true)) lab.picks[index] = null;
				persist();
				const paths = writeBriefs({
					config,
					state,
					audit,
					dir: dirs.briefs,
					reports: dirs.reports,
					leadIndex: lab.session.startIndex % config.players.length,
					stage: stageOf?.(state.world),
				});
				return paths.join('\n');
			}
			case 'say': {
				const text = rest.join(' ').trim();
				if (!text) return 'usage: lab say <text>';
				lab.chat.push({ at: new Date().toISOString(), from: 'Operator', text });
				note('chat', 'Operator', text);
				journal({ kind: 'chat', agent: 'lab', text });
				persist();
				return 'Said.';
			}
			case 'replays':
				return replaysUrl(pages.port!, config.run);
			case 'parity':
				writeFileSync(files.parity, renderParity(audit, state.world, issues()));
				return files.parity;
			case 'untouched':
				return JSON.stringify(untouched(audit, state.world), null, 1);
			case 'save': {
				const path = join(dirs.saves, `${rest[0] ?? 'manual'}.json`);
				writeFileSync(path, JSON.stringify({ v: 1, phase: state.phase, world: state.world }));
				return path;
			}
			case 'load':
				await locked(async () => {
					await loadSave(host, parseSave(JSON.parse(readFileSync(rest[0]!, 'utf8'))));
					await refresh();
				});
				return `Loaded ${rest[0]}. ${renderHeader(current!)}`;
			case 'tabs': {
				const lines: string[] = [];
				for (const tab of tabs)
					lines.push(`${tab.id}: ${JSON.stringify(await connection(tab))} · ${tab.errors.length} page errors`);
				return lines.join('\n');
			}
			case 'errors':
				return tabs.flatMap(tab => tab.errors.map(text => `${tab.id}: ${text}`)).join('\n') || 'No page errors.';
			case 'shot': {
				const path = join(dirs.shots, `${rest[1] ?? `manual-${Date.now()}`}.png`);
				await (tabs.find(tab => tab.id === rest[0]) ?? host).page.screenshot({ path });
				return path;
			}
			case 'session':
				return JSON.stringify({
					session: lab.session,
					picks: lab.picks,
					done: sessionDone(state),
					header: renderHeader(state),
				});
			case 'status':
				return renderStatus(state, null);
			case 'board':
				return renderBoard(state.world);
			case 'stop':
				setTimeout(() => void shutdown(), 50);
				return 'Stopping.';
			default:
				return 'lab commands: brief · say <text> · replays · parity · untouched · save <name> · load <path> · tabs · errors · shot [agent] [name] · session · status · board · stop';
		}
	}

	const who = whoOf(agent);
	if (!who) return `Unknown player "${agent}". Players: ${config.players.map(player => player.id).join(', ')}.`;
	const harness = config.players[who.index]!.harness;
	const tab = tabs[who.index]!;
	if (sees(who.index) && !['wait', 'listen', 'say', 'report'].includes(verb))
		return harness === 'desktop' ? handleDesktop(who, verb) : handleScreen(who, tab, verb, rest);

	switch (verb) {
		case 'help':
			return HELP;
		case 'status': {
			const lines = [renderStatus(state, who)];
			if (state.phase === 'lobby') lines.push(...renderLobby(state, lobbyPicks()));
			lines.push('', ...digest(state, who));
			persist();
			return lines.join('\n');
		}
		case 'wait': {
			const deadline = Date.now() + Math.min(Number(rest[0]) || 45, 50) * 1000;
			for (;;) {
				await locked(() => refresh());
				const unread = lab.chat.slice(lab.chatSeen[who.id] ?? 0).some(message => message.from !== who.name);
				if (needs(current!, who).length || unread) {
					const lines = [...(sees(who.index) ? [] : [renderHeader(current!)]), ...digest(current!, who)];
					persist();
					return lines.join('\n');
				}
				if (Date.now() > deadline) {
					const now = current!;
					if (sees(who.index)) return 'Nothing is waiting on you yet. Run `wait` again.';
					const active = now.world.game && now.phase.startsWith('playing') ? now.world.game.active : null;
					const on = active
						? now.world.campaign.characters[now.world.game!.players[active]!.character]?.name
						: `the lead, ${config.players[(lab.session?.startIndex ?? 0) % config.players.length]!.name}`;
					return `${renderHeader(now)}\nStill waiting on ${on}. Run \`wait\` again.`;
				}
				await Bun.sleep(400);
			}
		}
		case 'listen': {
			// For a lead who has asked the table something: block until someone else answers, whatever else is waiting.
			const from = lab.chat.length;
			const deadline = Date.now() + Math.min(Number(rest[0]) || 40, 50) * 1000;
			for (;;) {
				const heard = lab.chat.slice(from).filter(message => message.from !== who.name);
				if (heard.length || Date.now() > deadline) {
					lab.chatSeen[who.id] = lab.chat.length;
					persist();
					return heard.length
						? ['TABLE TALK:', ...heard.map(message => `  ${message.from}: ${message.text}`)].join('\n')
						: 'Nobody answered yet. Run `listen` again, or go ahead.';
				}
				await Bun.sleep(400);
			}
		}
		case 'options':
			if (
				(state.phase === 'upkeep' || (state.phase === 'setup.supply' && state.world.campaign.freeAbilityUnits > 0)) &&
				!who.lead
			)
				return renderOptions(
					optionsFor(state, { ...who, lead: true }, lab.picks).filter(option => option.key.startsWith('buy:')),
					rest[0],
					['This is the shop as the lead sees it. Only the lead can buy. Tell them what you want with `say`.'],
				);
			return renderOptions(
				optionsFor(state, who, lab.picks),
				rest[0],
				state.phase === 'playing.actions' && state.world.game?.active === who.seat
					? [...idleActions(state, who), ...heldUnplayable(state, who.seat)]
					: state.phase.startsWith('playing')
						? heldUnplayable(state, who.seat)
						: state.phase === 'lobby'
							? [
									'Also available in the lobby, typed as commands of their own: `create <job> <haven-id> <name>`, `pick <character-id>`, `rename <haven-id> <name>`. `chars` lists characters, open jobs and havens.',
								]
							: state.phase === 'setup.supply'
								? ['Also: `supply <city-id> <count>` places cubes by hand.']
								: state.phase === 'setup.events'
									? ['Also: `events <card> <card> ...` chooses the Rationed Events.']
									: [],
			);
		case 'board':
			return renderBoard(state.world);
		case 'actions': {
			// What every action and rule unlocked so far does, for players who met them months ago.
			const { campaign } = state.world;
			const lines = campaign.actions.flatMap(action => (actionBriefs[action] ? [`  ${actionBriefs[action]}`] : []));
			const rules = campaign.rules.flatMap(rule => (ruleBriefs[rule] ? [`  ${ruleBriefs[rule]}`] : []));
			return ['Unlocked actions:', ...lines, ...(rules.length ? ['Rules added this year:', ...rules] : [])].join('\n');
		}
		case 'city':
			return rest[0] && isCity(rest[0])
				? renderCity(state.world, rest[0])
				: 'usage: city <city-id> (ids are in `board`)';
		case 'decks':
			return renderDecks(state.world);
		case 'log':
			return (
				(state.world.game?.log ?? [])
					.slice(-(Number(rest[0]) || 30))
					.map(entry => renderLog(state.world, entry))
					.join('\n') || 'No log yet.'
			);
		case 'chars':
			return renderLobby(state, lobbyPicks()).join('\n');
		case 'say': {
			const text = rest.join(' ').trim();
			if (!text) return 'usage: say <text>';
			lab.chat.push({ at: new Date().toISOString(), from: who.name, text });
			note('chat', who.name, text);
			lab.chatSeen[who.id] = lab.chat.length;
			journal({ kind: 'chat', agent: who.id, text });
			persist();
			return 'Said.';
		}
		case 'report': {
			const [severity, ...text] = rest;
			if (!severity || !text.length) return 'usage: report <bug|rules|ux|visual|idea> <text>';
			return report(who, agent, severity, text.join(' '));
		}
		case 'do':
			if (harness === 'ui') return 'You play through the screen this run. Use look, click, tap, choose, type and key.';
			if (!rest.length) return 'usage: do <key> [<key> ...] why: <one sentence>';
			return locked(() => {
				// Everything after `why:` is the player's reason, kept with the recording beside the step it explains.
				const at = rest.findIndex(word => word.toLowerCase() === 'why:');
				const reason =
					at < 0
						? ''
						: rest
								.slice(at + 1)
								.join(' ')
								.trim();
				if (reason) note('why', who.name, reason);
				return doKeys(who, at < 0 ? rest : rest.slice(0, at));
			});
		case 'look':
			return look(tab);
		case 'click':
			return click(tab, rest.join(' '));
		case 'tap':
			return tapCity(tab, rest[0] ?? '');
		case 'type':
			return typeInto(tab, rest[0] ?? '', rest.slice(1).join(' '));
		case 'choose':
			return chooseOption(tab, rest[0] ?? '', rest.slice(1).join(' '));
		case 'key':
			return pressKey(tab, rest[0] ?? '');
		case 'shot': {
			const path = join(dirs.shots, `${who.id}-${Date.now()}.png`);
			await tab.page.screenshot({ path });
			return path;
		}
		default: {
			const parsed = parseVerb(state, words);
			if (!parsed) return `Unknown command "${verb}".\n${HELP}`;
			if (parsed.v === 'error') return parsed.message;
			if (parsed.v === 'pick') {
				if (state.phase !== 'lobby')
					return 'REFUSED: characters are chosen in the lobby. This game has started with the seats shown in `status`.';
				if (lab.picks.some((pick, index) => pick === parsed.character && index !== who.index))
					return 'Another player already picked that character.';
				lab.picks[who.index] = parsed.character;
				journal({ kind: 'pick', agent: who.id, character: parsed.character });
				persist();
				return `You play ${state.world.campaign.characters[parsed.character]!.name} this game.`;
			}
			if (harness === 'ui') return 'You play through the screen this run. Use look, click, tap, choose, type and key.';
			const denied = mayRaw(state, who, parsed.command);
			if (denied) return denied;
			return locked(async () => {
				const reason = await send(who, parsed.command);
				const lines = [
					reason === NO_CHANGE ? `ok ${verb}: ${NO_CHANGE}` : reason ? `REFUSED: ${reason}` : `ok ${verb}`,
					'',
					renderHeader(current!),
					...digest(current!, who),
				];
				return lines.join('\n');
			});
		}
	}
}

const control = Bun.serve({
	hostname: '127.0.0.1',
	port: config.port + 1,
	idleTimeout: 120,
	async fetch(request) {
		if (request.method !== 'POST') return new Response('POST /rpc', { status: 405 });
		const { agent, words } = (await request.json()) as { agent: string; words: string[] };
		try {
			const text = await handle(agent, words);
			// A refusal is an error to the shell, so a chain of commands stops where the game said no.
			const refused = /^(REFUSED|STOPPED at|usage:|Unknown command)/m.test(text.split('\n\n')[0] ?? '');
			return new Response(text, { status: refused ? 409 : 200 });
		} catch (error) {
			journal({ kind: 'lab-error', agent, words, error: String(error) });
			return new Response(`LAB ERROR: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
		}
	},
});

const watcher = setInterval(
	() => void locked(() => refresh()).catch(error => journal({ kind: 'lab-error', error: String(error) })),
	500,
);

let stopping = false;
async function shutdown() {
	if (stopping) return;
	stopping = true;
	clearInterval(watcher);
	if (current) writeFileSync(files.parity, renderParity(audit, current.world, issues()));
	persist();
	rmSync(files.pid, { force: true });
	await closeTool();
	for (const { browser } of browsers) await browser.close().catch(() => {});
	wrangler.kill();
	await pages.stop(true);
	await control.stop(true);
	process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await locked(() => refresh());
writeFileSync(
	files.pid,
	JSON.stringify({ pid: process.pid, control: control.port, pages: pages.port, config: config.file }),
);
const ready = current as PublicState | null;
console.log(
	`lab ready: run ${config.run} · ${ready ? `${monthName(ready.world.campaign.month)} ${ready.phase}` : 'no state'} · control ${control.port} · watch at ${tabUrl('spectator')} · replays at ${replaysUrl(pages.port!, config.run)}`,
);
