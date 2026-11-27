#!/usr/bin/env bun
/**
 * Indexes the scans of the original components in `docs/assets` into `src/lib/scans.generated.ts`, so the game can
 * show the printed Legacy card, door or package beside its own. The images are served by the Bun server under
 * `/api/scans/`. Rerun after the archive changes.
 */
import { characterCardIndex, pack } from "@repo/game";
import type { ExposureBox } from "@repo/game";

const root = new URL("../../../docs/assets/", import.meta.url);
const json = (path: string) => Bun.file(new URL(path, root)).json();
const exists = (path: string) => Bun.file(new URL(path, root)).exists();

type Scan = { title: string; src: string; back?: string; kind?: string; rotated?: boolean };

type PrintSide = {
  header: string;
  trigger: string;
  text: string;
  footer: string;
  stopOrPause: string;
};
type LegacyPrint = {
  title: string;
  category: string;
  a: PrintSide;
  b: PrintSide;
  boxes: { condition: string; revealed: string }[];
};
const printSide = (side: Record<string, string>): PrintSide => ({
  header: side.header ?? "",
  trigger: side.trigger ?? "",
  text: side.text ?? "",
  footer: side.footer ?? "",
  stopOrPause: side.stopOrPause ?? "",
});

const legacy: Record<string, Scan> = {};
const legacyPrint: Record<string, LegacyPrint> = {};
const index = await json("legacy-deck/index.json");
for (const entry of index.cards as { folder: string; cardCode: string; title: string }[]) {
  const dir = `legacy-deck/${entry.folder}`;
  const sidecar = await json(`${dir}/card.json`);
  // The archive photographed 00-01 upside down: its side-a image is the face printed 00-01b.
  const flipped = String(sidecar.printedCodes?.sideA ?? "").endsWith("b");
  legacyPrint[entry.cardCode] = {
    title: sidecar.title,
    category: sidecar.category,
    a: printSide(flipped ? sidecar.sideB : sidecar.sideA),
    b: printSide(flipped ? sidecar.sideA : sidecar.sideB),
    boxes: (sidecar.states as Record<string, string>[]).map((state) => ({
      condition: state.revealedCondition ?? "",
      revealed: state.revealedText ?? state.revealedSummary ?? "",
    })),
  };
  // The last card's face is its side A (Congratulations); side B warns a reader who started at the wrong end.
  const end = pack.legacyDeck.find((card) => card.id === entry.cardCode)?.kind === "end";
  const [face, back] = end !== flipped ? ["side-a", "side-b"] : ["side-b", "side-a"];
  legacy[entry.cardCode] = {
    title: entry.title,
    src: `${dir}/${face}.jpg`,
    back: `${dir}/${back}.jpg`,
  };
}
const missing = pack.legacyDeck.filter((card) => !legacy[card.id]).map((card) => card.id);
if (missing.length) throw new Error(`No scan for Legacy cards ${missing.join(", ")}`);

const packages: Record<number, Scan[]> = {};
const packageReports: Record<number, { title: string; text: string }> = {};
for (const id of pack.dossier.packages) {
  const dir = `packages/package-${id}`;
  const def = await json(`${dir}/package.json`);
  const scans: Scan[] = [{ title: `Package ${id}`, src: `${dir}/${def.boxImage}` }];
  const seen = new Set<string>();
  for (const card of def.cards as { json: string; title: string; category: string }[]) {
    // A city's copies print the same face; one shows them all.
    if (seen.has(`${card.category}:${card.title}`)) continue;
    seen.add(`${card.category}:${card.title}`);
    const folder = `${dir}/${card.json.replace(/\/card\.json$/, "")}`;
    const data = await json(card.json.startsWith("/") ? card.json : `${dir}/${card.json}`);
    if (/report/i.test(card.category) && !packageReports[id]) {
      const raw: string = data.sideA?.text ?? "";
      const body = raw
        .replace(/^THIS PACKAGE INCLUDES:[\s\S]*?RECON REPORT\s*/i, "")
        .replace(/\n*Read both sides of this card[\s\S]*$/i, "")
        .replace(/\n*P\d+-01a\s*$/i, "")
        .trim();
      if (body) packageReports[id] = { title: "Recon Report", text: body };
    }
    scans.push({
      title: card.title,
      kind: card.category,
      src: `${folder}/${data.images.sideB}`,
      back: `${folder}/${data.images.sideA}`,
    });
  }
  for (const sticker of (def.stickers ?? []) as {
    json: string;
    name: string;
    category: string;
  }[]) {
    if (sticker.category === "instruction") continue;
    const data = await json(`${dir}/${sticker.json}`);
    const image = data.image ?? data.images?.[0];
    if (image) scans.push({ title: sticker.name, src: `${dir}/stickers/${image}` });
  }
  packages[id] = scans;
}

