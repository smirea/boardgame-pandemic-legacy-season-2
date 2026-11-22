#!/usr/bin/env bun
/**
 * Verifies base-state (state 0) and max-state card extraction against the original Tabletop Simulator
 * Workshop mod (`2236267539.json`), checks `docs/assets` card metadata (base + packages), and diffs
 * the canonical tabletop save (`TS_Save_109.json`) — including search states, companions, unrevealed
 * base-state cards, character tracks, and improvement stickers — against `tabletopSave()`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pack, paddedTrack, searchCardCompanion } from '../packages/game/src/index.ts';
import { tabletopSave } from '../packages/game/src/tabletop.ts';

const ASSETS_ROOT = new URL('../docs/assets/', import.meta.url).pathname;
const WORKSHOP =
	process.env.TTS_WORKSHOP_JSON ?? '/Users/stefan/Library/Tabletop Simulator/Mods/Workshop/2236267539.json';
const SAVE = process.env.TTS_SAVE_JSON ?? '/Users/stefan/Library/Tabletop Simulator/Saves/my own/TS_Save_109.json';

type TtsObj = {
	GUID?: string;
	Name?: string;
	Nickname?: string;
	Description?: string;
	CardID?: number;
	CustomDeck?: Record<string, { FaceURL?: string; BackURL?: string }>;
	States?: Record<string, TtsObj>;
	ObjectStates?: TtsObj[];
	ContainedObjects?: TtsObj[];
	ChildObjects?: TtsObj[];
};

function walk(obj: unknown, trail: string[] = [], out: { obj: TtsObj; trail: string }[] = []) {
	if (!obj || typeof obj !== 'object') return out;
	if (Array.isArray(obj)) {
		obj.forEach((item, index) => walk(item, [...trail, `[${index}]`], out));
		return out;
	}
	const record = obj as TtsObj;
	out.push({ obj: record, trail: trail.join('/') });
	for (const key of ['ObjectStates', 'ContainedObjects'] as const) {
		const list = record[key];
		if (!Array.isArray(list)) continue;
		const label = record.Nickname || record.Name || key;
		list.forEach((child, index) => walk(child, [...trail, `${label}[${index}]`], out));
	}
	return out;
}

const slug = (name: string) =>
	name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

const hashOf = (url?: string) => (url ? (url.replace(/\/$/, '').split('/').pop() ?? '') : '');

function faceHash(obj: TtsObj): string {
	if (!obj.CardID || !obj.CustomDeck) return '';
	const deck = obj.CustomDeck[String(Math.floor(obj.CardID / 100))];
	return hashOf(deck?.FaceURL);
}

function activeState(obj: TtsObj): { active: number; total: number } | null {
	if (!obj.States) return null;
	const other = Object.keys(obj.States).map(Number);
	const total = other.length + 1;
	const active = Array.from({ length: total }, (_, index) => index + 1).find(s => !other.includes(s));
	return active ? { active, total } : null;
}

const STICKER_BY_NICK: Record<string, string> = {
	'well stocked': 'wellStocked',
	'well stocket': 'wellStocked',
	lockdown: 'lockdown',
	rebirth: 'rebirth',
	'broken link': 'cordon',
	foundations: 'double',
	infrastructure: 'triple',
	'decryption key': 'wild',
	'local operatives': 'redWild',
};

const errors: string[] = [];
const check = (cond: boolean, message: string) => {
	if (!cond) errors.push(message);
};

// 1. Verify docs/assets sidecar metadata (character tracks + base & package player card improvement slots)
const charTrackByGuid = new Map<string, string>();
for (let i = 1; i <= 10; i++) {
	const id = `character-${String(i).padStart(2, '0')}`;
	const data = JSON.parse(fs.readFileSync(path.join(ASSETS_ROOT, `base/characters/${id}/character.json`), 'utf8')) as {
		guid: string;
		exposureTrack: { result: 'safe' | 'scar' | 'skull' | null }[];
	};
	const track = paddedTrack(
		data.exposureTrack.filter(b => b.result !== null).map(b => (b.result === 'safe' ? 'empty' : b.result!)),
	).join(',');
	charTrackByGuid.set(data.guid, track);
}
const packCharTracks = new Set(pack.characterCards.map(t => paddedTrack(t).join(',')));
check(packCharTracks.size === 10, `Expected 10 unique character tracks in pack, got ${packCharTracks.size}`);
for (const [guid, track] of charTrackByGuid) {
	check(packCharTracks.has(track), `Character card ${guid} track (${track}) missing from pack.characterCards`);
}

const basePlayerDir = path.join(ASSETS_ROOT, 'base/player-deck');
for (const file of fs.readdirSync(basePlayerDir).filter(f => f.startsWith('city-') && f.endsWith('.json'))) {
	const full = path.join(basePlayerDir, file);
	const data = JSON.parse(fs.readFileSync(full, 'utf8')) as { hasImprovementSlot?: boolean };
	check(
		data.hasImprovementSlot === true,
		`${full}: base city card hasImprovementSlot=${String(data.hasImprovementSlot)}, expected true`,
	);
}

const cityBySlug = new Map(pack.cities.map(c => [slug(c.name), c]));
for (let p = 1; p <= 8; p++) {
	const dir = path.join(ASSETS_ROOT, `packages/package-${p}`);
	const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
		cards: { json: string; title: string; category: string }[];
	};
	for (const entry of pkg.cards) {
		if (!entry.category.includes('player')) continue;
		const city = cityBySlug.get(slug(entry.title));
		if (!city) continue;
		const cardPath = path.join(dir, entry.json);
		const data = JSON.parse(fs.readFileSync(cardPath, 'utf8')) as {
			hasImprovementSlot?: boolean;
			states?: unknown[];
		};
		const isSearch = (data.states?.length ?? 0) > 0;
		const expectedSlot = !isSearch && city.id !== 'utopia';
		check(
			data.hasImprovementSlot === expectedSlot,
			`${cardPath}: hasImprovementSlot=${String(data.hasImprovementSlot)}, expected ${expectedSlot}`,
		);
	}
}

const verified: string[] = ['docs/assets metadata'];
const skipped: string[] = [];

// 2. Verify TTS Workshop mod if present on disk
if (fs.existsSync(WORKSHOP)) {
	verified.push('TTS Workshop mod');
	const ws = JSON.parse(fs.readFileSync(WORKSHOP, 'utf8'));
	const wsAll = walk(ws);

	// All 10 character cards start at state 1 (base blank front, 0 exposure)
	const wsChars = wsAll.filter(({ obj }) => obj.States && Object.keys(obj.States).length === 7);
	check(wsChars.length === 10, `Expected 10 character cards in workshop, found ${wsChars.length}`);
	const wsCharByHash = new Map<string, string>();
	for (const { obj } of wsChars) {
		const st = activeState(obj);
		check(st?.active === 1, `Workshop character card ${obj.GUID} is at state ${st?.active}, expected 1`);
		wsCharByHash.set(faceHash(obj.States!['2']!), obj.GUID!);
		check(charTrackByGuid.has(obj.GUID!), `Workshop character GUID ${obj.GUID} missing from docs/assets`);
	}

	// All 31 search city cards start at state 1 and match pack.searches box count
	const wsSearchByCity = new Map<string, { active: number; total: number }>();
	for (const { obj, trail } of wsAll) {
		if (!obj.States || !trail.includes('Package ')) continue;
		const city = obj.Nickname ? cityBySlug.get(slug(obj.Nickname)) : undefined;
		if (!city) continue;
		const st = activeState(obj)!;
		wsSearchByCity.set(city.id, st);
		const boxes = pack.searches[city.id] ?? [];
		const expectedTotal = boxes.length === 2 ? 4 : 2;
		check(st.active === 1, `Workshop search card ${city.id} starts at state ${st.active}, expected 1`);
		check(
			st.total === expectedTotal,
			`Workshop search card ${city.id} has ${st.total} states, expected ${expectedTotal}`,
		);
	}
	check(
		wsSearchByCity.size === Object.keys(pack.searches).length,
		`Workshop search card count ${wsSearchByCity.size} !== pack ${Object.keys(pack.searches).length}`,
	);

	// All 8 Produce Supplies cards match pack.numbers.produceBoxes
	const wsProduce = wsAll
		.filter(({ obj }) => obj.Nickname === 'Produce Supplies')
		.map(({ obj }) => activeState(obj)?.active ?? 0)
		.sort((a, b) => a - b);
	check(
		wsProduce.join(',') === [...pack.numbers.produceBoxes].sort((a, b) => a - b).join(','),
		`Workshop Produce Supplies boxes [${wsProduce}] !== pack [${pack.numbers.produceBoxes}]`,
	);

	// 3. Diff canonical TTS save against tabletopSave()
	if (fs.existsSync(SAVE)) {
		verified.push('canonical TS_Save_109 vs tabletopSave()');
		const save = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
		const saveAll = walk(save);
		const tt = tabletopSave().world.campaign;

		// Verify EVERY unrevealed city in pack (East Asia & Utopia) has clean base-state cards in tabletopSave()
		for (const city of pack.cities) {
			if (city.kind !== 'city') continue;
			const revealed = tt.locations[city.id]!.revealed;
			const pl = Object.values(tt.playerCards).filter(c => c.kind === 'city' && c.city === city.id);
			const inf = Object.values(tt.infectionCards).filter(c => c.kind === 'city' && c.city === city.id);
			if (!revealed) {
				check(
					pl.length === city.playerCards,
					`Unrevealed ${city.id} has ${pl.length} player cards in tabletopSave(), expected ${city.playerCards}`,
				);
				const expectedInf = city.noInfectionCards ? 0 : city.population;
				check(
					inf.length === expectedInf,
					`Unrevealed ${city.id} has ${inf.length} infection cards in tabletopSave(), expected ${expectedInf}`,
				);
				for (const card of pl) {
					if (card.kind !== 'city') continue;
					check(card.improvement === null, `Unrevealed ${city.id} player card has improvement`);
					check(card.companion === null, `Unrevealed ${city.id} player card has companion`);
					check(
						card.search.every(b => !b.scratched),
						`Unrevealed ${city.id} search box is scratched`,
					);
				}
			}
		}

		// Verify every revealed search card state & companion in TS_Save_109 matches tabletopSave()
		for (const { obj, trail } of saveAll) {
			if (!obj.States || !obj.Nickname || /Package 3|Package 8|Folder |Legacy Deck/.test(trail)) continue;
			const city = cityBySlug.get(slug(obj.Nickname));
			if (!city || !wsSearchByCity.has(city.id)) continue;
			const st = activeState(obj)!;
			const mask = st.active - 1;
			const expectedLand = (mask & 1) !== 0;
			const expectedSea = (mask & 2) !== 0;
			const ttCard = Object.values(tt.playerCards).find(
				c => c.kind === 'city' && c.city === city.id && c.search.length > 0,
			);
			check(Boolean(ttCard), `tabletopSave() missing search card for ${city.id}`);
			if (ttCard && ttCard.kind === 'city') {
				const actualLand = ttCard.search.some(b => b.scope === 'land' && b.scratched);
				const actualSea = ttCard.search.some(b => b.scope === 'sea' && b.scratched);
				check(
					actualLand === expectedLand && actualSea === expectedSea,
					`Search state mismatch for ${city.id}: TTS=(land:${expectedLand},sea:${expectedSea}), tabletop=(land:${actualLand},sea:${actualSea})`,
				);
				const expectedComp = searchCardCompanion(ttCard.search);
				check(
					ttCard.companion === expectedComp,
					`Companion mismatch for ${city.id}: expected ${expectedComp}, got ${ttCard.companion}`,
				);
			}
		}

		// Verify every active card improvement sticker in TS_Save_109 matches tabletopSave()
		const ttsStickers: string[] = [];
		for (const { obj, trail } of saveAll) {
			if (obj.Name !== 'Card' || !obj.ChildObjects?.length) continue;
			if (/Packet L|Package 3|Package 8|Folder /.test(trail)) continue;
			const city = obj.Nickname ? cityBySlug.get(slug(obj.Nickname)) : undefined;
			if (!city) continue;
			for (const child of obj.ChildObjects) {
				const key = STICKER_BY_NICK[(child.Nickname ?? '').trim().toLowerCase()];
				if (key) ttsStickers.push(`${city.id}:${key}`);
			}
		}
		const ttStickers: string[] = [
			...Object.values(tt.playerCards).flatMap(c =>
				c.kind === 'city' && c.improvement ? [`${c.city}:${c.improvement}`] : [],
			),
			...Object.values(tt.infectionCards).flatMap(c =>
				c.kind === 'city' && c.improvement ? [`${c.city}:${c.improvement}`] : [],
			),
		];
		check(
			ttsStickers.toSorted().join(',') === ttStickers.toSorted().join(','),
			`Card improvement stickers mismatch: TTS=[${ttsStickers.toSorted()}] vs tabletop=[${ttStickers.toSorted()}]`,
		);

		// Verify all 10 character card tracks are accounted for in tabletopSave()
		const ttCharTracks = [
			...Object.values(tt.characters).map(c => c.exposureTrack.join(',')),
			...tt.characterCards.map(c => c.track.join(',')),
		];
		check(ttCharTracks.length === 10, `tabletopSave() has ${ttCharTracks.length} character cards, expected 10`);
		check(new Set(ttCharTracks).size === 10, `tabletopSave() has duplicate character card tracks`);
	} else {
		skipped.push(`TS_Save_109 (${SAVE} not found)`);
	}
} else {
	skipped.push(`TTS Workshop mod (${WORKSHOP} not found)`);
}

if (errors.length) {
	console.error(`FAILED (${errors.length} issues):`);
	for (const err of errors) console.error('  -', err);
	process.exit(1);
}
console.log(`OK: verified [${verified.join(', ')}]${skipped.length ? `; skipped [${skipped.join(', ')}]` : ''}.`);
