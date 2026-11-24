import { breakthrough, inoculation, isForsaken, LABS, mapNotes, pack } from "@repo/game";
import type { CityId, EdgeDef, Insights, ReconBox, SeatId, World } from "@repo/game";
import { travelOf } from "#lib/board/travel.ts";
import type { BoardMarks, BoardView, CitySpot, CityView, Fx, LabInfo } from "#lib/board/types.ts";
import { reconciler } from "#lib/reconcile.ts";
import type { SessionView } from "#lib/session/session.svelte.ts";
import type { Lag } from "./infectionShow.svelte.ts";
import type { MapLag } from "./legacyShow.svelte.ts";
import { cityName, SEAT_COLORS, seatColor, seatName } from "./labels.svelte.ts";

const LAB_META: Record<string, { id?: keyof typeof LABS; name: string; effect: string | null }> = {
  [LABS.opal]: {
    id: "opal",
    name: "Opal Lab",
    effect: "Make Supplies at a haven or supply center takes +1 cube.",
  },
  [LABS.jade]: {
    id: "jade",
    name: "Jade Lab",
    effect: "Epidemics remove only 1 supply cube from the city they strike.",
  },
  [LABS.topaz]: {
    id: "topaz",
    name: "Topaz Lab",
    effect: "Discard a matching City card to prevent losing a cube to infection.",
  },
  "lake-baikal": { name: "Pearl Lab", effect: null },
};

/** What the board is drawn from. Each is read where it is used, so a part of the board follows only what it shows. */
export type BoardSource = {
  readonly world: World;
  readonly playing: boolean;
  readonly info: Insights | null;
  readonly onGrid: ReadonlySet<CityId>;
  /** Changes the state already holds that the infection show has not played yet. */
  readonly lag: Lag;
  /** Game End's population changes the population show has not reached yet. */
  readonly populationLag: Partial<Record<CityId, number>>;
  /** The map as it was before a Legacy reading, for each change whose scene the Unboxing has not played yet. */
  readonly mapLag: MapLag;
  readonly skull: BoardView["skull"];
  /** The city whose ring of actions is open. */
  readonly selected: CityId | null;
  /** The cities lit as places an action or card can go. */
  readonly targets: ReadonlySet<CityId>;
  /** The cities a card under the pointer could go to. */
  readonly hints: ReadonlySet<CityId>;
  /** The cities a counter in the top bar points at while the pointer rests on it. */
  readonly spots: ReadonlyMap<CityId, CitySpot>;
  /** Cities a card that takes several places has picked so far, with how many times. */
  readonly picked: ReadonlyMap<CityId, number>;
  /** Recon boxes lit for a click, when Recon was started from somewhere that does not name the route. */
  readonly aimedRecons: ReadonlySet<string>;
  readonly ghostEdges: EdgeDef[];
  readonly recons: ReconBox[];
  readonly spectator: boolean;
  readonly canAct: boolean;
  readonly solo: boolean;
  litPawn(seat: SeatId): boolean;
  pickablePawn(seat: SeatId): boolean;
  readonly session: Pick<SessionView, "cursors" | "drawings" | "pings" | "peers" | "player">;
  readonly fx: Fx[];
  readonly marks: BoardMarks | undefined;
};

const NO_CARDS = { inDeck: 0, inHands: 0, discarded: 0 };

/**
 * The board's view of the game. Every part is worked out on its own and handed over as the same object for as long
 * as it holds the same values, so a pointer crossing the table, a peer's cursor or a card being drawn redraws only
 * the pieces it changed. One object rebuilt whole on every change made every city repaint its name.
 */