const events: Record<string, Scan> = {};
const BASE_EVENTS: Record<string, string> = {
  resilientPopulation: "event-01_resilient-population",
  airlift: "event-02_airlift",
  teamBravo: "event-03_team-bravo",
  oneQuietNight: "event-04_one-quiet-night",
};
for (const event of pack.startingEvents) {
  const file = BASE_EVENTS[event];
  if (!file) throw new Error(`No scan named for the starting event ${event}`);
  events[event] = { title: event, src: `base/player-deck/${file}.jpg` };
}
for (const card of pack.legacyDeck)
  for (const unlock of card.unlocks)
    if (unlock.t === "event") events[unlock.event] = legacy[card.id]!;
for (const def of pack.seals) {
  if (def.seal.t !== "package") continue;
  const scans = packages[def.seal.id]!;
  const card =
    scans.find((scan) => /event/.test(scan.kind ?? "")) ??
    scans.find((scan) => scan.kind === "player-card");
  for (const unlock of [...def.unlocks, ...(def.reward ?? [])])
    if (unlock.t === "event" && card) events[unlock.event] = card;
}

const REPORT_DOORS = new Set(["11", "17", "19", "20", "21", "22", "35", "43", "52"]);
const PROFILE_DOOR_JOB: Record<string, string> = {
  "18": "immunologist",
  "41": "vectorControl",
  "44": "sanitationOfficer",
  "46": "scientist",
  "49": "captain",
};

