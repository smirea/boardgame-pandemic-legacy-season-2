#!/usr/bin/env bun
/** Imports a Tabletop Simulator save, prints what was settled, and plays the spending step to the next month's lobby. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createGameActor, phaseOf } from '@repo/game';
import { census } from '../src/census';
import { read } from '../src/reading';
import { importReading } from '../src/world';

const [path, out] = process.argv.slice(2);
if (!path) throw new Error('usage: import.ts <save.json> [out.json]');
const { save, rows } = importReading(read(census(JSON.parse(readFileSync(path, 'utf8')))));
for (const row of rows)
	console.log(
		`${row.status.padEnd(7)} ${row.topic} | ${row.item} | table: ${row.table} | game: ${row.imported}${row.note ? ` | ${row.note}` : ''}`,
	);
if (out) writeFileSync(out, JSON.stringify(save));
const actor = createGameActor({ seed: 1, save }).start();
actor.send({ type: 'FINISH_UPKEEP' });
const after = actor.getSnapshot().context.world;
console.log(
	`\nAfter the spending step: ${phaseOf(actor.getSnapshot())}, month ${after.campaign.month}, rationing ${after.campaign.rationing}`,
);
