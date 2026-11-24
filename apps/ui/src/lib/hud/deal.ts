import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";

/**
 * Settles a card into a hand where it lands. A card drawn from the Player deck is flown there by `CardFlights`,
 * which shows it to the table first, and its place in the hand stays hidden until that flight lands.
 */
export function deal(_node: Element, { delay = 0 }: { delay?: number } = {}): TransitionConfig {
  return {
    delay,
    duration: 320,
    easing: cubicOut,
    css: (t, u) => `opacity: ${t}; transform: translateY(${u * 0.6}rem) scale(${0.94 + 0.06 * t})`,
  };
}
