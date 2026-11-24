import { TIMBRES } from "./themes.ts";
import { burst, cry, sing, type ScoreBus } from "./voices.ts";

type Call = (bus: ScoreBus, dest: AudioNode, at: number) => void;

type Creature = {
  label: string;
  habitat: "sea" | "land";
  /** The dread it is heard between: songbirds leave as things darken, and crows arrive. */
  dread: readonly [from: number, to: number];
  call: Call;
};

const vary = (spread: number) => 1 + (Math.random() * 2 - 1) * spread;

/** Somewhere off to one side and far away: the further, the more of the call is its echo. */
function place(bus: ScoreBus, dest: AudioNode, far: number): AudioNode {
  const pan = bus.ctx.createStereoPanner();
  pan.pan.value = Math.random() * 1.6 - 0.8;
  pan.connect(dest);
  const wet = bus.ctx.createGain();
  wet.gain.value = far;
  pan.connect(wet);
  wet.connect(bus.reverb);
  return pan;
}

export const CREATURES = {
  whale: {
    label: "Whale",
    habitat: "sea",
    dread: [0, 0.8],
    call(bus, dest, at) {
      const here = place(bus, dest, 0.9);
      const key = 178 * vary(0.14);
      cry(bus, here, {
        wave: "triangle",
        at,
        length: 3.1,
        level: 0.11,
        attack: 1.1,
        contour: [
          [0, key],
          [0.7, key * 1.5],
          [1, key * 1.42],
        ],
        vibrato: [4.2, 14],
      });
      cry(bus, here, {
        wave: "triangle",
        at: at + 2.6,
        length: 3.6,
        level: 0.075,
        attack: 0.7,
        contour: [
          [0, key * 1.5],
          [0.35, key * 1.62],
          [1, key * 0.8],
        ],
        vibrato: [3.6, 18],
      });
      if (Math.random() < 0.5) {
        cry(bus, here, {
          wave: "sine",
          at: at + 6.4,
          length: 1.5,
          level: 0.044,
          attack: 0.3,
          contour: [
            [0, key * 3],
            [0.4, key * 4.6],
            [1, key * 3.4],
          ],
        });
      }
    },
  },
  dolphin: {
    label: "Dolphin",
    habitat: "sea",
    dread: [0, 0.3],
    call(bus, dest, at) {
      const here = place(bus, dest, 0.5);
      const key = 2400 * vary(0.1);
      for (let i = 0; i < 2; i++) {
        cry(bus, here, {
          wave: "sine",
          at: at + i * 0.45,
          length: 0.32,
          level: 0.03,
          contour: [
            [0, key],
            [0.5, key * 1.8],
            [1, key * 1.3],
          ],
        });
      }
      for (let i = 0; i < 9; i++) {
        burst(bus, here, {
          color: "white",
          at: at + 1.05 + i * 0.045,
          length: 0.012,
          level: 0.03,
          attack: 0.001,
          filter: ["highpass", 3500],
        });
      }
    },
  },
  gull: {
    label: "Gull",
    habitat: "sea",
    dread: [0, 0.5],
    call(bus, dest, at) {
      const here = place(bus, dest, 0.6);
      const key = 1250 * vary(0.12);
      const cries = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < cries; i++) {
        const hz = key * (1 - i * 0.045);
        cry(bus, here, {
          wave: "sawtooth",
          at: at + i * 0.47,
          length: 0.36,
          level: 0.19 * (1 - i * 0.12),
          attack: 0.03,
          contour: [
            [0, hz * 0.72],
            [0.3, hz],
            [1, hz * 0.62],
          ],
          band: [hz * 1.5, 1.2],
        });
      }
    },
  },
  buoy: {
    label: "Bell buoy",
    habitat: "sea",
    dread: [0.15, 1],
    call(bus, dest, at) {
      const here = place(bus, dest, 0.7);
      const hz = 494 * vary(0.03);
      sing(bus, TIMBRES.bell, { at, hz, slot: 1, level: 0.08, dest: here, echo: 0 });
      sing(bus, TIMBRES.bell, {
        at: at + 1.3 + Math.random(),
        hz,
        slot: 1,
        level: 0.056,
        dest: here,
        echo: 0,
      });
    },
  },
  hull: {
    label: "Hull groan",
    habitat: "sea",
    dread: [0.5, 1],
    call(bus, dest, at) {
      const key = 58 * vary(0.1);
      cry(bus, place(bus, dest, 0.8), {
        wave: "sawtooth",
        at,
        length: 2.8,
        level: 0.55,
        attack: 0.5,
        contour: [
          [0, key],
          [0.5, key * 0.84],
          [1, key * 1.05],
        ],
        band: [260, 5],
        rasp: 11,
      });
    },
  },
  songbird: {
    label: "Songbird",
    habitat: "land",
    dread: [0, 0.3],
    call(bus, dest, at) {
      const here = place(bus, dest, 0.4);
      let when = at;
      for (let phrase = 0; phrase < 2; phrase++) {
        const chirps = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < chirps; i++) {
          const hz = 2600 + Math.random() * 1300;
          cry(bus, here, {
            wave: "sine",
            at: when,
            length: 0.07 + Math.random() * 0.03,
            level: 0.055,
            attack: 0.008,
            contour: [
              [0, hz],
              [1, hz * 1.35],
            ],
          });
          when += 0.13;
        }
        when += 0.9;
      }
    },
  },
  loon: {
    label: "Loon",
    habitat: "land",
    dread: [0, 0.65],
    call(bus, dest, at) {
      const here = place(bus, dest, 0.9);
      const key = 620 * vary(0.06);
      for (const [after, level] of [
        [0, 0.08],
        [2.8, 0.06],
      ] as const) {
        cry(bus, here, {
          wave: "sine",
          at: at + after,
          length: 1.9,
          level,
          attack: 0.25,
          hold: 0.7,
          contour: [
            [0, key],
            [0.25, key * 1.5],
            [0.7, key * 1.45],
            [1, key * 1.03],
          ],
          vibrato: [5.5, 8],
        });
      }
    },
  },
  crickets: {
    label: "Crickets",
    habitat: "land",
    dread: [0, 0.45],
    call(bus, dest, at) {
      const here = place(bus, dest, 0.2);
      const hz = 4200 * vary(0.08);
      for (let i = 0; i < 5; i++) {
        cry(bus, here, {
          wave: "sine",
          at: at + i * 0.8,
          length: 0.42,
          level: 0.042,
          attack: 0.05,
          hold: 0.8,
          contour: [
            [0, hz],
            [1, hz],
          ],
          rasp: 31,
        });
      }
    },
  },
  owl: {
    label: "Owl",
    habitat: "land",
    dread: [0.25, 0.85],
    call(bus, dest, at) {
      const here = place(bus, dest, 0.7);
      const key = 340 * vary(0.08);
      for (const [after, length] of [
        [0, 0.3],
        [0.52, 0.16],
        [0.74, 0.22],
        [1.3, 0.5],
      ] as const) {
        cry(bus, here, {
          wave: "sine",
          at: at + after,
          length,
          level: 0.08,
          attack: 0.06,
          contour: [
            [0, key * 1.04],
            [1, key * 0.94],
          ],
        });
      }
    },
  },
  wolf: {
    label: "Wolf",
    habitat: "land",
    dread: [0.45, 1],
    call(bus, dest, at) {
      const howl = (when: number, key: number, level: number) => {
        const here = place(bus, dest, 1);
        for (const [wave, share] of [
          ["sine", 1],
          ["triangle", 0.3],
        ] as const) {
          cry(bus, here, {
            wave,
            at: when,
            length: 3.4,
            level: level * share,
            attack: 0.45,
            hold: 0.72,
            contour: [
              [0, key],
              [0.22, key * 1.62],
              [0.72, key * 1.69],
              [1, key * 1.2],
            ],
            vibrato: [5, 10],
          });
        }
      };
      const key = 290 * vary(0.08);
      howl(at, key, 0.057);
      if (Math.random() < 0.5) howl(at + 2.9, key * 0.84, 0.038);
    },
  },
  crow: {
    label: "Crow",
    habitat: "land",
    dread: [0.55, 1],
    call(bus, dest, at) {
      const here = place(bus, dest, 0.5);
      const key = 520 * vary(0.08);
      for (let i = 0; i < 3; i++) {
        cry(bus, here, {
          wave: "sawtooth",
          at: at + i * 0.36,
          length: 0.2,
          level: 0.5,
          attack: 0.012,
          contour: [
            [0, key],
            [1, key * 0.83],
          ],
          band: [1500, 2.2],
          rasp: 68,
        });
      }
    },
  },
} satisfies Record<string, Creature>;

export type CreatureId = keyof typeof CREATURES;

const ids = Object.keys(CREATURES) as CreatureId[];

/** A creature that would call here now, and not the one that called last when another could. */
export function creatureFor(
  sea: number,
  dread: number,
  last: CreatureId | null,
): CreatureId | null {
  const habitat = Math.random() < sea ? "sea" : "land";
  const around = ids.filter((id) => {
    const creature: Creature = CREATURES[id];
    return creature.habitat === habitat && dread >= creature.dread[0] && dread <= creature.dread[1];
  });
  const fresh = around.filter((id) => id !== last);
  const pool = fresh.length ? fresh : around;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}
