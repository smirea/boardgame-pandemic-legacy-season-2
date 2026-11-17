# Seat cards

`Corner.svelte` shows the name and carried supply cubes, followed by the names of the occupation, abilities, and scars, one per line; a scar carries a stitched-cut icon. A pointer or focus resting on the seat opens its character sheet beside it, on the side facing the board: each line in larger type with its kind and full text. Top seats hang it from their top edge and bottom seats raise it from their bottom edge, so it stays on screen. Its column rises above the objectives and the targeting line while it is open. The active border pulses unless the browser requests reduced motion.

`cardTargets` in the game package supplies card hover hints. City cards refer to explored locations. Produce Supplies refers to havens and supply centers on the grid. Events and companions use the engine's legal plays for the current phase. Player targets, including the active player and a card's owner, highlight seats. Medic refers to its owner's location. Cards without explicit targets highlight nothing. Card hints replace normal action hints until the pointer leaves the card.

`Game.svelte` shares card hover through Svelte context with corner hands and dock cards. The context takes one card or a list, and a list lights the union of its cards' targets. Card hover has its own state so seat hover can still identify a pawn.

A seat card's hand prints no names. `handGroups` (`hud/handGroups.ts`) stacks interchangeable cards into one pile, with the count large on its face when there is more than one: plain city cards by colour, since colour is what they pay for building and recon; the same event in the same mode; Produce Supplies with the same boxes left. A card with its own state or ability stands alone: a city card with an improvement (its mark, such as ×2 or a star) or search boxes (a magnifier), and every companion. Events, companions, Produce Supplies and epidemics carry line icons from `cards/icons.ts`. The tooltip names every card in the pile, and hovering it lights what all of them reach. A card joining or leaving a pile flies in or out as a sheet beneath its face, and the count pops.

`Portrait.svelte` maps `char-N` to portrait `(N - 1) % 10`. This keeps faces stable across saves and replays without adding stored state. Further characters reuse the ten portraits.

The ten original portraits in `apps/ui/static/portraits` were generated with Codex's built-in image generator and cropped to 144 × 224 WebP assets. The common prompt requested a muted post-apocalyptic survivor bust, desaturated ochre and teal gouache, weathered paper, a ruined coastal settlement, a clear expressive face, and no text, borders, or existing game art.

The subjects, in asset order, are:

1. An eccentric white goth woman with messy black hair and a burgundy scarf.
2. A commanding bearded Black man, 48, with salt-and-pepper hair and an olive field jacket. The prompt explicitly excludes celebrity resemblance.
3. A cheerful white man, 35, with a scruffy dog beside his face.
4. An elderly white woman with a silver braid, round spectacles, and medical gear.
5. A freckled redheaded white mechanic, 28, with goggles and overalls.
6. A gaunt bald white man, 60, with a bushy moustache and an eccentric scarf.
7. A young white man with unruly brown curls and a patched raincoat.
8. An East Asian woman, 45, with short hair and an expedition jacket.
9. A stern white woman, 50, with cropped blonde hair and a sailor coat.
10. A white man with a long auburn beard, a knitted cap, and botanical gear.
