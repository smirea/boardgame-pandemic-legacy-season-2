import type { Point, SketchMsg, Stroke } from './protocol';

export const PING_DURATION_MS = 10_000;

export type MapPing = { id: string; player: string; x: number; z: number; createdAt: number; duration: number };

/** A pen sends its new points this often, and an eraser what it left. Both feel live and neither floods the link. */
const PEN_INTERVAL_MS = 33;
const ERASE_INTERVAL_MS = 100;

/**
 * What the table draws on the map and points at, shared live. It is not game state: nothing here is saved, and a
 * browser that joins is sent what is on the map at that moment. A pen stroke travels as the points added to it, so
 * a long drawing costs no more to extend than a short one.
 */
export class Sketch {
	drawings = $state.raw<Record<string, Stroke[]>>({});
	pings = $state.raw<MapPing[]>([]);

	readonly #self: string;
	readonly #send: (msg: SketchMsg) => void;
	/** Points drawn here and not yet sent, by stroke. */
	readonly #pen = new Map<string, Point[]>();
	/** Players whose strokes an eraser here changed and whose new strokes are not yet sent. */
	readonly #erased = new Set<string>();
	#timer: ReturnType<typeof setTimeout> | null = null;
	#lastSent = -Infinity;
	#pingSeq = 0;
	readonly #pingTimers = new Set<ReturnType<typeof setTimeout>>();

	constructor(self: string, send: (msg: SketchMsg) => void) {
		this.#self = self;
		this.#send = send;
	}

	#set(player: string, strokes: Stroke[]) {
		const { [player]: _gone, ...rest } = this.drawings;
		this.drawings = strokes.length ? { ...rest, [player]: strokes } : rest;
	}

	#extend(player: string, id: string, points: Point[]) {
		const strokes = this.drawings[player] ?? [];
		const index = strokes.findIndex(stroke => stroke.id === id);
		const next = strokes.slice();
		if (index < 0) next.push({ id, points });
		else next[index] = { id, points: [...strokes[index]!.points, ...points] };
		this.#set(player, next);
	}

	#schedule(interval: number) {
		if (this.#timer !== null) return;
		this.#timer = setTimeout(() => this.flush(), Math.max(0, this.#lastSent + interval - performance.now()));
	}

	/** Sends whatever was drawn or erased here since the last send. */
	flush() {
		if (this.#timer !== null) clearTimeout(this.#timer);
		this.#timer = null;
		this.#lastSent = performance.now();
		// An erase replaces a player's strokes whole, so it goes before any points drawn after it.
		for (const player of this.#erased) this.#send({ t: 'strokes', player, strokes: this.drawings[player] ?? [] });
		this.#erased.clear();
		for (const [id, points] of this.#pen) this.#send({ t: 'stroke', player: this.#self, id, points });
		this.#pen.clear();
	}

	/** Adds a point to this player's stroke `id`, starting it if it is new. */
	stroke(id: string, point: Point) {
		this.#extend(this.#self, id, [point]);
		this.#pen.set(id, [...(this.#pen.get(id) ?? []), point]);
		this.#schedule(PEN_INTERVAL_MS);
	}

	/** Puts `strokes` in place of a player's strokes, as an eraser does to whoever's lines it crosses. */
	redraw(player: string, strokes: Stroke[]) {
		this.#set(player, strokes);
		this.#erased.add(player);
		this.#schedule(ERASE_INTERVAL_MS);
	}

	clear() {
		this.#pen.clear();
		this.#erased.clear();
		if (Object.keys(this.drawings).length === 0) return;
		this.drawings = {};
		this.#send({ t: 'draw-clear' });
	}

	ping(point: Point) {
		const msg = {
			t: 'ping' as const,
			id: `${this.#self}-${Date.now()}-${++this.#pingSeq}`,
			player: this.#self,
			...point,
		};
		this.receive(msg);
		this.#send(msg);
	}

	/** Takes in what another browser drew, erased or pointed at. */
	receive(msg: SketchMsg) {
		if (msg.t === 'stroke') this.#extend(msg.player, msg.id, msg.points);
		else if (msg.t === 'strokes') this.#set(msg.player, msg.strokes);
		else if (msg.t === 'draw-clear') {
			this.#pen.clear();
			this.#erased.clear();
			this.drawings = {};
		} else {
			const ping = { id: msg.id, player: msg.player, x: msg.x, z: msg.z, createdAt: performance.now() };
			this.pings = [...this.pings, { ...ping, duration: PING_DURATION_MS }];
			const timer = setTimeout(() => {
				this.#pingTimers.delete(timer);
				this.pings = this.pings.filter(entry => entry.id !== ping.id);
			}, PING_DURATION_MS + 80);
			this.#pingTimers.add(timer);
		}
	}

	/** Everything on the map now, for a browser that just joined. */
	whole(): SketchMsg[] {
		this.flush();
		return Object.entries(this.drawings).map(([player, strokes]) => ({ t: 'strokes', player, strokes }));
	}

	dispose() {
		if (this.#timer !== null) clearTimeout(this.#timer);
		for (const timer of this.#pingTimers) clearTimeout(timer);
	}
}
