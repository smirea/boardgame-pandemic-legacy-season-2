#!/usr/bin/env bun
/** Imports a Tabletop Simulator save, prints what was settled, and writes the game's own save when given a path. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createGameActor } from '@repo/game';
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
const world = createGameActor({ seed: 1, save }).start().getSnapshot().context.world;
console.log(`\nOpens at: ${save.phase}, month ${world.campaign.month}, rationing ${world.campaign.rationing}`);
