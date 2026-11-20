#!/usr/bin/env bun
/** Prints what the reader makes of a Tabletop Simulator save, for checking against the table by eye. */
import { census } from '../src/census';
import { read } from '../src/reading';
import type { CardRead } from '../src/reading';

const path = process.argv[2];
if (!path) throw new Error('Usage: read.ts <save.json>');
const reading = read(census(await Bun.file(path).json()));

const name = (card: CardRead) => {
	const face = card.face;
	const label =
		face.t === 'city'
			? `${face.city}${face.boxes.length ? `[${face.boxes.map(box => `${box.scope[0]}${box.scratched ? 'x' : '-'}${box.companion ? `:${box.companion}` : ''}`).join(' ')}]` : ''}`
			: face.t === 'infection'
				? `~${face.city}`
				: face.t === 'event'
					? `event:${face.event}`
					: face.t === 'produce'
						? `produce(${face.boxesLeft})`
						: face.t;
	return card.improvement ? `${label}+${card.improvement}` : label;
};
const pile = (cards: CardRead[]) => `${cards.length}: ${cards.map(name).join(', ')}`;

console.log(`${reading.save.name}, saved ${reading.save.date}`);
console.log(
	'\nCalendar:',
	reading.calendar.map((games, month) => `${month}:${games.map(game => game[0]).join('') || '-'}`).join(' '),
);
console.log('Tracks:', reading.tracks, 'Stockpile bonus:', reading.stockpileBonus);
console.log('Regions:', reading.regions.join(', '), '| havens found:', reading.havensFound.join(', '));
console.log('Haven names:', reading.havenNames);
console.log('\nPlayers:');
for (const player of reading.players)
	console.log(`  ${player.name} (${player.colour}) at ${player.at}: ${pile(player.hand)}`);
console.log('\nCharacters:');
for (const character of reading.characters)
	console.log(
		`  ${JSON.stringify(character.name)} player=${character.player} home=${character.home} job=${character.job} abilities=[${character.abilities}] scars=[${character.scars}] card=${character.card} exposure=${character.exposure} note=${JSON.stringify(character.note)}`,
	);
console.log('  spare cards:', reading.spareCharacterCards);
console.log('\nLocations:');
for (const [id, location] of Object.entries(reading.locations)) {
	const parts = [
		location.population === null ? 'pop printed' : `pop ${location.population}`,
		location.infested ? 'infested-sticker' : '',
		location.permanent.length ? `permanent ${location.permanent}` : '',
		location.center ? 'center' : '',
		location.tower ? 'tower' : '',
		location.shelter ? 'shelter' : '',
		location.supplies ? `${location.supplies} cubes` : '',
		location.plague ? `${location.plague} plague` : '',
		location.hollow ? `${location.hollow} hollow` : '',
		location.crossed ? 'CROSSED' : '',
	].filter(Boolean);
	console.log(`  ${id.padEnd(22)} ${parts.join(', ')}`);
}
console.log('\nLines:');
for (const line of reading.lines) console.log(`  ${line.kind} ${line.a} - ${line.b}   (${line.evidence})`);
console.log('\nObjectives:', reading.objectives, 'Turning points:', reading.turningPoints);
console.log('\nPiles:');
for (const [key, cards] of Object.entries(reading.piles)) console.log(`  ${key} ${pile(cards)}`);
console.log('\nLegacy cards unread:', reading.legacyRemaining);
console.log('Pools:', reading.pools);
console.log('For sale:', reading.forSale);
console.log('Actions:', reading.actions.join(', '), '| rules:', reading.rules.join(', '));
console.log('Doors opened:', reading.doors.opened.join(' '), '\nDoors sealed:', reading.doors.sealed.join(' '));
console.log('Packages opened:', reading.packages.opened.join(' '), '| sealed:', reading.packages.sealed.join(' '));
console.log('\nNotes:');
for (const note of reading.notes) console.log('  ', JSON.stringify(note));
console.log(`\nProblems (${reading.problems.length}):`);
for (const problem of reading.problems) console.log('  ', problem);
