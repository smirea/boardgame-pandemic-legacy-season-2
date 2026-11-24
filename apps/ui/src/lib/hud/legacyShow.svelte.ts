import { edgeKey, openingUnlocks, openings, pack } from "@repo/game";
import type { CampaignLocation, CityId, EdgeDef, Opening, World } from "@repo/game";

/** The parts of the map a Legacy reading can change, as the board last showed them. */
type Chart = { locations: Record<CityId, CampaignLocation>; edges: EdgeDef[]; routes: string[] };

/** What the board shows of the map in place of the state's, while a reading's changes wait for their scene. */
export type MapLag = {
  locations: Partial<Record<CityId, CampaignLocation>>;
  edges: EdgeDef[] | null;
  routes: ReadonlySet<string>;
};

/** One place on the map a scene changed, and the parts of the map that change there. */
type Beat = { city: CityId; keys: Set<string> };

/** More scenes turned over at once than this is a jump, such as a reload or an undo, and is not shown. */
const MOST_OPENINGS = 3;

const NO_LAG: MapLag = { locations: {}, edges: null, routes: new Set() };

const routeKey = (edge: EdgeDef) => `edge:${edge.kind}:${edgeKey(edge.a, edge.b)}`;
const cityOf = (id: CityId) => pack.cities.find((city) => city.id === id)!;

function chartOf(world: World): Chart {
  const { locations, edges, routes } = world.campaign;
  return { locations, edges, routes };
}

/** The city a region's reveal is watched from: the one nearest the middle of the ground it opened. */
function middleOf(cities: CityId[]): CityId {
  const lat = cities.reduce((sum, id) => sum + cityOf(id).lat, 0) / cities.length;
  const lon = cities.reduce((sum, id) => sum + cityOf(id).lon, 0) / cities.length;
  const far = (id: CityId) => (cityOf(id).lat - lat) ** 2 + (cityOf(id).lon - lon) ** 2;
  return cities.reduce((best, id) => (far(id) < far(best) ? id : best));
}

/** Each place a scene changes the map, in the order it names them, with what changes there. */
function beatsOf(opening: Opening, before: Chart, after: Chart): Beat[] {
  const beats: Beat[] = [];
  const at = (city: CityId, keys: string[]) => {
    if (!keys.length) return;
    const beat = beats.find((entry) => entry.city === city);
    if (beat) for (const key of keys) beat.keys.add(key);
    else beats.push({ city, keys: new Set(keys) });
  };
  const changed = (city: CityId) =>
    JSON.stringify(before.locations[city]) !== JSON.stringify(after.locations[city])
      ? [`city:${city}`]
      : [];
  const edgeChanged = (edge: EdgeDef) => {
    const key = routeKey(edge);
    return before.edges.some((entry) => routeKey(entry) === key) !==
      after.edges.some((entry) => routeKey(entry) === key)
      ? [key]
      : [];
  };
  const unlocks = openingUnlocks(opening);
  const havens = new Set(unlocks.flatMap((unlock) => (unlock.t === "haven" ? [unlock.city] : [])));
  for (const unlock of unlocks) {
    switch (unlock.t) {
      case "region": {
        const opened = pack.cities
          .filter((city) => city.region === unlock.region)
          .map((city) => city.id);
        const shown = opened.filter((id) => changed(id).length);
        if (!shown.length) break;
        // A haven brought with its region is what the table is looking for.
        const anchor = shown.find((id) => havens.has(id)) ?? middleOf(shown);
        at(anchor, [...shown.flatMap(changed), ...(unlock.connect ?? []).flatMap(edgeChanged)]);
        break;
      }
      case "haven":
      case "lab":
      case "infest":
      case "forsake":
        at(unlock.city, changed(unlock.city));
        break;
      case "destroy":
        at(unlock.city, [
          ...changed(unlock.city),
          ...before.edges
            .filter((edge) => edge.a === unlock.city || edge.b === unlock.city)
            .flatMap(edgeChanged),
        ]);
        break;
      case "edge": {
        const { a, b } = unlock.edge;
        // A line to somewhere new is watched from its new end.
        const far = before.locations[b]?.revealed ? a : b;
        at(far, edgeChanged(unlock.edge));
        break;
      }
      case "route":
        if (!before.routes.includes(unlock.route) && after.routes.includes(unlock.route)) {
          const route = pack.reconRoutes.find((entry) => entry.id === unlock.route);
          if (route) at(route.city, [`route:${unlock.route}`]);
        }
        break;
    }
  }
  return beats;
}

