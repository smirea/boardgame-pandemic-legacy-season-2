/**
 * Short scene-setting lines for playtest bot logs, keyed by the start of a briefing card's title.
 */
const FLAVOR: [prefix: string, line: string][] = [
  [
    "January",
    "Year 71 begins on the havens with the leaders gone and the supply projections failing. Time to look past the edge of the grid.",
  ],
  [
    "Supplies arrive",
    "Extra Rationed Event stores are logged into the reserve for the months ahead.",
  ],
  [
    "February",
    "With the security detail missing, the Hollow Men are pressing harder against coastal supply centers.",
  ],
  [
    "Putting down roots",
    "Supply centers can now be built to last from month to month instead of collapsing between runs.",
  ],
  [
    "March",
    "Archive records show the four cure labs were never meant to last past fifty years—and PEARL went silent on the brink of a breakthrough.",
  ],
  [
    "Stretched too thin",
    "Five more Epidemics enter the box as the plague accelerates across the grid.",
  ],
  [
    "April",
    "A torn coordinate slip names the Southern Hemisphere labs: JADE, OPAL, TOPAZ, and half a line for PEARL.",
  ],
  [
    "Rebuilding",
    "Cities with standing supply centers begin to climb back on the population track.",
  ],
  [
    "May",
    "Archive notes from last November reveal the truth: haven leadership compiled a list and abandoned everyone else to march toward Utopia.",
  ],
  [
    "Experience",
    "Crews who survive the mainland bring back hard-won techniques for the roster.",
  ],
  [
    "June",
    "Archive records from Year 14 explain the Hollow Men—an organized militia attacking supply routes since the earliest years after the Fall.",
  ],
  [
    "New arrivals",
    "Volunteers from the havens—a Sanitation Officer and a veteran Captain—step forward to join the roster.",
  ],
  [
    "July",
    "Satellite towers pick up faint transmissions across multiple bands; someone out there may be coordinating the Hollow Men.",
  ],
  [
    "Listening",
    "Crews align satellite towers across three regions to triangulate the unknown broadcasts.",
  ],
  [
    "August",
    "The satellite network comes fully online with the Frequency Scanner, and Year 48 archives confirm PEARL once isolated a bacteriophage.",
  ],
  [
    "Hard lessons",
    "Additional abilities and scars join the pool as the year's toll deepens.",
  ],
  [
    "September",
    "The experimental inoculation stored in Package 6 begins wearing off—Epidemics now pull quarantined cities back into play.",
  ],
  [
    "Closing in",
    "The remaining blank space on the chart narrows toward East Asia and the walls of Utopia.",
  ],
  [
    "October",
    "Using the satellite towers to broadcast misinformation can lure Hollow Men onto the havens where they may be turned.",
  ],
  [
    "A gap in the wall",
    "New shelter and resistance tactics open up as the grid pushes toward Asia.",
  ],
  [
    "November",
    "Utopia releases a fresh wave of Hollow Men each November—for two days their perimeter is distracted, and The Plan is set in motion at Shanghai.",
  ],
  [
    "Almost there",
    "Every card and supply run converges on the four steps of The Plan.",
  ],
  [
    "December",
    "One final month left: reach Lake Baikal, take the PEARL sample, and carry it to JADE in Johannesburg before the havens run dry.",
  ],
  [
    "The final reckoning",
    "Twelve months recorded on the chart; the Final Reckoning tallies what survived and whether the sample reached JADE.",
  ],
  [
    "North America revealed",
    "Recon reaches North America—where COdA collapsed and the plague first broke loose.",
  ],
  [
    "South America revealed",
    "Recon opens South America in search of the rumored Southern Hemisphere laboratories.",
  ],
  [
    "Europe revealed",
    "Recon reaches Europe and uncovers old military runways capable of linking havens and supply centers by air.",
  ],
  [
    "Africa revealed",
    "Recon charts Africa—infested cities alongside intact satellite towers capable of relaying signals across the grid.",
  ],
  [
    "Middle East and South Asia revealed",
    "Recon pushes into the Middle East and South Asia, where Hollow Men gather and faint transmissions linger over the towers.",
  ],
  [
    "East Asia revealed",
    "Recon uncovers East Asia: survivors huddled in shelters outside the walled enclave of Utopia.",
  ],
  [
    "Coral Sea haven found",
    "A lost haven in the Coral Sea appears on the chart, still linked to the old southern approaches.",
  ],
  [
    "Wellington and the Topaz lab found",
    "TOPAZ lab in Wellington has survived untouched by the plague for nearly fifty years and confirms PEARL's location at Lake Baikal.",
  ],
  [
    "Eastern Pacific haven sighted",
    "Bearings locate a silent Pacific haven off the American coast, waiting to be reached by sea.",
  ],
  [
    "Eastern Pacific haven reached",
    "Inside the empty Eastern Pacific haven sit portable supply labs, experimental inoculation, and fifteen Supply cubes.",
  ],
  [
    "Indian Ocean haven sighted",
    "Bearings locate the silent Indian Ocean haven, waiting for a sea lane to reach it.",
  ],
  [
    "Indian Ocean haven reached",
    "A locked storage room inside the Indian Ocean haven yields fifteen more Supply cubes for every remaining month.",
  ],
  [
    "Opal lab found",
    "OPAL lab in Buenos Aires still stands; its Immunologist joins the roster and points toward Lake Baikal.",
  ],
  [
    "Jade lab found",
    "JADE lab in Johannesburg still has working mass-production gear; its Scientist joins to help manufacture the cure.",
  ],
  [
    "Pearl lab reached",
    "PEARL lab at Lake Baikal holds four doses of the cure sample—carrying one past Utopia's patrols requires injecting it directly.",
  ],
  [
    "Forsaken cities",
    "A city drops to population zero and goes forsaken—infested and cut off from every action except Drive/Ferry until restored.",
  ],
  [
    "Signals triangulated",
    "Three towers lock onto the Hollow Men's primary bands: 9.2, 9.31, and 11.88.",
  ],
  [
    "The Hollow Men defect",
    "Defectors brought onto the havens exchange secrets with the Faded, opening the path to plan a breach into Utopia.",
  ],
  [
    "Utopia opened",
    "Inside Utopia's walls, the truth is laid bare: Utopia kept PEARL under guard for thirty years, waiting for the Faded to die out.",
  ],
];

export function flavorFor(title: string): string | null {
  return FLAVOR.find(([prefix]) => title.startsWith(prefix))?.[1] ?? null;
}
