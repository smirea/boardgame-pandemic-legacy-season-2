import type { Character } from "@repo/game";
import { figureKey } from "./figures.ts";
import { HEADS } from "./figures.generated.ts";

export type CharacterLineKind =
  | "punchline"
  | "scar"
  | "upgrade"
  | "thanks"
  | "greet"
  | "leave"
  | "danger"
  | "companion"
  | "death";

export const CHARACTER_LINE_KINDS: readonly CharacterLineKind[] = [
  "punchline",
  "scar",
  "upgrade",
  "thanks",
  "greet",
  "leave",
  "danger",
  "companion",
  "death",
];

export const CHARACTER_LINE_LABELS: Record<CharacterLineKind, string> = {
  punchline: "Punchline",
  scar: "Scar",
  upgrade: "Upgrade",
  thanks: "Thanks",
  greet: "Greet",
  leave: "Leave",
  danger: "Danger",
  companion: "Companion",
  death: "Death",
};

export type FigureKey =
  | "survivor-0"
  | "survivor-1"
  | "survivor-2"
  | "survivor-3"
  | "survivor-4"
  | "survivor-5"
  | "survivor-6"
  | "survivor-7"
  | "survivor-8"
  | "survivor-9"
  | "survivor-10"
  | "survivor-11"
  | "survivor-12"
  | "survivor-13"
  | "survivor-14"
  | "survivor-15"
  | "immunologist"
  | "vector-control"
  | "scientist"
  | "haven-worker";

export type CharacterLine = {
  text: string;
  direction: string;
};

export type CharacterPersona = {
  id: FigureKey;
  archetype: string;
  voiceBrief: {
    displayName: string;
    label: string;
    gender: "male" | "female" | "neutral";
    languageCode: string;
    accent: string;
    tone: string;
    designPrompt: string;
    defaultDelivery: string;
    /** Applies a subtle cloth-mask filter in ffmpeg for figures whose face is wrapped in cloth. */
    muffled?: boolean;
  };
  lines: Record<CharacterLineKind, CharacterLine>;
};

