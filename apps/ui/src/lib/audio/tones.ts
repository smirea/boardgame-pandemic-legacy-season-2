import { hollowInPlay, pack } from "@repo/game";
import type { Campaign } from "@repo/game";

export type Tone = {
  label: string;
  /** The campaign event the score moves into this tone on. */
  since: string;
  /** Hz of the pad's lowest voice. */
  root: number;
  /** Seven semitone offsets from the root. */
  scale: readonly number[];
  /** Semitones from the root to the pad's second voice. */
  drone: number;
  /** How far the pad's filter opens, as a factor. */
  light: number;
  /** 0..1: how uneasy the land and sea are before a game adds its own crisis. It decides which creatures call. */
  dread: number;
  /** A bell tolls through it. */
  toll?: true;
};

/** In campaign order: the tone in force is the last one whose event has happened. */
export const TONES = {
  adrift: {
    label: "Adrift",
    since: "The campaign begins on the havens",
    root: 73.42,
    scale: [0, 2, 3, 5, 7, 8, 10],
    drone: 7,
    light: 1,
    dread: 0.1,
  },
  frontier: {
    label: "Frontier",
    since: "The first region beyond the starting grid is reconned",
    root: 82.41,
    scale: [0, 2, 3, 5, 7, 9, 10],
    drone: 7,
    light: 1.25,
    dread: 0,
  },
  betrayed: {
    label: "Betrayed",
    since: "May: the journal tells why the leaders left (05-02)",
    root: 65.41,
    scale: [0, 2, 3, 5, 7, 8, 11],
    drone: 8,
    light: 0.9,
    dread: 0.3,
  },
  hunted: {
    label: "Hunted",
    since: "Hollow Men reach the board",
    root: 69.3,
    scale: [0, 1, 3, 5, 7, 8, 10],
    drone: 7,
    light: 0.75,
    dread: 0.55,
  },
  exposed: {
    label: "Exposed",
    since: "September: the inoculation is wearing off (Door R)",
    root: 61.74,
    scale: [0, 1, 3, 5, 6, 8, 10],
    drone: 6,
    light: 0.8,
    dread: 0.7,
  },
  utopia: {
    label: "Utopia",
    since: "Utopia is found (Package 3) or the Hollow Men defect (Door 17)",
    root: 87.31,
    scale: [0, 2, 4, 6, 7, 9, 11],
    drone: 7,
    light: 1.5,
    dread: 0.45,
  },
  reckoning: {
    label: "Reckoning",
    since: "December",
    root: 73.42,
    scale: [0, 2, 3, 5, 7, 8, 10],
    drone: 5,
    light: 0.85,
    dread: 0.6,
    toll: true,
  },
} satisfies Record<string, Tone>;

export type ToneId = keyof typeof TONES;

const startingRegions = pack.regions.filter((region) => region.startsRevealed).length;
const betrayal = pack.legacyDeck.findIndex((card) => card.id === "05-02");
if (betrayal < 0) throw new Error("The Legacy deck has no card 05-02 for the score to turn on");

export function campaignTone(campaign: Campaign): ToneId {
  if (campaign.month >= 12) return "reckoning";
  if (campaign.opened.includes("package:3") || campaign.opened.includes("door:17")) return "utopia";
  if (campaign.rules.includes("epidemicFromStorage")) return "exposed";
  if (hollowInPlay(campaign)) return "hunted";
  if (campaign.legacyIndex > betrayal) return "betrayed";
  if (campaign.regions.length > startingRegions) return "frontier";
  return "adrift";
}