/** Which openings of a briefing the map shows: those drawn before the newest, and the newest once it is charted. */
function shownCount(world: World, total: number) {
  const progress = world.table.briefing;
  if (progress.stowing) return total;
  return Math.min(total, Math.max(0, progress.drawn - (progress.charted ? 0 : 1)));
}

/**
 * Plays what a Legacy reading changes on the map once the table has heard its story and asked to see it (`charted`).
 * The state took every change at once when the cards were read, so the board shows each part as it was until then:
 * the Unboxing steps off the table, the camera finds the place, and the fog, the location or the line comes in. Every
 * step is a command, so each browser plays it as the command arrives.
 */
export class LegacyShow {
  /** The Unboxing stands aside while a change plays on the board. */
  aside = $state(false);
  focus = $state.raw<CityId | null>(null);

  private held = $state.raw<Set<string>>(new Set());
  private before = $state.raw<Chart | null>(null);
  private last: Chart | null = null;
  private key = "";
  private beats: Beat[][] = [];
  private shown = 0;
  private queue: Beat[] = [];
  private playing = false;
  private run = 0;
  private world = $state.raw<World | null>(null);

  readonly lag: MapLag = $derived.by(() => {
    const before = this.before;
    const held = this.held;
    const world = this.world;
    if (!before || !held.size || !world) return NO_LAG;
    const locations: MapLag["locations"] = {};
    for (const key of held)
      if (key.startsWith("city:")) {
        const city = key.slice(5) as CityId;
        locations[city] = before.locations[city];
      }
    const edges = [...held].some((key) => key.startsWith("edge:"))
      ? [
          ...world.campaign.edges.filter((edge) => !held.has(routeKey(edge))),
          ...before.edges.filter((edge) => held.has(routeKey(edge))),
        ]
      : null;
    const routes = new Set(
      [...held].flatMap((key) => (key.startsWith("route:") ? [key.slice(6)] : [])),
    );
    return { locations, edges, routes };
  });

  /** Takes in the newest state. `live` is false for a jump that nobody lived through, which only catches up. */
  observe(world: World, live: boolean) {
    this.world = world;
    const previous = this.last;
    this.last = chartOf(world);
    const briefing = world.campaign.briefing;
    const key = briefing.length ? JSON.stringify(briefing) : "";
    if (key !== this.key) {
      this.stop();
      this.key = key;
      // Only a briefing that arrived while this screen watched knows what the map looked like before it.
      if (!key || !live || !previous) return;
      const steps = openings(briefing);
      const after = chartOf(world);
      this.before = previous;
      this.beats = steps.map((step) => beatsOf(step, previous, after));
      this.shown = shownCount(world, steps.length);
      this.hold();
      return;
    }
    if (!this.before) return;
    if (!live) return this.stop();
    const shown = shownCount(world, this.beats.length);
    const turned = this.beats.slice(this.shown, shown).flat();
    const jump = shown < this.shown || shown - this.shown > MOST_OPENINGS;
    this.shown = shown;
    if (jump) {
      this.queue = [];
      this.hold();
      return;
    }
    if (!turned.length) return;
    this.queue.push(...turned);
    if (!this.playing) void this.play(this.run);
  }

  stop() {
    this.run++;
    this.queue = [];
    this.playing = false;
    this.before = null;
    this.beats = [];
    this.held = new Set();
    this.aside = false;
    this.focus = null;
  }

  /** Holds back what the scenes not yet turned over change, and what waits its turn on the board. */
  private hold() {
    const held = new Set<string>();
    for (const beat of [...this.beats.slice(this.shown).flat(), ...this.queue])
      for (const key of beat.keys) held.add(key);
    this.held = held;
  }

  private async play(run: number) {
    this.playing = true;
    const wait = (ms: number) =>
      new Promise<boolean>((done) => setTimeout(() => done(this.run === run), ms));
    this.hold();
    if (!(await wait(250))) return;
    for (;;) {
      const beat = this.queue.shift();
      if (!beat) break;
      this.aside = true;
      this.focus = beat.city;
      if (!(await wait(1150))) return;
      this.hold();
      // The fog takes a few seconds to ink in a region, from its cities outward.
      if (!(await wait(3600))) return;
    }
    this.focus = null;
    if (!(await wait(950))) return;
    this.aside = false;
    this.playing = false;
  }
}