const doors: Record<string, Scan[]> = {};
const doorReports: Record<string, { title: string; text: string }> = {};
const jobProfiles: Record<string, { text: string; home?: string; age?: number }> = {};
for (const [sheet, ids] of pack.dossier.sheets.entries()) {
  for (const id of ids) {
    const dir = `dossiers/folder-${sheet + 1}/door-${id}`;
    if (!(await exists(`${dir}/door.json`))) throw new Error(`No scan for door ${id} in ${dir}`);
    const def = await json(`${dir}/door.json`);
    // Some sidecars name an image from the archive's root, others from the door's folder.
    const image = async (name: string) => {
      const src = (await exists(name)) ? name : `${dir}/${name}`;
      if (!(await exists(src))) throw new Error(`Door ${id} names a missing image ${name}`);
      return src;
    };
    const scans: Scan[] = [{ title: `Door ${id}`, src: await image(def.frontImage) }];
    for (const item of (def.items ?? []) as {
      image?: string;
      title?: string;
      category?: string;
      text?: string;
    }[]) {
      if (REPORT_DOORS.has(id) && item.text && !doorReports[id]) {
        const isReport =
          item.category === "report" ||
          item.category === "sticker-card" ||
          (id === "21" && item.category === "instruction");
        if (isReport) {
          const lines = item.text.trim().split("\n");
          const heading = (item.title ?? lines[0] ?? `Door ${id}`).trim();
          const body = lines[0]?.trim().toUpperCase() === heading.toUpperCase()
            ? lines.slice(1).join("\n").trim()
            : item.text.trim();
          doorReports[id] = { title: heading, text: body };
        }
      }
      const profileJob = PROFILE_DOOR_JOB[id];
      if (profileJob && item.category === "profile" && item.text) {
        const homeMatch = /\bHOME\s+(.+)/i.exec(item.text);
        const ageMatch = /\bAGE\s+(\d+)/i.exec(item.text);
        const cleanText = item.text
          .replace(/\n?HOME\s+.+/gi, "")
          .replace(/\n?AGE\s+\d+/gi, "")
          .replace(/\s*\n\s*/g, " ")
          .trim();
        jobProfiles[profileJob] = {
          text: cleanText,
          ...(homeMatch?.[1] ? { home: homeMatch[1].trim() } : {}),
          ...(ageMatch?.[1] ? { age: Number(ageMatch[1]) } : {}),
        };
      }
      if (!item.image || item.category === "instruction") continue;
      scans.push({ title: item.title ?? `Door ${id}`, src: await image(item.image) });
    }
    doors[id] = scans;
  }
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const cityIdBySlug = new Map(pack.cities.map((city) => [slug(city.name), city.id]));
const cities: Record<string, Scan> = {};
const searchCities: Record<string, Scan[]> = {};

for (const city of pack.cities) {
  if (city.kind !== "city" || city.playerCards === 0) continue;
  const baseSrc = `base/player-deck/city-${city.id}.jpg`;
  if (await exists(baseSrc)) cities[city.id] = { title: city.name, src: baseSrc };
}

for (const id of pack.dossier.packages) {
  const dir = `packages/package-${id}`;
  const def = await json(`${dir}/package.json`);
  for (const card of def.cards as { json: string; title: string; category: string }[]) {
    if (!card.category.includes("player")) continue;
    const cityId = cityIdBySlug.get(slug(card.title));
    if (!cityId) continue;
    const folder = `${dir}/${card.json.replace(/\/card\.json$/, "")}`;
    const data = await json(card.json.startsWith("/") ? card.json : `${dir}/${card.json}`);
    const baseSrc = `${folder}/${data.images.sideB}`;
    if (!(await exists(baseSrc))) throw new Error(`Missing player card scan ${baseSrc}`);
    const states = (data.states ?? []) as { state: number; images?: { sideB?: string } }[];
    if (states.length > 0) {
      const ordered = [baseSrc];
      for (const stateNum of [2, 3, 4]) {
        const state = states.find((item) => item.state === stateNum);
        if (!state?.images?.sideB) continue;
        const src = `${folder}/${state.images.sideB}`;
        if (!(await exists(src))) throw new Error(`Missing search state scan ${src}`);
        ordered.push(src);
      }
      searchCities[cityId] = ordered.map((src) => ({ title: card.title, src }));
      if (!cities[cityId]) cities[cityId] = { title: card.title, src: baseSrc };
    } else {
      cities[cityId] = { title: card.title, src: baseSrc };
    }
  }
}

for (const city of pack.cities) {
  if (city.kind !== "city" || city.playerCards === 0) continue;
  if (!cities[city.id]) throw new Error(`No player card scan for city ${city.id}`);
}
for (const [cityId, boxes] of Object.entries(pack.searches)) {
  const expected = boxes.length === 1 ? 2 : 4;
  const scans = searchCities[cityId];
  if (!scans || scans.length !== expected)
    throw new Error(`Expected ${expected} search scans for ${cityId}, found ${scans?.length ?? 0}`);
}

const produce: Record<number, Scan> = {};
for (const boxes of [1, 2, 3]) {
  const src = `base/player-deck/produce-supplies-0${boxes}.jpg`;
  if (!(await exists(src))) throw new Error(`Missing produce supplies scan ${src}`);
  produce[boxes] = { title: "Produce Supplies", src };
}

const IMPROVEMENT_SCANS: Record<string, string> = {
  double: "base/upgrades/player-card/foundations.jpg",
  triple: "base/upgrades/player-card/infrastructure.jpg",
  wild: "dossiers/folder-4/door-43/item-01_decryption-key.jpg",
  redWild: "dossiers/folder-4/door-45/item-01_local-operatives.jpg",
};
const cityImprovements: Record<string, Scan> = {};
for (const improvement of pack.cityImprovements) {
  const src = IMPROVEMENT_SCANS[improvement.id];
  if (!src || !(await exists(src)))
    throw new Error(`Missing city improvement scan for ${improvement.id}`);
  cityImprovements[improvement.id] = { title: improvement.name, src };
}

const infectionCities: Record<string, Scan> = {};
const hollowScans: Record<string, Scan> = {};
for (const city of pack.cities) {
  if (city.kind !== "city" || city.noInfectionCards) continue;
  const baseSrc = `base/infection-deck/${city.id}.jpg`;
  // Base infection scans are stored portrait (rotated 90deg clockwise); package scans are upright landscape.
  if (await exists(baseSrc))
    infectionCities[city.id] = { title: city.name, src: baseSrc, rotated: true };
}
for (const id of pack.dossier.packages) {
  const dir = `packages/package-${id}`;
  const def = await json(`${dir}/package.json`);
  for (const card of def.cards as { json: string; title: string; category: string }[]) {
    if (!/infection|hollow/i.test(card.category)) continue;
    const folder = `${dir}/${card.json.replace(/\/card\.json$/, "")}`;
    const data = await json(card.json.startsWith("/") ? card.json : `${dir}/${card.json}`);
    const baseSrc = `${folder}/${data.images.sideB}`;
    if (!(await exists(baseSrc))) throw new Error(`Missing infection card scan ${baseSrc}`);
    const cityId = cityIdBySlug.get(slug(card.title));
    if (cityId) {
      if (!infectionCities[cityId]) infectionCities[cityId] = { title: card.title, src: baseSrc };
    } else if (/gather/i.test(card.title) && !hollowScans.gather) {
      hollowScans.gather = { title: card.title, src: baseSrc };
    } else if (/assemble/i.test(card.title) && !hollowScans.assemble) {
      hollowScans.assemble = { title: card.title, src: baseSrc };
    }
  }
}
for (const city of pack.cities) {
  if (city.kind !== "city" || city.noInfectionCards) continue;
  if (!infectionCities[city.id]) throw new Error(`No infection card scan for city ${city.id}`);
}

const INFECTION_IMPROVEMENT_SCANS: Record<string, string> = {
  wellStocked: "base/upgrades/infection-card/well-stocked.jpg",
  lockdown: "base/upgrades/infection-card/lockdown.jpg",
  rebirth: "packages/package-3/stickers/sticker-01_rebirth.jpg",
  brokenLink: "dossiers/folder-4/door-42/item-01_broken-link.jpg",
};
const infectionImprovements: Record<string, Scan> = {};
for (const improvement of pack.infectionImprovements) {
  const src = INFECTION_IMPROVEMENT_SCANS[improvement.id];
  if (!src || !(await exists(src)))
    throw new Error(`Missing infection improvement scan for ${improvement.id}`);
  infectionImprovements[improvement.id] = { title: improvement.name, src };
}

type CharacterCardScanEntry = { id: string; blank: Scan; states: Scan[] };
const characterCards: CharacterCardScanEntry[] = Array.from({ length: pack.characterCards.length });
const blankCharacter = "base/characters/blank-front.jpg";
if (!(await exists(blankCharacter))) throw new Error(`Missing ${blankCharacter}`);
for (let i = 1; i <= pack.characterCards.length; i++) {
  const id = `character-${String(i).padStart(2, "0")}`;
  const data = (await json(`base/characters/${id}/character.json`)) as {
    exposureTrack: { result: "safe" | "scar" | "skull" | null }[];
  };
  const track: ExposureBox[] = data.exposureTrack
    .filter((box) => box.result !== null)
    .map((box) => (box.result === "safe" ? "empty" : box.result!));
  const idx = characterCardIndex(track);
  if (idx < 0) throw new Error(`Character card ${id} track not found in pack.characterCards`);
  const states: Scan[] = [];
  for (let s = 2; s <= 8; s++) {
    const src = `base/characters/${id}/state-${s}.jpg`;
    if (!(await exists(src))) throw new Error(`Missing character card state scan ${src}`);
    states.push({ title: `${id} (${s - 1} exposure)`, src });
  }
  characterCards[idx] = { id, blank: { title: `${id} (0 exposure)`, src: blankCharacter }, states };
}
if (characterCards.some((entry) => !entry)) throw new Error("Incomplete characterCards scan index");

const out = new URL("../src/lib/scans.generated.ts", import.meta.url);
await Bun.write(
  out,
  `// Generated by apps/ui/scripts/gen-scans.ts from docs/assets. Do not edit.\n` +
    `export type Scan = { title: string; src: string; back?: string; kind?: string; rotated?: boolean };\n` +
    `export type CharacterCardScanEntry = { id: string; blank: Scan; states: Scan[] };\n` +
    `export const legacyScans: Record<string, Scan> = ${JSON.stringify(legacy)};\n` +
    `export const packageScans: Record<number, Scan[]> = ${JSON.stringify(packages)};\n` +
    `export const doorScans: Record<string, Scan[]> = ${JSON.stringify(doors)};\n` +
    `export const eventScans: Record<string, Scan> = ${JSON.stringify(events)};\n` +
    `export const produceScans: Record<number, Scan> = ${JSON.stringify(produce)};\n` +
    `export const cityScans: Record<string, Scan> = ${JSON.stringify(cities)};\n` +
    `export const searchCityScans: Record<string, Scan[]> = ${JSON.stringify(searchCities)};\n` +
    `export const cityImprovementScans: Record<string, Scan> = ${JSON.stringify(cityImprovements)};\n` +
    `export const infectionCityScans: Record<string, Scan> = ${JSON.stringify(infectionCities)};\n` +
    `export const hollowScans: Record<string, Scan> = ${JSON.stringify(hollowScans)};\n` +
    `export const infectionImprovementScans: Record<string, Scan> = ${JSON.stringify(infectionImprovements)};\n` +
    `export const characterCardScans: CharacterCardScanEntry[] = ${JSON.stringify(characterCards)};\n`,
);
await Bun.write(
  new URL("../src/lib/cards/print.generated.ts", import.meta.url),
  `// Generated by apps/ui/scripts/gen-scans.ts from docs/assets. Do not edit.\n` +
    `export type PrintSide = { header: string; trigger: string; text: string; footer: string; stopOrPause: string };\n` +
    `export type LegacyPrint = { title: string; category: string; a: PrintSide; b: PrintSide; boxes: { condition: string; revealed: string }[] };\n` +
    `export type DocumentPrint = { title: string; text: string };\n` +
    `export type JobProfilePrint = { text: string; home?: string; age?: number };\n` +
    `/** The printed words of every Legacy card, both sides as the archive names them (side B is the face). */\n` +
    `export const legacyPrint: Record<string, LegacyPrint> = ${JSON.stringify(legacyPrint)};\n` +
    `/** Printed Recon Report text for each numbered package (P1-01a through P8-01a). */\n` +
    `export const packageReports: Record<number, DocumentPrint> = ${JSON.stringify(packageReports)};\n` +
    `/** Printed Field Report / Recon Report / Transmissions text for narrative dossier doors. */\n` +
    `export const doorReports: Record<string, DocumentPrint> = ${JSON.stringify(doorReports)};\n` +
    `/** Printed dossier character bio, home, and age text for found character jobs (Doors 18, 41, 44, 46, 49). */\n` +
    `export const jobProfiles: Record<string, JobProfilePrint> = ${JSON.stringify(jobProfiles)};\n`,
);
console.log(
  `Indexed ${Object.keys(legacy).length} Legacy cards, ${Object.keys(packages).length} packages, ${Object.keys(doors).length} doors`,
);