export const CHARACTER_PERSONAS: Record<FigureKey, CharacterPersona> = {
  "survivor-0": {
    id: "survivor-0",
    archetype: "Masked Scout",
    voiceBrief: {
      displayName: "PLS2 · Masked Scout",
      label: "Guarded Muffled Coastal Irish Baritone",
      gender: "male",
      languageCode: "en-IE",
      accent: "Irish-Coastal",
      tone: "guarded lean coastal scout speaking quietly through a heavy cloth face wrap, taut weathered composure",
      designPrompt:
        "A lean, weathered coastal Irish man in his early 30s with a low, quiet, taut baritone voice speaking through a heavy wool face wrap. Guarded, observant, steady under pressure, dry coastal grit with zero wasted words.",
      defaultDelivery: "low, taut, guarded coastal grit spoken crisply through a cloth wrap",
      muffled: true,
    },
    lines: {
      punchline: {
        text: "Eyes open. Keep moving.",
        direction: "low taut guarded resolve, clipped and crisp",
      },
      scar: {
        text: "Ngh... clipped me. Still good.",
        direction: "tight muffled wince pushing steadily on",
      },
      upgrade: {
        text: "Handy. Could save my skin.",
        direction: "quiet dry understated approval",
      },
      thanks: {
        text: "Appreciated. Owe you.",
        direction: "brief hushed sincere gratitude",
      },
      greet: {
        text: "Good. Thought I was alone out here.",
        direction: "low guarded relief, subtle warmth",
      },
      leave: {
        text: "Heading ahead. Watch the fog.",
        direction: "quiet purposeful scout departure",
      },
      danger: {
        text: "Hold up! Movement right ahead!",
        direction: "sharp low urgent scout warning",
      },
      companion: {
        text: "Alright. Stick close and stay sharp.",
        direction: "dry quiet approval, steady guarded welcome",
      },
      death: {
        text: "Ghh... no... lost the trail... keep moving... don't look back...",
        direction:
          "muffled ragged gasp of pain weakening into a quiet urgent farewell as his breath fades",
      },
    },
  },
  "survivor-1": {
    id: "survivor-1",
    archetype: "Weathered Bosun",
    voiceBrief: {
      displayName: "PLS2 · Weathered Bosun",
      label: "Gravelly Steady Waterfront Baritone",
      gender: "male",
      languageCode: "en-US",
      accent: "American-East-Coast",
      tone: "heavy-voiced weathered harbor bosun, gravelly stoic baritone and rock-steady maritime grit",
      designPrompt:
        "A broad-shouldered, battle-worn East Coast harbor bosun in his late 30s with a deep, gravelly, salt-roughened baritone voice. Plainspoken, unsmiling, dependable, tough as coiled mooring rope.",
      defaultDelivery: "gruff, steady, gravelly maritime grit, clipped and rock-solid",
    },
    lines: {
      punchline: {
        text: "Rig it tight. Let's move.",
        direction: "gruff steady command, crisp working grit",
      },
      scar: {
        text: "Ngh! Just a scrape. Keep hauling.",
        direction: "hard grunt of pain shaking it off with stoic toughness",
      },
      upgrade: {
        text: "Solid gear. I'll put it to work.",
        direction: "gruff grounded nod of satisfaction",
      },
      thanks: {
        text: "Good look. Appreciate it.",
        direction: "terse warm waterfront gratitude",
      },
      greet: {
        text: "Glad you're still standing.",
        direction: "steady gruff relief, loyal warmth",
      },
      leave: {
        text: "Taking the next watch. Hold steady.",
        direction: "clipped dependable departure",
      },
      danger: {
        text: "Brace up! Bad trouble right on us!",
        direction: "sharp heavy protective warning, braced for impact",
      },
      companion: {
        text: "Good to have another pair of hands.",
        direction: "gruff appreciative nod, steady welcome",
      },
      death: {
        text: "Gah... hull's breached... get clear of me... save the crew...",
        direction: "heavy visceral cry of pain collapsing into stubborn breathless loyalty",
      },
    },
  },
  "survivor-2": {
    id: "survivor-2",
    archetype: "Daring Scavenger",
    voiceBrief: {
      displayName: "PLS2 · Daring Scavenger",
      label: "Lively Scottish Adventurer Alto",
      gender: "female",
      languageCode: "en-GB",
      accent: "Scottish",
      tone: "lively daring Scottish explorer, bright raspy voice and playful quick wit",
      designPrompt:
        "A lively, adventurous Scottish woman in her mid-20s with a bright, slightly raspy alto-mezzo voice. Quick nimble pacing, playful dry humor, fearless daring energy, and crisp expressive diction.",
      defaultDelivery: "cheeky, quick, fearless daring spark with nimble brisk rhythm",
    },
    lines: {
      punchline: {
        text: "Bet you I get there first!",
        direction: "playful cheeky grin, snappy mischievous burst",
      },
      scar: {
        text: "Ow! Brilliant, now we're even!",
        direction: "sharp yelp flipping into scrappy defiant laugh",
      },
      upgrade: {
        text: "Oh, this is going to be fun!",
        direction: "thrilled bright mischievous burst",
      },
      thanks: {
        text: "Cheers! You're a lifesaver.",
        direction: "fast bright genuine gratitude",
      },
      greet: {
        text: "Fancy meeting you on the wrong side of town!",
        direction: "cheeky upbeat tease",
      },
      leave: {
        text: "Catch me if you can!",
        direction: "quick darting playful farewell",
      },
      danger: {
        text: "Uh-oh! Okay, very bad vibe here!",
        direction: "wide-eyed startled alarm, quick adrenaline",
      },
      companion: {
        text: "Ooh, hello! Think you can keep up?",
        direction: "bright mischievous grin, cheeky playful tease",
      },
      death: {
        text: "Ngh... wait... I always land on my feet... don't leave me...",
        direction: "raw shocked gasp turning into a heartbreaking breathless cry fading out",
      },
    },
  },
  "survivor-3": {
    id: "survivor-3",
    archetype: "Guarded Drifter",
    voiceBrief: {
      displayName: "PLS2 · Guarded Drifter",
      label: "Low Dusty Mysterious Baritone",
      gender: "male",
      languageCode: "en-US",
      accent: "American-Southwestern",
      tone: "low smoke-dry guarded drifter, slow hushed intensity and watchful edge",
      designPrompt:
        "A tall, gaunt man in his early 40s with a low, smoke-dry, hushed baritone voice and a faint dusty Southwestern grit. Speaks sparingly, slow and guarded, watchful and brooding with quiet coiled strength.",
      defaultDelivery: "hushed, low, terse smoke-dry resolve, concise and clipped",
    },
    lines: {
      punchline: {
        text: "Point the way. I'll handle it.",
        direction: "quiet crisp deadpan resolve, no hesitation",
      },
      scar: {
        text: "Tch. Still breathing.",
        direction: "tight hissed wince through clenched teeth, clipped stoicism",
      },
      upgrade: {
        text: "Good. I needed an edge.",
        direction: "low quiet dark satisfaction",
      },
      thanks: {
        text: "I owe you one.",
        direction: "hushed sincere gratitude, understated weight",
      },
      greet: {
        text: "Didn't expect a friendly face here.",
        direction: "guarded low greeting with subtle relief",
      },
      leave: {
        text: "Watch your back out here.",
        direction: "quiet hushed parting",
      },
      danger: {
        text: "Quiet. Something's moving beside us.",
        direction: "chilling low hushed warning",
      },
      companion: {
        text: "Huh. Good company's hard to find.",
        direction: "low smoke-dry half-smile, understated sly warmth",
      },
      death: {
        text: "Ugh... long road... finally ends... keep moving...",
        direction: "hollow choked gasp collapsing into a quiet fading whisper",
      },
    },
  },
  "survivor-4": {
    id: "survivor-4",
    archetype: "Impatient Mechanic",
    voiceBrief: {
      displayName: "PLS2 · Impatient Mechanic",
      label: "Blunt Gravelly Working-Class Alto",
      gender: "female",
      languageCode: "en-US",
      accent: "American-Midwest",
      tone: "brassy blunt middle-aged mechanic, impatient practical grit and dry punch",
      designPrompt:
        "A stocky, practical Midwestern American woman in her late 40s with a brassy, gravelly, no-nonsense alto voice. Clipped brisk pacing, hands-on industrial grit, always sounding slightly impatient to get the job done.",
      defaultDelivery: "brisk, blunt, no-nonsense practical grit, snappy impatient rhythm",
    },
    lines: {
      punchline: {
        text: "Alright, stop talking and let's go!",
        direction: "brisk impatient snap, fired-up practical drive",
      },
      scar: {
        text: "Dammit! Tape it up, I'm fine!",
        direction: "sharp angry wince stubbornly powering through",
      },
      upgrade: {
        text: "Hah! Now that's actually useful!",
        direction: "gleeful brassy blunt approval",
      },
      thanks: {
        text: "Appreciate it. Saves me a headache.",
        direction: "crisp genuine working-class thanks",
      },
      greet: {
        text: "Good, someone who knows what they are doing!",
        direction: "brisk wry relief and warmth",
      },
      leave: {
        text: "I'll be over here fixing everyone's mess.",
        direction: "dry teasing wave walking off",
      },
      danger: {
        text: "Aw hell, this whole place is going sideways!",
        direction: "angry alarmed grit, braced and tense",
      },
      companion: {
        text: "Well hello! Finally, some decent company!",
        direction: "brisk brassy grin, blunt cheeky delight",
      },
      death: {
        text: "Agh... no, not today... somebody hold the line... please...",
        direction:
          "choked heavy gasp of shock, stubborn voice breaking into a desperate fading plea",
      },
    },
  },
  "survivor-5": {
    id: "survivor-5",
    archetype: "Sea Navigator",
    voiceBrief: {
      displayName: "PLS2 · Sea Navigator",
      label: "Confident Atlantic-Maritime Tenor-Baritone",
      gender: "male",
      languageCode: "en-GB",
      accent: "British-Maritime",
      tone: "weathered confident maritime navigator, warm poised tenor-baritone and bold chart-room clarity",
      designPrompt:
        "A weathered, handsome Atlantic coastal British man in his early 30s with a warm, resonant, confident tenor-baritone voice. Crisp maritime poise, subtle optimistic smirk, bold clear projection like a seasoned navigator charting open water.",
      defaultDelivery: "warm, crisp, confident maritime poise with subtle adventurous spark",
    },
    lines: {
      punchline: {
        text: "There's still a course through this.",
        direction: "confident warm conviction, crisp maritime ring",
      },
      scar: {
        text: "Ah! Rough water. Nothing we haven't weathered.",
        direction: "sharp intake of breath settling into steady maritime grit",
      },
      upgrade: {
        text: "Now that opens the horizon!",
        direction: "warm buoyant adventurous thrill",
      },
      thanks: {
        text: "Fair winds to you. Thank you.",
        direction: "warm gracious maritime gratitude",
      },
      greet: {
        text: "Good to see a steady compass out here!",
        direction: "warm confident delighted greeting",
      },
      leave: {
        text: "Setting course. Keep sight of the stars.",
        direction: "poised brisk gallant farewell",
      },
      danger: {
        text: "Hard to port! Something's closing in fast!",
        direction: "sharp urgent maritime alarm",
      },
      companion: {
        text: "Well now — always room for another hand on deck.",
        direction: "warm charming half-smile, breezy maritime welcome",
      },
      death: {
        text: "Ah... lost the bearings... keep sailing... find the shore for us...",
        direction: "dramatic gasping cry of anguish, earnest voice breaking into quiet stillness",
      },
    },
  },
  "survivor-6": {
    id: "survivor-6",
    archetype: "Gentle Field Medic",
    voiceBrief: {
      displayName: "PLS2 · Gentle Field Medic",
      label: "Warm Compassionate Soothing Mezzo",
      gender: "female",
      languageCode: "en-US",
      accent: "American-West-Coast",
      tone: "soft warm gentle field medic, tired eyes and tender steadfast kindness",
      designPrompt:
        "A gentle, warm East Asian-American woman in her mid-30s with a soft, deeply compassionate mezzo voice carrying quiet exhaustion and an unmistakable kind smile. Reassuring, tender, and steadily brave.",
      defaultDelivery: "gentle, warm, briskly reassuring kindness with quiet strength",
    },
    lines: {
      punchline: {
        text: "Deep breath, we'll get through this.",
        direction: "soft warm steady smile, concise calm",
      },
      scar: {
        text: "Ah! No, I'm okay, really!",
        direction: "soft pained wince quickly reassuring everyone else",
      },
      upgrade: {
        text: "Oh, thank goodness, that'll help.",
        direction: "soft relieved bright smile",
      },
      thanks: {
        text: "Oh, you're too kind, thank you.",
        direction: "warm heartfelt gentle relief",
      },
      greet: {
        text: "Hey! Have you been getting any rest?",
        direction: "warm caring gentle tease",
      },
      leave: {
        text: "Take care of yourself, okay?",
        direction: "tender caring farewell",
      },
      danger: {
        text: "Oh no! Stay close to me, please!",
        direction: "urgent trembling protective alarm",
      },
      companion: {
        text: "Oh, hello you! Come on, stick by me.",
        direction: "soft delighted smile, warm affectionate welcome",
      },
      death: {
        text: "Ah... don't cry... make sure they're safe... I'm so tired...",
        direction: "heartbreaking tearful gasp breaking into a tender fading selfless whisper",
      },
    },
  },
  "survivor-7": {
    id: "survivor-7",
    archetype: "Wise Stern Elder",
    voiceBrief: {
      displayName: "PLS2 · Wise Stern Elder",
      label: "Commanding Elderly Alto of Quiet Thunder",
      gender: "female",
      languageCode: "en-US",
      accent: "Indigenous-North-American",
      tone: "deep weathered elderly elder, stern solemn authority and ancient calm",
      designPrompt:
        "An elderly Indigenous North American woman in her 70s with a deep, weathered, resonant contralto voice that commands instant silence. Slow deliberate cadence, stern wisdom, steady immovable strength.",
      defaultDelivery: "firm, deep, crisp weathered authority, concise without dragging",
    },
    lines: {
      punchline: {
        text: "Stand firm. We do not bend.",
        direction: "deep commanding calm, crisp decisive rhythm",
      },
      scar: {
        text: "Hmph. I have survived worse.",
        direction: "low grim breath through pain, concise iron will",
      },
      upgrade: {
        text: "Good. Put it to honest use.",
        direction: "deep quiet approving pride",
      },
      thanks: {
        text: "You have a generous spirit.",
        direction: "warm dignified concise gratitude",
      },
      greet: {
        text: "It warms my heart to see you.",
        direction: "warm dignified elder greeting",
      },
      leave: {
        text: "Hold fast until I return.",
        direction: "firm dignified parting",
      },
      danger: {
        text: "Tread lightly. Death lingers here.",
        direction: "chilling crisp commanding warning",
      },
      companion: {
        text: "Well now. You look like good trouble.",
        direction: "deep weathered amusement, rare dry twinkle of approval",
      },
      death: {
        text: "Ahh... my time is spent... keep the flame alive... remember us...",
        direction: "devastating solemn gasp, proud weathered voice weakening gently into silence",
      },
    },
  },
  "survivor-8": {
    id: "survivor-8",
    archetype: "Masked Courier",
    voiceBrief: {
      displayName: "PLS2 · Masked Courier",
      label: "Fierce Muffled Runner Alto",
      gender: "female",
      languageCode: "en-US",
      accent: "American-Urban",
      tone: "fierce taut masked field runner speaking sharply through a stitched cloth mask, agile gritty intensity",
      designPrompt:
        "A fierce, agile American woman in her mid-20s with a sharp, husky, tightly focused alto voice speaking through a stitched cloth face mask. Hard-edged field courier grit, breathless urgency, fearless and direct.",
      defaultDelivery: "fierce, taut, crisp athletic edge spoken through a cloth mask",
      muffled: true,
    },
    lines: {
      punchline: {
        text: "Give me the route. I'll make it.",
        direction: "fierce focused punch, snappy field readiness",
      },
      scar: {
        text: "Ghh! Didn't stop me yet!",
        direction: "snarling muffled grunt flipping straight into furious grit",
      },
      upgrade: {
        text: "Good. Now I can move faster.",
        direction: "sharp taut satisfaction, keen edge",
      },
      thanks: {
        text: "Solid. Owe you one.",
        direction: "crisp terse grateful punch",
      },
      greet: {
        text: "You're still alive. Good — keep pace.",
        direction: "taut fierce camaraderie, no wasted breath",
      },
      leave: {
        text: "I'm on the move. Cover my trail.",
        direction: "brisk focused runner's exit",
      },
      danger: {
        text: "Move! Hostiles right on top of us!",
        direction: "sharp intense muffled alarm",
      },
      companion: {
        text: "Stay on my six. Don't slow me down.",
        direction: "fierce dry challenge, edgy respect",
      },
      death: {
        text: "Gah... dammit... pack's too heavy... take the run... don't stop...",
        direction: "raw muffled cry of pain collapsing into jagged breathless defiance",
      },
    },
  },
  "survivor-9": {
    id: "survivor-9",
    archetype: "Stoic Old Sailor",
    voiceBrief: {
      displayName: "PLS2 · Stoic Old Sailor",
      label: "Booming Salt-Crusted Sea Bass",
      gender: "male",
      languageCode: "en-GB",
      accent: "British-West-Country",
      tone: "heavy booming old sea dog, gruff weathered bass rumble and grim stoicism",
      designPrompt:
        "A heavy-set, salt-weathered old British West Country sailor in his late 60s with a booming, gravelly deep bass voice soaked in sea spray. Slow rumbling cadence, grim stoicism, and gruff loyalty.",
      defaultDelivery: "gruff rumbling gravelly bass, brisk clipped stoic grit without slow drawl",
    },
    lines: {
      punchline: {
        text: "Aye, lived through worse than this.",
        direction: "gruff rumbling resolve, crisp and punchy",
      },
      scar: {
        text: "Urgh! That's gonna ache when it rains.",
        direction: "heavy pained grunt landing on dry weathered humor",
      },
      upgrade: {
        text: "Hmph. Better late than never.",
        direction: "gruff wry pleased rumble",
      },
      thanks: {
        text: "Good on ya, mate.",
        direction: "warm gruff concise gratitude",
      },
      greet: {
        text: "Still breathing, eh? Good.",
        direction: "gruff dry fond humor",
      },
      leave: {
        text: "Keep your wits about ya.",
        direction: "steady brusque parting",
      },
      danger: {
        text: "Blast it, smells like the grave in here!",
        direction: "low growling alarm, rough dread",
      },
      companion: {
        text: "Hah! Welcome aboard, ya cheeky devil!",
        direction: "gruff booming chuckle, fond salty amusement",
      },
      death: {
        text: "Urrgh... cold water's rising... leave me, lads... save yourselves...",
        direction: "deep thunderous groan of mortal pain softening into a fading whisper",
      },
    },
  },
  "survivor-10": {
    id: "survivor-10",
    archetype: "Wry Tinkerer",
    voiceBrief: {
      displayName: "PLS2 · Wry Tinkerer",
      label: "Smooth Sardonic Mid-Baritone",
      gender: "male",
      languageCode: "en-US",
      accent: "American-Atlanta",
      tone: "smooth dry witty tinkerer, laid-back sardonic charm and clever half-smile",
      designPrompt:
        "A skinny Black American man in his early 30s with a smooth, warm, dryly humorous mid-baritone voice. Clever sardonic timing, relaxed inventive charm, half-smiling even when things spark.",
      defaultDelivery: "smooth, wry, crisp dry humor with snappy clever charm",
    },
    lines: {
      punchline: {
        text: "No plan? Even better.",
        direction: "dry wry half-smile, super snappy smooth wit",
      },
      scar: {
        text: "Tss! Definitely gonna feel that tomorrow.",
        direction: "sharp hiss of pain landing on deadpan humor",
      },
      upgrade: {
        text: "Ooh, now that's a bright idea.",
        direction: "smooth delighted appreciative chuckle",
      },
      thanks: {
        text: "My hero. Seriously.",
        direction: "warm wry concise appreciation",
      },
      greet: {
        text: "Hey! Tell me you brought good news.",
        direction: "playful relaxed charm, friendly grin",
      },
      leave: {
        text: "Alright, I'm out before it gets weird.",
        direction: "smooth breezy playful exit",
      },
      danger: {
        text: "Okay, zero jokes, we need to move!",
        direction: "startled urgent alarm, humor suddenly gone",
      },
      companion: {
        text: "Well hello. Where've you been hiding?",
        direction: "smooth wry half-smile, playful effortless flirtation",
      },
      death: {
        text: "Agh... tough break... hey... finish it for me, alright...?",
        direction: "shocked ragged cry of agony softening into fragile rueful warmth",
      },
    },
  },
  "survivor-11": {
    id: "survivor-11",
    archetype: "Alert Sea Courier",
    voiceBrief: {
      displayName: "PLS2 · Alert Sea Courier",
      label: "Taut Agile Young Coastal Tenor",
      gender: "male",
      languageCode: "en-US",
      accent: "American-New-England",
      tone: "alert lean young sea courier, taut watchful tenor with quick focused grit",
      designPrompt:
        "A lean, sharp-eyed young New England coastal American man in his early 20s with a clean, taut, agile tenor voice. Watchful, tense, quick on his feet, grounded and earnest rather than goofy — weathered beyond his years.",
      defaultDelivery: "taut, alert, quick agile urgency with sharp watchful focus",
    },
    lines: {
      punchline: {
        text: "Point me out there. I'll get through.",
        direction: "taut crisp readiness, quick steady focus",
      },
      scar: {
        text: "Ah! Stings — I can still run.",
        direction: "sharp wince gritting teeth and keeping pace",
      },
      upgrade: {
        text: "Nice. That's going to save time.",
        direction: "quick relieved sharp approval",
      },
      thanks: {
        text: "Thanks. Needed that.",
        direction: "brisk sincere grounded gratitude",
      },
      greet: {
        text: "Good, it's you. Coast clear behind you?",
        direction: "alert watchful relief, focused field check",
      },
      leave: {
        text: "Heading out before the fog thickens.",
        direction: "quick purposeful coastal departure",
      },
      danger: {
        text: "Watch it! Movement right beside us!",
        direction: "sharp tense high-alert warning",
      },
      companion: {
        text: "Good. Two sets of eyes beat one.",
        direction: "quick appreciative nod, steady welcome",
      },
      death: {
        text: "Ah... no... I wasn't fast enough... get the word back... tell them...",
        direction: "raw breathless cry crumbling into a heartbreaking urgent fading whisper",
      },
    },
  },
  "survivor-12": {
    id: "survivor-12",
    archetype: "Exacting Quartermaster",
    voiceBrief: {
      displayName: "PLS2 · Exacting Quartermaster",
      label: "Commanding Weathered British Alto",
      gender: "female",
      languageCode: "en-GB",
      accent: "British-Coastal",
      tone: "weathered exacting quartermaster, crisp authoritative British alto and razor composure",
      designPrompt:
        "A stern, weather-beaten British woman in her early 50s with a rich, crisp, commanding alto voice. Sharp maritime quartermaster authority, cool dry precision, zero patience for waste, every word measured like ink in a ledger.",
      defaultDelivery: "calm, crisp, stern commanding precision with razor poise",
    },
    lines: {
      punchline: {
        text: "Someone here needs a plan.",
        direction: "calm sharp wry poise, crisp concise delivery",
      },
      scar: {
        text: "Ah! Unfortunate. Still, we press on.",
        direction: "sharp clipped gasp snapped straight back into steel composure",
      },
      upgrade: {
        text: "Now that makes all the difference.",
        direction: "poised dry approval, crisp satisfaction",
      },
      thanks: {
        text: "Thoughtful. Thank you.",
        direction: "crisp warm gracious gratitude",
      },
      greet: {
        text: "Good, you're still in one piece.",
        direction: "dry fond relief, poised warmth",
      },
      leave: {
        text: "Keep the count straight while I'm gone.",
        direction: "poised dryly wry parting",
      },
      danger: {
        text: "Step back! This whole street is compromised!",
        direction: "sharp fierce urgent alarm",
      },
      companion: {
        text: "Good. Someone who looks dependable.",
        direction: "poised dry approval, understated authority",
      },
      death: {
        text: "Ahh... do not let this be for nothing... finish what we started...",
        direction:
          "strained agonized gasp fighting to hold dignity as her voice fractures and fades",
      },
    },
  },
  "survivor-13": {
    id: "survivor-13",
    archetype: "Shrewd Bargainer",
    voiceBrief: {
      displayName: "PLS2 · Shrewd Bargainer",
      label: "Silky Sly Continental Baritone",
      gender: "male",
      languageCode: "en-GB",
      accent: "French-Inflected-English",
      tone: "silky shrewd bargainer, raised-eyebrow charm and theatrical slick wit",
      designPrompt:
        "A sharp-featured European man in his mid-30s with a silky, playful, faintly French-inflected English tenor-baritone voice. Smooth theatrical swagger, sly raised-eyebrow charm, always sounding one step ahead of the deal.",
      defaultDelivery: "silky, sly, brisk playful charm, snappy wit with no slow drawl",
    },
    lines: {
      punchline: {
        text: "Never bet against me.",
        direction: "silky sly smirk, crisp snappy swagger",
      },
      scar: {
        text: "Ghh! Not the face, please!",
        direction: "hissing pained wince with vain theatrical wit",
      },
      upgrade: {
        text: "Ah! Now the odds look lovely.",
        direction: "delighted brisk sly purr",
      },
      thanks: {
        text: "Charming as ever, my friend.",
        direction: "smooth brisk appreciative warmth",
      },
      greet: {
        text: "Well, well, my favorite accomplice!",
        direction: "warm playful slick greeting",
      },
      leave: {
        text: "Don't spend all your luck at once!",
        direction: "breezy charming exit",
      },
      danger: {
        text: "Whoa! Time to fold and run!",
        direction: "rattled urgent alarm, smooth veneer cracked",
      },
      companion: {
        text: "Ooh, bonjour! Now aren't you a sight!",
        direction: "silky theatrical purr, shameless playful flirtation",
      },
      death: {
        text: "Gah... what a rotten hand... smile for me, darling...",
        direction: "choked dramatic gasp, theatrical bravado shattering into breathless tenderness",
      },
    },
  },
  "survivor-14": {
    id: "survivor-14",
    archetype: "Ironclad Rigger",
    voiceBrief: {
      displayName: "PLS2 · Ironclad Rigger",
      label: "Deep Stoic North-Sea Bass-Baritone",
      gender: "male",
      languageCode: "en-GB",
      accent: "Nordic-English",
      tone: "towering stoic bearded rigger, deep weathered bass rumble and immovable quiet grit",
      designPrompt:
        "A towering, scarred, heavily bearded North Sea maritime rigger in his early 40s with a deep, gravelly, rumbling bass-baritone voice and a subtle weathered Nordic-English cadence. Unsmiling, steady as iron, speaks sparingly with calm immovable strength.",
      defaultDelivery: "deep, gravelly, steady immovable bass with quiet stoic weight",
    },
    lines: {
      punchline: {
        text: "Heavy work is my job.",
        direction: "deep steady rumble, calm iron resolve",
      },
      scar: {
        text: "Hrgh. Takes more than that.",
        direction: "low guttural grunt brushing off pain with stone grit",
      },
      upgrade: {
        text: "Good. Stronger now.",
        direction: "deep quiet satisfied rumble",
      },
      thanks: {
        text: "You have my thanks.",
        direction: "low solemn heartfelt gratitude",
      },
      greet: {
        text: "Good to see you still standing.",
        direction: "deep steady warm respect",
      },
      leave: {
        text: "Hold your ground. I'll return.",
        direction: "low resolute departure",
      },
      danger: {
        text: "Stay behind me! Threat right here!",
        direction: "deep thunderous protective warning",
      },
      companion: {
        text: "Walk with me. I'll keep the weight off you.",
        direction: "low steady protective warmth",
      },
      death: {
        text: "Urrgh... chains are slipping... go on... I'll hold them here...",
        direction:
          "deep iron-willed groan of mortal pain softening into a quiet selfless fading rumble",
      },
    },
  },
  "survivor-15": {
    id: "survivor-15",
    archetype: "Serene Mystic",
    voiceBrief: {
      displayName: "PLS2 · Serene Mystic",
      label: "Ethereal Crystalline Androgynous Voice",
      gender: "neutral",
      languageCode: "en-US",
      accent: "Neutral-Transatlantic",
      tone: "soft enigmatic androgynous mystic, crystalline stillness and hypnotic calm",
      designPrompt:
        "A slender androgynous person in their mid-20s with a soft, crystalline, gender-neutral voice pitched gently between alto and tenor. Unhurried melodic cadence, hypnotic serenity, faintly uncanny calm.",
      defaultDelivery: "serene, crystalline, gently flowing calm, clear and concise",
    },
    lines: {
      punchline: {
        text: "We are right where we belong.",
        direction: "serene quiet certainty, concise luminous ring",
      },
      scar: {
        text: "Mmm... pain passes, memory stays.",
        direction: "soft pained exhale settling into haunting calm",
      },
      upgrade: {
        text: "Ah, I can feel it already.",
        direction: "hushed luminous wonder",
      },
      thanks: {
        text: "That was truly kind.",
        direction: "soft sincere melodic warmth",
      },
      greet: {
        text: "I had a feeling I'd find you here.",
        direction: "gentle enigmatic warm greeting",
      },
      leave: {
        text: "Until our paths cross again.",
        direction: "soft floating serene farewell",
      },
      danger: {
        text: "Hush... something hollow is watching us.",
        direction: "eerie hushed shivering dread",
      },
      companion: {
        text: "Oh, hello... you have a lovely aura.",
        direction: "soft enigmatic smile, playful luminous warmth",
      },
      death: {
        text: "Ahh... it's alright... the noise is fading... I see the light...",
        direction: "ethereal trembling gasp softening into a haunting peaceful fading sigh",
      },
    },
  },
  immunologist: {
    id: "immunologist",
    archetype: "OPAL Field Immunologist",
    voiceBrief: {
      displayName: "PLS2 · OPAL Immunologist",
      label: "Driven Argentine Field Baritone-Tenor",
      gender: "male",
      languageCode: "en-US",
      accent: "Argentine-English",
      tone: "intense 37-year-old Buenos Aires field immunologist, articulate clinical urgency and quiet steely resolve",
      designPrompt:
        "A driven, sharp-eyed 37-year-old Argentine male field immunologist from Buenos Aires with an articulate, resonant tenor-baritone voice and a refined subtle Rioplatense Spanish inflection. Focused, intense, hardened by years in a ruined mainland lab, fiercely committed to stopping the plague.",
      defaultDelivery: "intense, crisp, articulate clinical urgency with quiet steely fire",
    },
    lines: {
      punchline: {
        text: "Samples first. Then we end this.",
        direction: "sharp focused intensity, crisp steely resolve",
      },
      scar: {
        text: "Ngh! Nothing lethal — keep moving!",
        direction: "sharp pained grunt refusing to slow down",
      },
      upgrade: {
        text: "There it is. That's the breakthrough.",
        direction: "quiet fierce triumphant conviction",
      },
      thanks: {
        text: "Gracias. That bought us time.",
        direction: "brisk sincere focused gratitude",
      },
      greet: {
        text: "Good, you made it. Stay sharp.",
        direction: "intense steady field camaraderie",
      },
      leave: {
        text: "Don't contaminate the site till I'm back.",
        direction: "crisp dry clinical exit",
      },
      danger: {
        text: "Masks on! Live exposure right here!",
        direction: "sharp urgent clinical alarm",
      },
      companion: {
        text: "Good. I need someone steady in the field.",
        direction: "focused appreciative nod, crisp approval",
      },
      death: {
        text: "Ngh... too fast... take my notes... finish the work... please...",
        direction: "frantic agonized gasp, steady voice breaking into breathless tragic urgency",
      },
    },
  },
  "vector-control": {
    id: "vector-control",
    archetype: "Vector Control Specialist",
    voiceBrief: {
      displayName: "PLS2 · Vector Control",
      label: "Rugged No-Nonsense Australian Grit",
      gender: "male",
      languageCode: "en-AU",
      accent: "Australian",
      tone: "rangy red-haired Australian pest controller, dry blue-collar grit and steady nerve",
      designPrompt:
        "A rangy, no-nonsense Australian working man in his mid-30s with a rugged, dry, sun-baked tenor-baritone voice. Plainspoken blue-collar grit, dry understated toughness, completely unfazed by dirty work.",
      defaultDelivery: "dry, rugged, snappy plainspoken Australian grit",
    },
    lines: {
      punchline: {
        text: "Dirty job? Count me in.",
        direction: "dry gritty smirk, snappy Aussie toughness",
      },
      scar: {
        text: "Gah! Crikey, that bit deep!",
        direction: "raw sharp grunt of pain, rugged toughness",
      },
      upgrade: {
        text: "Beauty! That'll do nicely.",
        direction: "gruff pleased grin",
      },
      thanks: {
        text: "Cheers, mate, owe you a cold one.",
        direction: "rugged warm genuine gratitude",
      },
      greet: {
        text: "G'day! Fancy some rough company?",
        direction: "dry friendly grin",
      },
      leave: {
        text: "Right, off to clean up the next mess.",
        direction: "brisk matter-of-fact departure",
      },
      danger: {
        text: "Heads down! Whole block's crawling with 'em!",
        direction: "tense rugged startled alarm",
      },
      companion: {
        text: "Well hello, legend! Ready to get stuck in?",
        direction: "dry rugged grin, cheeky warm Australian banter",
      },
      death: {
        text: "Argh... rotten luck... keep moving, mate... don't look back...",
        direction: "raw gritty cry of agony fading into a stubborn breathless growl",
      },
    },
  },
  scientist: {
    id: "scientist",
    archetype: "JADE Field Scientist",
    voiceBrief: {
      displayName: "PLS2 · JADE Scientist",
      label: "Sharp South African Field Alto-Mezzo",
      gender: "female",
      languageCode: "en-GB",
      accent: "South-African-English",
      tone: "resourceful 35-year-old Johannesburg field scientist, sharp intense South African-English alto-mezzo and relentless clarity",
      designPrompt:
        "A sharp, resourceful 35-year-old South African woman field scientist from Johannesburg with a clear, intense, slightly husky alto-mezzo voice and a crisp educated South African-English accent. Keen, determined, unsentimental under fire, burning with scientific focus.",
      defaultDelivery: "sharp, crisp, focused scientific urgency with weathered field grit",
    },
    lines: {
      punchline: {
        text: "Let's test this before we lose daylight.",
        direction: "crisp sharp determination, focused field drive",
      },
      scar: {
        text: "Tch! Just a cut — don't drop the samples!",
        direction: "sharp hissed wince snapping straight back to the work",
      },
      upgrade: {
        text: "Brilliant. Now the numbers add up.",
        direction: "crisp delighted scientific satisfaction",
      },
      thanks: {
        text: "Much appreciated. Really.",
        direction: "warm concise genuine gratitude",
      },
      greet: {
        text: "Good, you're here — I need a second pair of eyes.",
        direction: "brisk focused field greeting",
      },
      leave: {
        text: "Checking the next sector. Stay sharp.",
        direction: "crisp purposeful departure",
      },
      danger: {
        text: "Back up! That's active right in front of us!",
        direction: "sharp urgent field alarm",
      },
      companion: {
        text: "Good to have you. Try to keep up with the pace.",
        direction: "dry sharp smile, brisk collegial respect",
      },
      death: {
        text: "Ah... no, not now... the data's in my bag... don't let it die with me...",
        direction: "raw shocked gasp fighting to stay clear as her voice fades into breathlessness",
      },
    },
  },
  "haven-worker": {
    id: "haven-worker",
    archetype: "Haven Worker",
    voiceBrief: {
      displayName: "PLS2 · Haven Worker",
      label: "Quiet Steady Muffled Duty Voice",
      gender: "neutral",
      languageCode: "en-US",
      accent: "American-Neutral",
      tone: "faceless steady dependable haven worker speaking softly through a wrapped cloth mask",
      designPrompt:
        "A quiet, steady, understated gender-neutral adult voice speaking calmly and humbly as if through a heavy wrapped cloth face covering. Soft, measured, dependable, zero ego, wholly devoted to carrying supplies.",
      defaultDelivery: "quiet, steady, crisp humble restraint as if spoken through wrapped cloth",
      muffled: true,
    },
    lines: {
      punchline: {
        text: "Ready. Point the way.",
        direction: "quiet steady crisp readiness",
      },
      scar: {
        text: "Ngh... it's nothing. I can keep going.",
        direction: "muffled pained grunt followed by quiet stubborn endurance",
      },
      upgrade: {
        text: "Good. I'll put it to work.",
        direction: "quiet humble resolve",
      },
      thanks: {
        text: "Thank you. Truly.",
        direction: "quiet sincere warmth",
      },
      greet: {
        text: "Glad you made it safely.",
        direction: "quiet warm steady greeting",
      },
      leave: {
        text: "On my way. Stay safe.",
        direction: "quiet purposeful departure",
      },
      danger: {
        text: "Careful... something's right here with us.",
        direction: "low tense muffled warning",
      },
      companion: {
        text: "Hello. Good to have you along.",
        direction: "quiet humble warmth, gentle understated welcome",
      },
      death: {
        text: "Ngh... leave me... keep going... someone else will step up...",
        direction: "muffled ragged gasp of selfless duty fading gently into silence",
      },
    },
  },
};

export const CHARACTER_PERSONA_LIST: readonly CharacterPersona[] =
  Object.values(CHARACTER_PERSONAS);

/** Resolves a playable character (including hooded Haven Workers) to its figure & voice key. */
export function characterFigureKey(
  character: Pick<Character, "portrait" | "job" | "worker">,
): FigureKey {
  return figureKey({
    portrait: character.portrait,
    job: character.job,
    hooded: character.worker,
  }) as FigureKey;
}

export const characterVoiceKey = (figure: FigureKey, kind: CharacterLineKind) =>
  `${figure}_${kind}`;

// Fail immediately at startup if a figure lacks a persona or any required voice line.
const missingFigures = Object.keys(HEADS).filter((key) => !(key in CHARACTER_PERSONAS));
if (missingFigures.length) {
  throw new Error(`Missing character voice persona for: ${missingFigures.join(", ")}`);
}
for (const persona of CHARACTER_PERSONA_LIST) {
  const missingLines = CHARACTER_LINE_KINDS.filter((kind) => !persona.lines[kind]?.text.trim());
  if (missingLines.length) {
    throw new Error(`Character persona ${persona.id} is missing lines: ${missingLines.join(", ")}`);
  }
}
