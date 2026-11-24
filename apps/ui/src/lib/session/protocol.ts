import type { Command, GameRecord } from "@repo/game";
import type { StateMsg } from "./sync";

export type Point = { x: number; z: number };

export type Stroke = { id: string; points: Point[] };

export type CursorTool = "pen" | "eraser";

/** What players draw on the map and point at. The host passes each one on to everyone else. */
export type SketchMsg =
  /** Points added to the end of one of a player's strokes, which starts the stroke if it is new. */
  | { t: "stroke"; player: string; id: string; points: Point[] }
  /** All of a player's strokes, in place of what was held: after an erase, and for a browser that just joined. */
  | { t: "strokes"; player: string; strokes: Stroke[] }
  | { t: "draw-clear" }
  | { t: "ping"; id: string; player: string; x: number; z: number };

export type Msg =
  | StateMsg
  /** A peer that missed a change asks for the whole state. */
  | { t: "resync" }
  | { t: "command"; command: Command }
  | { t: "rejected"; reason: string }
  /** A peer asks for the host's recording of the game, which only the host keeps. */
  | { t: "record-ask" }
  | { t: "record"; record: GameRecord | null }
  | SketchMsg;

/** A cursor position on the board plane, with the drawing tool held if any, or null when off the board. */
export type Presence = (Point & { tool?: CursorTool }) | null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isPoint = (value: unknown) =>
  isRecord(value) && Number.isFinite(value["x"]) && Number.isFinite(value["z"]);
const isPoints = (value: unknown) => Array.isArray(value) && value.every(isPoint);
const isStroke = (value: unknown) =>
  isRecord(value) && typeof value["id"] === "string" && isPoints(value["points"]);

/**
 * Wire boundary. Friends are trusted not to forge states, but a malformed frame must not reach the
 * actor, so each message is checked for its tag and the fields the handlers read.
 */
export function parseMsg(raw: unknown): Msg {
  if (!isRecord(raw)) throw new TypeError("message is not an object");
  const ok = (() => {
    switch (raw["t"]) {
      case "state":
        return (
          Number.isInteger(raw["seq"]) &&
          isRecord(raw["state"]) &&
          typeof raw["state"]["phase"] === "string" &&
          isRecord(raw["state"]["world"])
        );
      case "patch":
        return (
          Number.isInteger(raw["seq"]) &&
          Array.isArray(raw["patch"]) &&
          raw["patch"].every((entry) => isRecord(entry) && Array.isArray(entry["p"]))
        );
      case "resync":
      case "record-ask":
      case "draw-clear":
        return true;
      case "command":
        return isRecord(raw["command"]) && typeof raw["command"]["type"] === "string";
      case "rejected":
        return typeof raw["reason"] === "string";
      case "record":
        return raw["record"] === null || isRecord(raw["record"]);
      case "stroke":
        return (
          typeof raw["player"] === "string" &&
          typeof raw["id"] === "string" &&
          isPoints(raw["points"])
        );
      case "strokes":
        return (
          typeof raw["player"] === "string" &&
          Array.isArray(raw["strokes"]) &&
          raw["strokes"].every(isStroke)
        );
      case "ping":
        return typeof raw["id"] === "string" && typeof raw["player"] === "string" && isPoint(raw);
      default:
        return false;
    }
  })();
  if (!ok) throw new TypeError(`malformed ${String(raw["t"])} message`);
  return raw as Msg;
}

export function parsePresence(raw: unknown): Presence {
  if (raw === null) return null;
  if (!isPoint(raw)) throw new TypeError("bad presence");
  const { x, z, tool } = raw as { x: number; z: number; tool?: unknown };
  if (tool === undefined) return { x, z };
  if (tool !== "pen" && tool !== "eraser") throw new TypeError("bad presence tool");
  return { x, z, tool };
}
