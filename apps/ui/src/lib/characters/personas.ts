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
    archetype: "Dockside Grandmother",
    voiceBrief: {
      displayName: "PLS2 · Dockside Grandmother",
      label: "Warm Sharp-Tongued Irish Dock Elder",
      gender: "female",
      languageCode: "en-IE",
      accent: "Irish-Coastal",
      tone: "warm gravelly older maritime grandmother, sharp chuckling wit and salt-air heart",
      designPrompt:
        "A wiry coastal Irish woman in her mid-60s with a weathered, gravelly warm alto voice full of salt air, quick dry humor, and a bright affectionate chuckle tucked behind every sentence. Sharp-tongued, lively, and utterly fearless.",
      defaultDelivery: "warm, brisk, gravelly wit with lively chuckle and sharp punch",
    },
    lines: {
      punchline: {
        text: "Still got more fight than the lot of you!",
        direction: "bright brisk chuckle bursting with playful sass",
      },
      scar: {
        text: "Ah! Gives me something to brag about.",
        direction: "sharp wince flipping immediately into a tough raspy laugh",
      },
      upgrade: {
        text: "See? Never count an old dog out.",
        direction: "delighted quick chuckle, sharp pride",
      },
      thanks: {
        text: "Aren't you a sweetheart!",
        direction: "warm affectionate gratitude",
      },
      greet: {
        text: "Well, look who's still standing!",
        direction: "cheerful teasing chuckle, fond greeting",
      },
      leave: {
        text: "Don't do anything daft till I'm back!",
        direction: "brisk motherly send-off already stepping away",
      },
      danger: {
        text: "Get back, love! Nothing good lives in that!",
        direction: "sharp startled warning, fierce protective dread",
      },
      companion: {
        text: "Well hello, gorgeous! You're coming with me.",
        direction: "cheeky delighted Irish chuckle, teasing playful flirtation",
      },
      death: {
        text: "Ahh... don't fuss over me, love... I had a grand run... go on...",
        direction:
          "dramatic ragged gasp of pain softening into brave tender farewell as her breath fades",
      },
    },
  },
  "survivor-1": {
    id: "survivor-1",
    archetype: "Unflappable Bruiser",
    voiceBrief: {
      displayName: "PLS2 · Unflappable Bruiser",
      label: "Cocky Waterfront Baritone",
      gender: "male",
      languageCode: "en-US",
      accent: "American-East-Coast",
      tone: "deep chesty young waterfront bruiser, cocky smirk and relaxed heavy swagger",
      designPrompt:
        "A broad-shouldered American man in his late 20s from the East Coast docks with a deep, chesty, gravelly baritone voice. Relaxed cocky smirk in his cadence, unflappable confidence, punchy streetwise swagger.",
      defaultDelivery: "cocky snappy swagger, deep chesty confidence, quick smirk",
    },
    lines: {
      punchline: {
        text: "Easy. I've got this.",
        direction: "cool cocky smirk, crisp relaxed swagger",
      },
      scar: {
        text: "Ngh! Alright, now I'm taking it personal.",
        direction: "hard grunt of pain recovering into tough grit",
      },
      upgrade: {
        text: "Oh, you're gonna love this.",
        direction: "smug excited grin, eager punch",
      },
      thanks: {
        text: "Hey, solid move.",
        direction: "cool appreciative nod, brief warmth",
      },
      greet: {
        text: "Look who finally caught up!",
        direction: "playful cocky tease, friendly grin",
      },
      leave: {
        text: "Try not to miss me.",
        direction: "breezy cocky farewell",
      },
      danger: {
        text: "Whoa! Everybody stay behind me!",
        direction: "sharp tense protective edge, braced for a fight",
      },
      companion: {
        text: "Hey there, trouble. Glad you're on my side.",
        direction: "smooth cocky smirk, playful charming swagger",
      },
      death: {
        text: "Gah... dammit... I ain't done yet... get outta here...",
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
    archetype: "Visionary Navigator",
    voiceBrief: {
      displayName: "PLS2 · Visionary Navigator",
      label: "Proud Articulated Indian-English Tenor",
      gender: "male",
      languageCode: "en-IN",
      accent: "Indian-English",
      tone: "proud clear young navigator, bright visionary conviction and poetic cadence",
      designPrompt:
        "A proud, bright young South Asian man in his late 20s with a clear, resonant, articulate Indian-English tenor voice. Warm ambitious energy, upright maritime poise, and poetic visionary certainty.",
      defaultDelivery: "proud, crisp, bright visionary energy, brisk articulate ring",
    },
    lines: {
      punchline: {
        text: "We're meant for more than surviving!",
        direction: "proud bright conviction, crisp inspiring ring",
      },
      scar: {
        text: "Ah! A small price for tomorrow.",
        direction: "sharp intake of breath turning into proud resolve",
      },
      upgrade: {
        text: "Now we're really getting somewhere!",
        direction: "bright buoyant visionary thrill",
      },
      thanks: {
        text: "You have my word, I'll repay this.",
        direction: "warm gracious heartfelt gratitude",
      },
      greet: {
        text: "Ah, just the ally I hoped to find!",
        direction: "bright delighted warm greeting",
      },
      leave: {
        text: "Onward! Don't lose hope!",
        direction: "gallant buoyant brisk farewell",
      },
      danger: {
        text: "Watch yourself! This darkness is too close!",
        direction: "urgent crisp alarm",
      },
      companion: {
        text: "Well hello! Now this journey just got interesting.",
        direction: "bright gallant charm, warm intrigued smile",
      },
      death: {
        text: "Ah... I can't see the shore anymore... keep going... for all of us...",
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
    archetype: "Defiant Fighter",
    voiceBrief: {
      displayName: "PLS2 · Defiant Fighter",
      label: "Fierce Athletic Young Alto",
      gender: "female",
      languageCode: "en-US",
      accent: "American-Urban",
      tone: "fierce athletic young martial artist, sharp punchy cadence and defiant energy",
      designPrompt:
        "A fierce, athletic American woman in her mid-20s with a sharp, punchy, husky alto voice full of intense competitive drive and fearless defiance. Direct, focused, energetic and strong.",
      defaultDelivery: "fierce, punchy, high-energy defiance with sharp athletic bite",
    },
    lines: {
      punchline: {
        text: "Point me at the problem!",
        direction: "fierce eager punch, snappy and fired up",
      },
      scar: {
        text: "Ghh! That all you've got?!",
        direction: "snarling sharp grunt flipping straight into furious defiance",
      },
      upgrade: {
        text: "Oh yeah! Now we're talking!",
        direction: "fierce triumphant grin, pumped adrenaline",
      },
      thanks: {
        text: "Nice! Owe you one!",
        direction: "crisp energetic grateful punch",
      },
      greet: {
        text: "Ready to stir up some trouble?",
        direction: "fierce upbeat grinning camaraderie",
      },
      leave: {
        text: "Save some of the action for me!",
        direction: "brisk cocky energetic exit",
      },
      danger: {
        text: "Heads up! We've got trouble right on top of us!",
        direction: "sharp intense alarm",
      },
      companion: {
        text: "Hey! Try not to slow me down, alright?",
        direction: "fierce cheeky smirk, playful competitive tease",
      },
      death: {
        text: "Gah... dammit... get up, legs... don't you dare quit...",
        direction: "raw furious cry of pain collapsing into jagged breathless defiance",
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
    archetype: "Nervous Quick Runner",
    voiceBrief: {
      displayName: "PLS2 · Nervous Quick Runner",
      label: "Fast Breathless Courier Tenor",
      gender: "male",
      languageCode: "en-US",
      accent: "American",
      tone: "fast-talking earnest courier, agile breathless tenor and quick lively pacing",
      designPrompt:
        "An energetic American man in his mid-20s with a light, agile, fast-talking tenor voice. Slightly breathless, eager-to-help earnestness, quick lively cadence like a nimble messenger always on the move.",
      defaultDelivery: "fast, slightly breathless, earnest jittery lively speed",
    },
    lines: {
      punchline: {
        text: "I'm ready! Where are we going?",
        direction: "fast eager breathless burst, super snappy",
      },
      scar: {
        text: "Ow! Okay, walk it off, walk it off!",
        direction: "sharp startled yelp scrambling to stay brave",
      },
      upgrade: {
        text: "Whoa, for me?! No way!",
        direction: "bright thrilled burst of excitement",
      },
      thanks: {
        text: "Oh! Thanks so much, got it!",
        direction: "fast grateful eager tumble",
      },
      greet: {
        text: "Oh thank goodness, it's you!",
        direction: "breathless relieved warm greeting",
      },
      leave: {
        text: "Gotta dash, catch you in a second!",
        direction: "fast energetic sprinting off",
      },
      danger: {
        text: "Whoa, whoa, bad news, right here!",
        direction: "panicked high-adrenaline warning",
      },
      companion: {
        text: "Oh, hey! Awesome, I love having backup!",
        direction: "fast bright thrilled burst, earnest upbeat charm",
      },
      death: {
        text: "Ah... no, wait... I wasn't fast enough... tell them I tried...",
        direction: "terrified raw breathless cry crumbling into a heartbreaking fading whisper",
      },
    },
  },
  "survivor-12": {
    id: "survivor-12",
    archetype: "Exacting Quartermaster",
    voiceBrief: {
      displayName: "PLS2 · Exacting Quartermaster",
      label: "Composed Crisp Levantine-English Alto",
      gender: "female",
      languageCode: "en-GB",
      accent: "Middle-Eastern-English",
      tone: "calm exacting quartermaster, poised crisp authority and razor precision",
      designPrompt:
        "A dignified Middle-Eastern woman in her mid-50s with a rich, composed, crisp alto voice and refined Levantine-accented English. Calm, exacting, unmistakably in charge, every word measured like ink in a ledger.",
      defaultDelivery: "calm, crisp, poised authority, brisk razor-sharp wit",
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
        text: "Try to keep things tidy while I'm gone.",
        direction: "poised dryly wry parting",
      },
      danger: {
        text: "Step back! This whole street is compromised!",
        direction: "sharp fierce urgent alarm",
      },
      companion: {
        text: "Ah, splendid. Someone with actual taste.",
        direction: "poised dry amusement, crisp sly approval",
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
    archetype: "Jovial Dockworker",
    voiceBrief: {
      displayName: "PLS2 · Jovial Dockworker",
      label: "Booming Warm Pacific Islander Bass",
      gender: "male",
      languageCode: "en-NZ",
      accent: "Pacific-Islander-NZ",
      tone: "huge warm jovial dockworker, booming belly-laugh heart and gentle giant power",
      designPrompt:
        "A huge, warm-hearted Pacific Islander man in his late 30s with a booming, resonant bass-baritone voice and soft New Zealand/Polynesian vowels. Radiates joyous belly-laugh warmth, brotherly kindness, and unstoppable strength.",
      defaultDelivery: "booming, warm, upbeat jovial heart, brisk infectious energy",
    },
    lines: {
      punchline: {
        text: "Haha! Ready when you are, friend!",
        direction: "big warm snappy laugh, joyful strength",
      },
      scar: {
        text: "Ooh! Hah, alright, felt that one!",
        direction: "deep pained grunt flipping into brave warm chuckle",
      },
      upgrade: {
        text: "Ohho! Look at me now!",
        direction: "booming joyous concise cheer",
      },
      thanks: {
        text: "Hey, big thanks!",
        direction: "booming warm heartfelt gratitude",
      },
      greet: {
        text: "Heeey! Good to see you smiling!",
        direction: "cheerful brotherly warm welcome",
      },
      leave: {
        text: "Stay tough, see you soon!",
        direction: "warm booming brisk send-off",
      },
      danger: {
        text: "Whoa, hold up — stay close, bad trouble here!",
        direction: "deep serious protective rumble of alarm",
      },
      companion: {
        text: "Ayyy! Look who just joined the party!",
        direction: "booming joyful laugh, warm playful welcome",
      },
      death: {
        text: "Uhh... hey, don't be sad... keep laughing for me, alright...?",
        direction:
          "heart-wrenching gentle giant gasp, booming warm voice breaking into a tender whisper",
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
    archetype: "Intense Immunologist",
    voiceBrief: {
      displayName: "PLS2 · Intense Immunologist",
      label: "Razor-Sharp Driven Latina Mezzo",
      gender: "female",
      languageCode: "en-US",
      accent: "Latina-American",
      tone: "brilliant intense immunologist, razor-sharp clinical fire and relentless urgency",
      designPrompt:
        "A brilliant, fiercely driven Latina woman in her early 40s with a sharp, intense, commanding mezzo voice and a crisp subtle Spanish inflection. Rapid decisive diction, electric clinical focus, burning passion to eradicate the plague.",
      defaultDelivery: "intense, razor-sharp, crisp decisive urgency",
    },
    lines: {
      punchline: {
        text: "Move aside, let's finish this!",
        direction: "fierce brilliant intensity, super sharp snap",
      },
      scar: {
        text: "Ay! Barely slowed me down!",
        direction: "sharp fierce wince refusing to stop",
      },
      upgrade: {
        text: "Yes! That's the breakthrough!",
        direction: "passionate triumphant burst",
      },
      thanks: {
        text: "Perfect, you're a lifesaver!",
        direction: "brisk warm grateful focus",
      },
      greet: {
        text: "Good, you're here — stay sharp!",
        direction: "sharp intense camaraderie",
      },
      leave: {
        text: "Don't touch anything till I'm back!",
        direction: "brisk wry intense exit",
      },
      danger: {
        text: "Masks up! Live threat right here!",
        direction: "sharp urgent clinical alarm",
      },
      companion: {
        text: "Hola! Finally, someone who can keep pace!",
        direction: "sharp delighted spark, brisk playful approval",
      },
      death: {
        text: "Ngh... too fast... please, don't let it win... finish what I started...",
        direction: "frantic agonized gasp, fierce voice breaking into breathless tragic urgency",
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
    archetype: "Absent-Minded Scientist",
    voiceBrief: {
      displayName: "PLS2 · Absent-Minded Scientist",
      label: "Endearing Older Scholar Baritone",
      gender: "male",
      languageCode: "en-US",
      accent: "East-Asian-American-Academic",
      tone: "warm endearing absent-minded older professor, animated eureka bursts and polite charm",
      designPrompt:
        "A heavyset, warm-hearted older East Asian-American scientist in his late 60s with a gentle, slightly reedy, animated professorial baritone voice. Endearingly distracted, politely formal, lighting up with sudden eureka wonder.",
      defaultDelivery: "warm, briskly animated, endearingly flustered older professor",
    },
    lines: {
      punchline: {
        text: "Aha! Wait, what was I saying?",
        direction: "bright brisk eureka exclamation flipping into flustered charm",
      },
      scar: {
        text: "Oh! Oh dear, that really smarts!",
        direction: "startled pained gasp trying to stay endearingly polite",
      },
      upgrade: {
        text: "Oh, marvelous! Simply splendid!",
        direction: "gleeful thrilled warm burst",
      },
      thanks: {
        text: "Oh, how terribly kind of you!",
        direction: "warm flustered heartfelt appreciation",
      },
      greet: {
        text: "Oh! Hello! Fancy seeing you here!",
        direction: "cheerful startled warm greeting",
      },
      leave: {
        text: "Excuse me, just had a brilliant thought!",
        direction: "hurried charming scatterbrained departure",
      },
      danger: {
        text: "Goodness me, we really must leave!",
        direction: "flustered urgent polite alarm",
      },
      companion: {
        text: "Oh! Why hello there — how delightful!",
        direction: "bright delighted surprise, warm charmingly flustered greeting",
      },
      death: {
        text: "Ah... oh dear... everything's going dim... please... look after each other...",
        direction: "heartbreakingly gentle bewildered gasp trembling and fading into soft silence",
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