export function createBoardView(source: BoardSource): BoardView {
  const game = $derived(source.world.game);
  const campaign = $derived(source.world.campaign);

  const colorOf = (player: string) => {
    const seat = source.world.table.seats.find((entry) => entry.player === player)?.seat;
    if (seat && game?.seats.includes(seat)) return seatColor(seat);
    if (player === source.session.player) return SEAT_COLORS[0]!;
    const peer = source.session.peers.findIndex((entry) => entry.id === player);
    return SEAT_COLORS[(Math.max(0, peer) + 1) % SEAT_COLORS.length]!;
  };
  const nameOf = (player: string) =>
    source.world.table.seats.find((entry) => entry.player === player)?.name ??
    source.session.peers.find((peer) => peer.id === player)?.name ??
    "Player";

  const sameCities = reconciler<Record<CityId, CityView>>();
  const cities = $derived.by(() => {
    const info = source.playing ? source.info : null;
    const { lag, mapLag, populationLag, onGrid, selected, targets, hints, spots, picked } = source;
    const stocks = inoculation(source.world);
    const storageLeaks = campaign.rules.includes("epidemicFromStorage");
    return sameCities(
      Object.fromEntries(
        pack.cities.map((city): [CityId, CityView] => {
          const record = mapLag.locations[city.id] ?? campaign.locations[city.id]!;
          const location = game?.locations[city.id];
          const held = lag.cities[city.id];
          const labMeta = record.lab ? LAB_META[city.id] : undefined;
          const labActive = labMeta?.id ? breakthrough(campaign, labMeta.id) : false;
          const labInfo: LabInfo | null = record.lab
            ? {
                name: labMeta?.name ?? "Lab",
                effect: labActive ? (labMeta?.effect ?? null) : null,
                active: labActive,
                ...(city.id === "lake-baikal" && campaign.rules.includes("carrier")
                  ? {
                      doses: {
                        left: Math.max(0, pack.numbers.selfInfectDoses - campaign.dosesUsed),
                        total: pack.numbers.selfInfectDoses,
                      },
                    }
                  : {}),
              }
            : null;
          return [
            city.id,
            {
              name: cityName(city.id),
              revealed: record.revealed,
              onGrid: onGrid.has(city.id),
              supplies: (location?.supplies ?? 0) - (held?.supplies ?? 0),
              plague: (location?.plague ?? 0) - (held?.plague ?? 0),
              hollow: (location?.hollow ?? 0) - (held?.hollow ?? 0),
              population: record.population - (populationLag[city.id] ?? 0),
              port: city.port,
              haven: city.kind === "haven",
              structures: (["center", "tower", "shelter"] as const)
                .map((kind) => ({
                  kind,
                  permanent: record.permanent.includes(kind),
                  placed: Boolean(location?.[kind]),
                }))
                .filter((entry) => entry.permanent || entry.placed),
              inGame: game !== null,
              infested: record.infested,
              forsaken:
                (record === campaign.locations[city.id]
                  ? isForsaken(campaign, city.id)
                  : campaign.rules.includes("forsaken") &&
                    city.kind === "city" &&
                    record.population === 0) && !populationLag[city.id],
              lab: record.lab,
              labInfo,
              highlight:
                selected === city.id
                  ? "selected"
                  : targets.has(city.id)
                    ? "target"
                    : hints.has(city.id)
                      ? "hint"
                      : null,
              spot: spots.get(city.id) ?? null,
              picks: picked.get(city.id) ?? 0,
              infection:
                info && city.kind !== "haven"
                  ? {
                      odds: info.infection.odds[city.id] ?? 0,
                      hollow: info.infection.hollow ? (info.infection.hollow[city.id] ?? 0) : null,
                      inDeck: info.infection.strata.reduce(
                        (sum, stratum) => sum + (stratum.cities[city.id] ?? 0),
                        0,
                      ),
                      discarded: info.infection.discard[city.id] ?? 0,
                    }
                  : null,
              cards:
                info && city.kind !== "haven"
                  ? (info.playerDeck.cities[city.id] ?? NO_CARDS)
                  : null,
              stock: stocks[city.id] ?? null,
              inoculated: (stocks[city.id]?.stored ?? 0) > 0 && stocks[city.id]!.inPlay === 0,
              storageLeaks,
            },
          ];
        }),
      ) as Record<CityId, CityView>,
    );
  });

  const sameRecon = reconciler<BoardView["recon"]>();
  const recon = $derived(
    sameRecon(
      source.recons
        .filter((box) => !source.mapLag.routes.has(box.route.id))
        .map((box) => ({
          route: box.route.id,
          city: box.route.city,
          cityName: cityName(box.route.city),
          name: box.name,
          color: box.route.color,
          count: box.route.count,
          unique: box.route.unique,
          needsCenter: box.route.needsCenter,
          reveals: box.reveals,
          aimed: source.aimedRecons.has(box.route.id),
          ...(source.spectator
            ? { state: "idle" as const, reason: null }
            : !source.canAct
              ? { state: "blocked" as const, reason: "Not your turn" }
              : box.actions.length
                ? { state: "ready" as const, reason: null }
                : { state: "blocked" as const, reason: box.reason }),
        })),
    ),
  );

  const sameNotes = reconciler<BoardView["notes"]>();
  const notes = $derived(sameNotes(mapNotes(campaign)));

  // How each pawn made its most recent move, which picks its vehicle and the way it goes. Worked out apart from the
  // pawns, since it reads the whole log and a pawn lights up far more often than it moves.
  const sameMoves = reconciler<Partial<Record<SeatId, ReturnType<typeof travelOf>>>>();
  const lastMoves = $derived.by(() => {
    const moves: Partial<Record<SeatId, ReturnType<typeof travelOf>>> = {};
    const log = game?.log ?? [];
    const seats = new Set(game?.seats ?? []);
    for (let index = log.length - 1; index >= 0 && seats.size > 0; index--) {
      const entry = log[index]!;
      if (entry.t !== "move" || !seats.delete(entry.seat)) continue;
      moves[entry.seat] = travelOf(entry, campaign.edges);
    }
    return sameMoves(moves);
  });

  const samePawns = reconciler<BoardView["pawns"]>();
  const pawns = $derived(
    samePawns(
      (game?.seats ?? []).map((seat) => ({
        id: seat,
        city: game!.players[seat]!.location,
        color: seatColor(seat),
        name: seatName(source.world, seat),
        active: game!.active === seat && source.playing,
        lit: source.litPawn(seat),
        pickable: source.pickablePawn(seat),
        carried: game!.players[seat]!.supplies,
        carrier: Boolean(campaign.characters[game!.players[seat]!.character]?.carrier),
        ...(lastMoves[seat] ?? { travel: "land" as const, course: null }),
      })),
    ),
  );

  const sameCursors = reconciler<BoardView["cursors"]>();
  const cursors = $derived(
    sameCursors(
      Object.entries(source.session.cursors).map(([id, point]) => ({
        id,
        name: nameOf(id),
        color: colorOf(id),
        ...point,
      })),
    ),
  );

  const sameDrawings = reconciler<NonNullable<BoardView["drawings"]>>();
  const drawings = $derived(
    sameDrawings(
      Object.entries(source.session.drawings)
        .filter(([, strokes]) => strokes.length > 0)
        .map(([id, strokes]) => ({ id, color: colorOf(id), strokes })),
    ),
  );

  const pings = $derived(
    source.session.pings.map((ping) => ({
      id: ping.id,
      x: ping.x,
      z: ping.z,
      color: colorOf(ping.player),
      name: source.solo ? null : nameOf(ping.player),
      createdAt: ping.createdAt,
      duration: ping.duration,
    })),
  );

  const edges = $derived(source.mapLag.edges ?? campaign.edges);

  const stockpile = $derived(game ? game.stockpile - source.lag.stockpile : null);
  const reserve = $derived(game ? game.reserve : null);

  return {
    get cities() {
      return cities;
    },
    get edges() {
      return edges;
    },
    get ghostEdges() {
      return source.ghostEdges;
    },
    get recon() {
      return recon;
    },
    get notes() {
      return notes;
    },
    get pawns() {
      return pawns;
    },
    get stockpile() {
      return stockpile;
    },
    get reserve() {
      return reserve;
    },
    get cursors() {
      return cursors;
    },
    get drawings() {
      return drawings;
    },
    get pings() {
      return pings;
    },
    get fx() {
      return source.fx;
    },
    get skull() {
      return source.skull;
    },
    get marks() {
      return source.marks;
    },
  };
}
