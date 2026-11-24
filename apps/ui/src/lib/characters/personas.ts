import type { Character } from '@repo/game';
import { figureKey } from './figures.ts';
import { HEADS } from './figures.generated.ts';

export type CharacterLineKind = 'punchline' | 'scar' | 'upgrade' | 'thanks' | 'greet' | 'leave' | 'danger' | 'death';

export const CHARACTER_LINE_KINDS: readonly CharacterLineKind[] = [
	'punchline',
	'scar',
	'upgrade',
	'thanks',
	'greet',
	'leave',
	'danger',
	'death',
];

export const CHARACTER_LINE_LABELS: Record<CharacterLineKind, string> = {
	punchline: 'Punchline',
	scar: 'Scar',
	upgrade: 'Upgrade',
	thanks: 'Thanks',
	greet: 'Greet',
	leave: 'Leave',
	danger: 'Danger',
	death: 'Death',
};

export type FigureKey =
	| 'survivor-0'
	| 'survivor-1'
	| 'survivor-2'
	| 'survivor-3'
	| 'survivor-4'
	| 'survivor-5'
	| 'survivor-6'
	| 'survivor-7'
	| 'survivor-8'
	| 'survivor-9'
	| 'survivor-10'
	| 'survivor-11'
	| 'survivor-12'
	| 'survivor-13'
	| 'survivor-14'
	| 'survivor-15'
	| 'immunologist'
	| 'vector-control'
	| 'scientist'
	| 'haven-worker';

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
		gender: 'male' | 'female' | 'neutral';
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
	'survivor-0': {
		id: 'survivor-0',
		archetype: 'Dockside Grandmother',
		voiceBrief: {
			displayName: 'PLS2 · Dockside Grandmother',
			label: 'Warm Sharp-Tongued Irish Dock Elder',
			gender: 'female',
			languageCode: 'en-IE',
			accent: 'Irish-Coastal',
			tone: 'warm gravelly older maritime grandmother, sharp chuckling wit and salt-air heart',
			designPrompt:
				'A wiry coastal Irish woman in her mid-60s with a weathered, gravelly warm alto voice full of salt air, quick dry humor, and a bright affectionate chuckle tucked behind every sentence. Sharp-tongued, lively, and utterly fearless.',
			defaultDelivery: 'warm, spirited, gravelly dockside wit with natural chuckle and lively punch',
		},
		lines: {
			punchline: {
				text: "Salt in my veins, love — let's haul!",
				direction: 'bright warm chuckle bursting into spirited dockside energy',
			},
			scar: {
				text: 'Hah! Barely scratched my good side!',
				direction: 'sharp wince of pain turning immediately into a tough raspy laugh',
			},
			upgrade: {
				text: 'Teach an old salt new tricks, eh?',
				direction: 'delighted warm chuckle, pleasantly surprised pride',
			},
			thanks: {
				text: 'Bless your heart, sweetheart!',
				direction: 'warm affectionate dockside gratitude',
			},
			greet: {
				text: 'Well look what the tide dragged in!',
				direction: 'cheerful teasing chuckle, bright fond greeting',
			},
			leave: {
				text: "Mind the nets — I'm off!",
				direction: 'brisk breezy farewell already stepping away',
			},
			danger: {
				text: 'Lord above — keep back from that filth!',
				direction: 'sharp startled warning, fierce protective dread',
			},
			death: {
				text: 'Ahh... tell the docks... the sea finally... caught me...',
				direction:
					'dramatic ragged gasp of agony fading into quiet breathless bravery, voice trembling and breaking as life slips away',
			},
		},
	},
	'survivor-1': {
		id: 'survivor-1',
		archetype: 'Unflappable Bruiser',
		voiceBrief: {
			displayName: 'PLS2 · Unflappable Bruiser',
			label: 'Cocky Waterfront Baritone',
			gender: 'male',
			languageCode: 'en-US',
			accent: 'American-East-Coast',
			tone: 'deep chesty young waterfront bruiser, cocky smirk and relaxed heavy swagger',
			designPrompt:
				'A broad-shouldered American man in his late 20s from the East Coast docks with a deep, chesty, gravelly baritone voice. Relaxed cocky smirk in his cadence, unflappable confidence, punchy streetwise swagger.',
			defaultDelivery: 'cocky relaxed swagger, deep chesty confidence, sharp smirk in the delivery',
		},
		lines: {
			punchline: {
				text: "Relax. Heavy lifting's here.",
				direction: 'relaxed cocky smirk, deep cool swagger',
			},
			scar: {
				text: "Ngh—! Yeah, that's gonna leave a trophy.",
				direction: 'hard grunt of sudden pain, recovering into tough boastful grit',
			},
			upgrade: {
				text: "Now we're talking. Watch this.",
				direction: 'pumped smug grin, eager confident punch',
			},
			thanks: {
				text: 'Appreciate it, boss.',
				direction: 'cool appreciative nod, smooth brief gratitude',
			},
			greet: {
				text: 'Hey! Saved you the easy part.',
				direction: 'cocky friendly grin, upbeat swagger',
			},
			leave: {
				text: 'Catch ya on the flip side.',
				direction: 'breezy cocky farewell',
			},
			danger: {
				text: 'Whoa—! Ugly company in here!',
				direction: 'sharp startled brawling tension, braced for a fight',
			},
			death: {
				text: 'Gah—! No... not like this... finish it... for me...',
				direction:
					'heavy visceral cry of pain collapsing into a ragged breathless plea, fierce bravado breaking at the very end',
			},
		},
	},
	'survivor-2': {
		id: 'survivor-2',
		archetype: 'Daring Scavenger',
		voiceBrief: {
			displayName: 'PLS2 · Daring Scavenger',
			label: 'Lively Scottish Adventurer Alto',
			gender: 'female',
			languageCode: 'en-GB',
			accent: 'Scottish',
			tone: 'lively daring Scottish explorer, bright raspy voice and playful quick wit',
			designPrompt:
				'A lively, adventurous Scottish woman in her mid-20s with a bright, slightly raspy alto-mezzo voice. Quick nimble pacing, playful dry humor, fearless daring energy, and crisp expressive diction.',
			defaultDelivery: 'cheeky, quick, fearless daring spark with playful crooked grin',
		},
		lines: {
			punchline: {
				text: 'Locked door? Cute. Hand me my crowbar.',
				direction: 'playful cheeky grin, snappy mischievous swagger',
			},
			scar: {
				text: 'Ow! Aw, brilliant — another souvenir!',
				direction: 'sharp yelp of pain flipping into scrappy sardonic laughter',
			},
			upgrade: {
				text: 'Oh, wicked! Try stopping me now!',
				direction: 'thrilled bright burst of youthful triumph',
			},
			thanks: {
				text: 'Cheers! Owe you one!',
				direction: 'fast bright casual gratitude',
			},
			greet: {
				text: 'Oi! Fancy bumping into you here!',
				direction: 'cheeky energetic surprise greeting',
			},
			leave: {
				text: "Right, I'm legging it — see ya!",
				direction: 'quick upbeat darting farewell',
			},
			danger: {
				text: 'Uh-oh — creeping shadows everywhere!',
				direction: 'wide-eyed startled alarm, breathless adrenaline',
			},
			death: {
				text: "Ngh—! Wait... I'm not done... don't leave me... here...",
				direction:
					'raw shocked gasp turning into a heartbreaking breathless young cry, voice faltering and fading into quiet',
			},
		},
	},
	'survivor-3': {
		id: 'survivor-3',
		archetype: 'Guarded Drifter',
		voiceBrief: {
			displayName: 'PLS2 · Guarded Drifter',
			label: 'Low Dusty Mysterious Baritone',
			gender: 'male',
			languageCode: 'en-US',
			accent: 'American-Southwestern',
			tone: 'low smoke-dry guarded drifter, slow hushed intensity and watchful edge',
			designPrompt:
				'A tall, gaunt man in his early 40s with a low, smoke-dry, hushed baritone voice and a faint dusty Southwestern grit. Speaks sparingly, slow and guarded, watchful and brooding with quiet coiled strength.',
			defaultDelivery: 'hushed, low, guarded intensity, terse and smoke-dry',
		},
		lines: {
			punchline: {
				text: "Say less. I'll handle it.",
				direction: 'quiet low deadpan resolve, unblinking calm',
			},
			scar: {
				text: 'Tch... pain just keeps you awake.',
				direction: 'tight hissed wince through clenched teeth, dark stoicism',
			},
			upgrade: {
				text: "A sharper edge... I'll use it well.",
				direction: 'low dark quiet satisfaction',
			},
			thanks: {
				text: "Won't forget this.",
				direction: 'hushed sincere gratitude, quiet weight',
			},
			greet: {
				text: "Didn't expect company.",
				direction: 'guarded low greeting with a faint hint of relief',
			},
			leave: {
				text: 'I travel lighter alone.',
				direction: 'quiet hushed departure slipping into shadow',
			},
			danger: {
				text: "Stay still... something's rotting in these streets.",
				direction: 'chilling low hushed warning thick with dread',
			},
			death: {
				text: 'Ugh... shadows... taking me home... go...',
				direction: 'hollow choked gasp collapsing into a ghostly fading whisper of quiet dark resignation',
			},
		},
	},
	'survivor-4': {
		id: 'survivor-4',
		archetype: 'Impatient Mechanic',
		voiceBrief: {
			displayName: 'PLS2 · Impatient Mechanic',
			label: 'Blunt Gravelly Working-Class Alto',
			gender: 'female',
			languageCode: 'en-US',
			accent: 'American-Midwest',
			tone: 'brassy blunt middle-aged mechanic, impatient practical grit and dry punch',
			designPrompt:
				'A stocky, practical Midwestern American woman in her late 40s with a brassy, gravelly, no-nonsense alto voice. Clipped brisk pacing, hands-on industrial grit, always sounding slightly impatient to get the job done.',
			defaultDelivery: 'brisk, blunt, no-nonsense practical grit, impatient punchy rhythm',
		},
		lines: {
			punchline: {
				text: "Less talk, more torque — let's move!",
				direction: 'brisk impatient snap, fired-up practical drive',
			},
			scar: {
				text: "Dammit! Wrap it tight, I've still got work!",
				direction: 'sharp furious wince of pain, stubbornly powering through',
			},
			upgrade: {
				text: "Hah! Now that's proper hardware!",
				direction: 'gleeful brassy approval, thrilled mechanic energy',
			},
			thanks: {
				text: 'Solid. Just what I needed.',
				direction: 'crisp genuine working-class thanks',
			},
			greet: {
				text: 'Good, another pair of hands!',
				direction: 'brisk welcoming relief, ready to work',
			},
			leave: {
				text: 'Got engines waiting — catch you later!',
				direction: 'brisk impatient wave walking off',
			},
			danger: {
				text: "Aw, hell — whole block's crawling with it!",
				direction: 'angry alarmed grit, braced and tense',
			},
			death: {
				text: "Agh—! No... wrench's slipping... keep the lights on... please...",
				direction: 'choked heavy gasp of shock and pain, stubborn voice breaking into a desperate fading whisper',
			},
		},
	},
	'survivor-5': {
		id: 'survivor-5',
		archetype: 'Visionary Navigator',
		voiceBrief: {
			displayName: 'PLS2 · Visionary Navigator',
			label: 'Proud Articulated Indian-English Tenor',
			gender: 'male',
			languageCode: 'en-IN',
			accent: 'Indian-English',
			tone: 'proud clear young navigator, bright visionary conviction and poetic cadence',
			designPrompt:
				'A proud, bright young South Asian man in his late 20s with a clear, resonant, articulate Indian-English tenor voice. Warm ambitious energy, upright maritime poise, and poetic visionary certainty.',
			defaultDelivery: 'proud, clear, bright visionary conviction with warm articulate ring',
		},
		lines: {
			punchline: {
				text: 'The horizon still belongs to us!',
				direction: 'proud inspiring maritime conviction, ringing clarity',
			},
			scar: {
				text: 'Ah—! Every true chart is drawn in blood.',
				direction: 'sharp painful intake of breath turning into proud defiant resolve',
			},
			upgrade: {
				text: 'Magnificent! New bearings, new horizons!',
				direction: 'bright soaring visionary triumph',
			},
			thanks: {
				text: 'My deepest thanks, friend.',
				direction: 'warm gracious heartfelt gratitude',
			},
			greet: {
				text: 'Our courses cross at last!',
				direction: 'bright delighted maritime greeting',
			},
			leave: {
				text: 'Fair winds until we meet again!',
				direction: 'gallant ringing maritime farewell',
			},
			danger: {
				text: 'Careful! Dark waters and dark things here!',
				direction: 'urgent crisp maritime alarm',
			},
			death: {
				text: "Ah—! The stars... they're going out... sail on... without me...",
				direction: 'dramatic gasping cry of anguish, poetic voice trembling and fading into breathless stillness',
			},
		},
	},
	'survivor-6': {
		id: 'survivor-6',
		archetype: 'Gentle Field Medic',
		voiceBrief: {
			displayName: 'PLS2 · Gentle Field Medic',
			label: 'Warm Compassionate Soothing Mezzo',
			gender: 'female',
			languageCode: 'en-US',
			accent: 'American-West-Coast',
			tone: 'soft warm gentle field medic, tired eyes and tender steadfast kindness',
			designPrompt:
				'A gentle, warm East Asian-American woman in her mid-30s with a soft, deeply compassionate mezzo voice carrying quiet exhaustion and an unmistakable kind smile. Reassuring, tender, and steadily brave.',
			defaultDelivery: 'gentle, warm, deeply compassionate and soothing with quiet strength',
		},
		lines: {
			punchline: {
				text: "Deep breath — I've got you.",
				direction: 'soft warm reassuring smile, steady tender calm',
			},
			scar: {
				text: "Ah—! I'm alright... just stitch it and keep going.",
				direction: 'soft pained wince bravely reassuring everyone else',
			},
			upgrade: {
				text: "Oh, good... this'll help me save more.",
				direction: 'soft relieved joy, gentle hopeful glow',
			},
			thanks: {
				text: 'Oh, thank you so much.',
				direction: 'warm heartfelt genuine relief',
			},
			greet: {
				text: 'Hey there — you holding up okay?',
				direction: 'warm caring gentle greeting',
			},
			leave: {
				text: "Stay safe, okay? I'm heading out.",
				direction: 'tender caring farewell',
			},
			danger: {
				text: "Oh no... it's right here with us...",
				direction: 'hushed trembling dread, urgent soft alarm',
			},
			death: {
				text: "Ah... no, don't look... please... save the others... I'm sorry...",
				direction: 'heartbreaking tearful gasp of agony, tender voice breaking into a fading selfless whisper',
			},
		},
	},
	'survivor-7': {
		id: 'survivor-7',
		archetype: 'Wise Stern Elder',
		voiceBrief: {
			displayName: 'PLS2 · Wise Stern Elder',
			label: 'Commanding Elderly Alto of Quiet Thunder',
			gender: 'female',
			languageCode: 'en-US',
			accent: 'Indigenous-North-American',
			tone: 'deep weathered elderly elder, stern solemn authority and ancient calm',
			designPrompt:
				'An elderly Indigenous North American woman in her 70s with a deep, weathered, resonant contralto voice that commands instant silence. Slow deliberate cadence, stern wisdom, steady immovable strength.',
			defaultDelivery: 'solemn, deep, deliberate stern authority with quiet weathered dignity',
		},
		lines: {
			punchline: {
				text: 'Stand tall. We endure.',
				direction: 'deep commanding calm, immovable quiet thunder',
			},
			scar: {
				text: 'Hmph. A mark earned, not feared.',
				direction: 'low grim breath through pain, stern stoic pride',
			},
			upgrade: {
				text: 'Strength returns to these old hands.',
				direction: 'deep quiet solemn satisfaction',
			},
			thanks: {
				text: 'You honor us with this.',
				direction: 'deep dignified heartfelt gratitude',
			},
			greet: {
				text: 'Walk steady, child. Good to see you.',
				direction: 'warm stern elder greeting with quiet affection',
			},
			leave: {
				text: 'The road calls. Hold this ground.',
				direction: 'dignified firm solemn parting',
			},
			danger: {
				text: 'The blight breathes here — tread with care!',
				direction: 'chilling grave commanding warning',
			},
			death: {
				text: 'Ahh... my breath fails... remember... who we are... carry the fire...',
				direction: 'devastating solemn gasp, ancient proud voice weakening and fading gently into silence',
			},
		},
	},
	'survivor-8': {
		id: 'survivor-8',
		archetype: 'Defiant Fighter',
		voiceBrief: {
			displayName: 'PLS2 · Defiant Fighter',
			label: 'Fierce Athletic Young Alto',
			gender: 'female',
			languageCode: 'en-US',
			accent: 'American-Urban',
			tone: 'fierce athletic young martial artist, sharp punchy cadence and defiant energy',
			designPrompt:
				'A fierce, athletic American woman in her mid-20s with a sharp, punchy, husky alto voice full of intense competitive drive and fearless defiance. Direct, focused, energetic and strong.',
			defaultDelivery: 'fierce, punchy, high-energy defiance with sharp athletic bite',
		},
		lines: {
			punchline: {
				text: 'Point me at the problem!',
				direction: 'fierce eager punch, fired up for a fight',
			},
			scar: {
				text: "Ghh—! That all you've got?!",
				direction: 'snarling sharp grunt of pain flipping straight into furious defiance',
			},
			upgrade: {
				text: 'Oh yeah! Bring it on!',
				direction: 'fierce triumphant grin, pumped adrenaline',
			},
			thanks: {
				text: 'Got it — owe you one!',
				direction: 'crisp energetic grateful punch',
			},
			greet: {
				text: 'Back to back, just like I like it!',
				direction: 'fierce upbeat warrior camaraderie',
			},
			leave: {
				text: "Rolling out — don't have all the fun!",
				direction: 'brisk cocky energetic exit',
			},
			danger: {
				text: "Eyes up! We've got hostiles on top of us!",
				direction: 'sharp intense combat alarm',
			},
			death: {
				text: "Gah—! Damn it... legs won't... hold... don't you dare... surrender...",
				direction: 'raw furious scream of pain collapsing into jagged breathless defiance until the voice gives out',
			},
		},
	},
	'survivor-9': {
		id: 'survivor-9',
		archetype: 'Stoic Old Sailor',
		voiceBrief: {
			displayName: 'PLS2 · Stoic Old Sailor',
			label: 'Booming Salt-Crusted Sea Bass',
			gender: 'male',
			languageCode: 'en-GB',
			accent: 'British-West-Country',
			tone: 'heavy booming old sea dog, gruff weathered bass rumble and grim stoicism',
			designPrompt:
				'A heavy-set, salt-weathered old British West Country sailor in his late 60s with a booming, gravelly deep bass voice soaked in sea spray. Slow rumbling cadence, grim stoicism, and gruff loyalty.',
			defaultDelivery: 'deep rumbling gravelly old sailor bass, grim stoic grit',
		},
		lines: {
			punchline: {
				text: 'Aye... weathered worse storms than this.',
				direction: 'deep rumbling stoic sea-dog resolve',
			},
			scar: {
				text: 'Urgh... just another notch in the hull.',
				direction: 'heavy deep pained grunt, grim weathered shrug',
			},
			upgrade: {
				text: "Hmph. Now that'll hold in a gale.",
				direction: 'gruff pleased deep rumble',
			},
			thanks: {
				text: 'Much obliged, mate.',
				direction: 'warm gruff sailor gratitude',
			},
			greet: {
				text: 'Ahoy there. Good to see a friendly lantern.',
				direction: 'gruff low warmth cutting through the dark',
			},
			leave: {
				text: 'Shoving off. Keep your head down.',
				direction: 'steady heavy maritime farewell',
			},
			danger: {
				text: 'Blast it — foul rot right at our boots!',
				direction: 'low growling alarm, rough sea-dog dread',
			},
			death: {
				text: "Urrgh... lantern's... going dark... drop anchor... for me, lads...",
				direction: 'deep thunderous groan of mortal pain fading into a soft salt-weathered final whisper',
			},
		},
	},
	'survivor-10': {
		id: 'survivor-10',
		archetype: 'Wry Tinkerer',
		voiceBrief: {
			displayName: 'PLS2 · Wry Tinkerer',
			label: 'Smooth Sardonic Mid-Baritone',
			gender: 'male',
			languageCode: 'en-US',
			accent: 'American-Atlanta',
			tone: 'smooth dry witty tinkerer, laid-back sardonic charm and clever half-smile',
			designPrompt:
				'A skinny Black American man in his early 30s with a smooth, warm, dryly humorous mid-baritone voice. Clever sardonic timing, relaxed inventive charm, half-smiling even when things spark.',
			defaultDelivery: 'smooth, wry, dryly humorous with relaxed clever charm',
		},
		lines: {
			punchline: {
				text: 'Give me two wires and a miracle.',
				direction: 'dry wry half-smile, smooth confident wit',
			},
			scar: {
				text: 'Tss—! Okay, yeah, that definitely voided the warranty.',
				direction: 'sharp hiss of pain landing on deadpan dark humor',
			},
			upgrade: {
				text: 'Ooh, look at that upgrade. Clean.',
				direction: 'smooth delighted appreciative chuckle',
			},
			thanks: {
				text: 'My hero. Seriously, thanks.',
				direction: 'warm wry genuine appreciation',
			},
			greet: {
				text: "Oh hey! Didn't break anything yet, promise.",
				direction: 'playful wry grin, friendly warmth',
			},
			leave: {
				text: 'Alright, bouncing before it blows.',
				direction: 'smooth breezy playful exit',
			},
			danger: {
				text: 'Uhh — yeah, we really should not be standing here!',
				direction: 'startled urgent alarm, humor suddenly gone',
			},
			death: {
				text: "Agh—! Short circuit... haha... tell 'em... I tried to patch it...",
				direction: 'shocked ragged cry of agony, fragile rueful half-laugh breaking into quiet final breath',
			},
		},
	},
	'survivor-11': {
		id: 'survivor-11',
		archetype: 'Nervous Quick Runner',
		voiceBrief: {
			displayName: 'PLS2 · Nervous Quick Runner',
			label: 'Fast Breathless Courier Tenor',
			gender: 'male',
			languageCode: 'en-US',
			accent: 'American',
			tone: 'fast-talking earnest courier, agile breathless tenor and quick lively pacing',
			designPrompt:
				'An energetic American man in his mid-20s with a light, agile, fast-talking tenor voice. Slightly breathless, eager-to-help earnestness, quick lively cadence like a nimble messenger always on the move.',
			defaultDelivery: 'fast, slightly breathless, earnest jittery lively speed',
		},
		lines: {
			punchline: {
				text: 'Already there! Wait — where are we going?',
				direction: 'fast eager breathless burst, charmingly jittery',
			},
			scar: {
				text: "Ah—ow! Ow, okay, I'm fine, I'm fine!",
				direction: 'sharp startled yelp scrambling to sound brave',
			},
			upgrade: {
				text: 'Whoa — for me?! Awesome!',
				direction: 'bright thrilled burst of youthful excitement',
			},
			thanks: {
				text: 'Oh! Thanks, thanks, I got it!',
				direction: 'fast grateful eager tumble of words',
			},
			greet: {
				text: "Oh thank goodness, it's you!",
				direction: 'breathless relieved warm greeting',
			},
			leave: {
				text: 'Gotta run — see you at the next corner!',
				direction: 'fast energetic sprinting off',
			},
			danger: {
				text: "Whoa, whoa, WHOA — they're right here!",
				direction: 'panicked high-adrenaline startled warning',
			},
			death: {
				text: "Ah—! No, please... I can't... outrun it... tell everyone... I made it...",
				direction: 'terrified raw breathless cry crumbling into a heartbreaking fading young whisper',
			},
		},
	},
	'survivor-12': {
		id: 'survivor-12',
		archetype: 'Exacting Quartermaster',
		voiceBrief: {
			displayName: 'PLS2 · Exacting Quartermaster',
			label: 'Composed Crisp Levantine-English Alto',
			gender: 'female',
			languageCode: 'en-GB',
			accent: 'Middle-Eastern-English',
			tone: 'calm exacting quartermaster, poised crisp authority and razor precision',
			designPrompt:
				'A dignified Middle-Eastern woman in her mid-50s with a rich, composed, crisp alto voice and refined Levantine-accented English. Calm, exacting, unmistakably in charge, every word measured like ink in a ledger.',
			defaultDelivery: 'calm, crisp, poised authority with exacting precision',
		},
		lines: {
			punchline: {
				text: 'Every crate accounted for. Begin.',
				direction: 'calm crisp command, razor-sharp poise',
			},
			scar: {
				text: 'Ah—! Note it in the margin. Carry on.',
				direction: 'sharp clipped gasp of pain snapped right back into steel composure',
			},
			upgrade: {
				text: 'An excellent investment. Duly recorded.',
				direction: 'poised dry approval, crisp satisfaction',
			},
			thanks: {
				text: 'Received. Thank you.',
				direction: 'crisp gracious formal gratitude',
			},
			greet: {
				text: 'Right on schedule. Good.',
				direction: 'composed approving greeting with quiet warmth',
			},
			leave: {
				text: 'My rounds continue. Keep the tally.',
				direction: 'measured dignified parting instruction',
			},
			danger: {
				text: 'Unacceptable — contamination right on our doorstep!',
				direction: 'sharp fierce urgent alarm',
			},
			death: {
				text: "Ahh... balance the books... for me... don't let... the count... fail...",
				direction: 'strained agonized gasp fighting to hold dignity as her voice fractures and fades out',
			},
		},
	},
	'survivor-13': {
		id: 'survivor-13',
		archetype: 'Shrewd Bargainer',
		voiceBrief: {
			displayName: 'PLS2 · Shrewd Bargainer',
			label: 'Silky Sly Continental Baritone',
			gender: 'male',
			languageCode: 'en-GB',
			accent: 'French-Inflected-English',
			tone: 'silky shrewd bargainer, raised-eyebrow charm and theatrical slick wit',
			designPrompt:
				'A sharp-featured European man in his mid-30s with a silky, playful, faintly French-inflected English tenor-baritone voice. Smooth theatrical swagger, sly raised-eyebrow charm, always sounding one step ahead of the deal.',
			defaultDelivery: 'silky, sly, theatrical charm with playful shrewd smirk',
		},
		lines: {
			punchline: {
				text: "Everything's negotiable — even survival.",
				direction: 'silky sly smirk, charming theatrical poise',
			},
			scar: {
				text: 'Ghh—! Steep price... even for me.',
				direction: 'hissing pained wince delivered with grim slick wit',
			},
			upgrade: {
				text: 'Ah! Now the odds tip my way.',
				direction: 'delighted sly purr of satisfaction',
			},
			thanks: {
				text: 'Pleasure doing business with you.',
				direction: 'smooth appreciative charm',
			},
			greet: {
				text: 'Ah, my favorite partner in crime!',
				direction: 'warm theatrical playful greeting',
			},
			leave: {
				text: 'Time is money, darling — ta-ta!',
				direction: 'breezy charming theatrical exit',
			},
			danger: {
				text: 'Whoa — bad neighborhood! Very bad neighborhood!',
				direction: 'rattled urgent alarm, smooth veneer cracked',
			},
			death: {
				text: 'Gah—! Looks like... my luck... finally ran... dry...',
				direction: 'choked dramatic gasp, theatrical bravado shattering into ragged breathless stillness',
			},
		},
	},
	'survivor-14': {
		id: 'survivor-14',
		archetype: 'Jovial Dockworker',
		voiceBrief: {
			displayName: 'PLS2 · Jovial Dockworker',
			label: 'Booming Warm Pacific Islander Bass',
			gender: 'male',
			languageCode: 'en-NZ',
			accent: 'Pacific-Islander-NZ',
			tone: 'huge warm jovial dockworker, booming belly-laugh heart and gentle giant power',
			designPrompt:
				'A huge, warm-hearted Pacific Islander man in his late 30s with a booming, resonant bass-baritone voice and soft New Zealand/Polynesian vowels. Radiates joyous belly-laugh warmth, brotherly kindness, and unstoppable strength.',
			defaultDelivery: 'booming, warm, jovial laugh-filled heart, gentle giant enthusiasm',
		},
		lines: {
			punchline: {
				text: 'Haha! Leave the heavy stuff to me, brother!',
				direction: 'big booming warm laugh, joyful protective strength',
			},
			scar: {
				text: 'Ooh—! Haha, alright, that one actually stung!',
				direction: 'deep pained grunt turning into brave warm laughter',
			},
			upgrade: {
				text: "Ohho! Look out world, I'm unstoppable now!",
				direction: 'booming joyous cheer, huge radiant energy',
			},
			thanks: {
				text: 'Hey, big thanks, friend!',
				direction: 'booming warm heartfelt gratitude',
			},
			greet: {
				text: 'Heeey! Good to see your smiling face!',
				direction: 'huge cheerful brotherly welcome',
			},
			leave: {
				text: 'Catch you down the line — stay strong!',
				direction: 'warm booming cheerful send-off',
			},
			danger: {
				text: 'Whoa, hold up — nasty trouble right here!',
				direction: 'deep serious protective rumble of alarm',
			},
			death: {
				text: "Uhh—! Haha... don't cry... keep laughing... for me, huh...?",
				direction: 'heart-wrenching gentle giant gasp, booming warm voice breaking tenderly into a fading whisper',
			},
		},
	},
	'survivor-15': {
		id: 'survivor-15',
		archetype: 'Serene Mystic',
		voiceBrief: {
			displayName: 'PLS2 · Serene Mystic',
			label: 'Ethereal Crystalline Androgynous Voice',
			gender: 'neutral',
			languageCode: 'en-US',
			accent: 'Neutral-Transatlantic',
			tone: 'soft enigmatic androgynous mystic, crystalline stillness and hypnotic calm',
			designPrompt:
				'A slender androgynous person in their mid-20s with a soft, crystalline, gender-neutral voice pitched gently between alto and tenor. Unhurried melodic cadence, hypnotic serenity, faintly uncanny calm.',
			defaultDelivery: 'serene, crystalline, unhurried hypnotic calm with quiet resonance',
		},
		lines: {
			punchline: {
				text: 'The thread already chose us.',
				direction: 'serene quiet certainty, softly uncanny',
			},
			scar: {
				text: 'Mmm... the body remembers what the mind forgets.',
				direction: 'soft pained exhale settling into haunting calm',
			},
			upgrade: {
				text: 'Ah... another door opens within.',
				direction: 'hushed luminous wonder',
			},
			thanks: {
				text: 'Your gift echoes kindly.',
				direction: 'soft serene melodic gratitude',
			},
			greet: {
				text: 'Our paths were meant to meet.',
				direction: 'gentle warm enigmatic greeting',
			},
			leave: {
				text: 'Walk lightly until the next turn.',
				direction: 'soft floating serene farewell',
			},
			danger: {
				text: 'Hush... feel the hollow cold closing in...',
				direction: 'eerie hushed shivering dread',
			},
			death: {
				text: 'Ahh... the veil lifts... do not weep... I hear the shore...',
				direction: 'ethereal trembling gasp softening into a haunting peaceful fading final sigh',
			},
		},
	},
	immunologist: {
		id: 'immunologist',
		archetype: 'Intense Immunologist',
		voiceBrief: {
			displayName: 'PLS2 · Intense Immunologist',
			label: 'Razor-Sharp Driven Latina Mezzo',
			gender: 'female',
			languageCode: 'en-US',
			accent: 'Latina-American',
			tone: 'brilliant intense immunologist, razor-sharp clinical fire and relentless urgency',
			designPrompt:
				'A brilliant, fiercely driven Latina woman in her early 40s with a sharp, intense, commanding mezzo voice and a crisp subtle Spanish inflection. Rapid decisive diction, electric clinical focus, burning passion to eradicate the plague.',
			defaultDelivery: 'intense, razor-sharp clinical fire, decisive passionate urgency',
		},
		lines: {
			punchline: {
				text: "Step back — let's kill this plague!",
				direction: 'fierce brilliant intensity, sharp decisive snap',
			},
			scar: {
				text: "Ay—! Compromised... doesn't matter, keep working!",
				direction: 'sharp fierce wince refusing to stop for even a second',
			},
			upgrade: {
				text: 'Yes! Now I can push the protocol further!',
				direction: 'passionate triumphant scientific thrill',
			},
			thanks: {
				text: 'Perfect — straight into the kit!',
				direction: 'brisk appreciative clinical focus',
			},
			greet: {
				text: "Good, you're here — hands clean?",
				direction: 'sharp intense greeting with a quick dry smirk',
			},
			leave: {
				text: 'Moving to the next hotspot — stay sterile!',
				direction: 'brisk urgent purposeful exit',
			},
			danger: {
				text: 'Active contagion right here — masks up!',
				direction: 'sharp urgent clinical alarm',
			},
			death: {
				text: 'Ngh—! Exposure... too fast... take my notes... finish the cure...',
				direction: 'frantic agonized gasp, fierce voice breaking into breathless tragic desperation',
			},
		},
	},
	'vector-control': {
		id: 'vector-control',
		archetype: 'Vector Control Specialist',
		voiceBrief: {
			displayName: 'PLS2 · Vector Control',
			label: 'Rugged No-Nonsense Australian Grit',
			gender: 'male',
			languageCode: 'en-AU',
			accent: 'Australian',
			tone: 'rangy red-haired Australian pest controller, dry blue-collar grit and steady nerve',
			designPrompt:
				'A rangy, no-nonsense Australian working man in his mid-30s with a rugged, dry, sun-baked tenor-baritone voice. Plainspoken blue-collar grit, dry understated toughness, completely unfazed by dirty work.',
			defaultDelivery: 'dry, rugged, plainspoken Australian blue-collar determination',
		},
		lines: {
			punchline: {
				text: "Tank's full. Point me at the mess.",
				direction: 'dry gritty determination, ready for dirty work',
			},
			scar: {
				text: 'Gah—! Bloody hell, that bit deep!',
				direction: 'raw sharp grunt of pain, rugged toughness',
			},
			upgrade: {
				text: "Beauty! That'll clear 'em out quick.",
				direction: 'gruff pleased grin, eager satisfaction',
			},
			thanks: {
				text: 'Cheers, mate — lifesaver.',
				direction: 'rugged genuine blue-collar gratitude',
			},
			greet: {
				text: "G'day — hope you brought boots.",
				direction: 'dry friendly working-man greeting',
			},
			leave: {
				text: 'Right, off to hose down the next street.',
				direction: 'brisk matter-of-fact departure',
			},
			danger: {
				text: "Crikey — whole place is swarming with 'em!",
				direction: 'tense rugged startled alarm',
			},
			death: {
				text: 'Argh—! Rotten thing... got me... burn the rest... for me...',
				direction: 'raw gritty cry of agony fading into a stubborn breathless growl',
			},
		},
	},
	scientist: {
		id: 'scientist',
		archetype: 'Absent-Minded Scientist',
		voiceBrief: {
			displayName: 'PLS2 · Absent-Minded Scientist',
			label: 'Endearing Older Scholar Baritone',
			gender: 'male',
			languageCode: 'en-US',
			accent: 'East-Asian-American-Academic',
			tone: 'warm endearing absent-minded older professor, animated eureka bursts and polite charm',
			designPrompt:
				'A heavyset, warm-hearted older East Asian-American scientist in his late 60s with a gentle, slightly reedy, animated professorial baritone voice. Endearingly distracted, politely formal, lighting up with sudden eureka wonder.',
			defaultDelivery: 'warm, animated, endearingly distracted older professor with bright eureka charm',
		},
		lines: {
			punchline: {
				text: 'Aha! Wait — where did I put my chalk?',
				direction: 'bright eureka exclamation immediately turning endearingly flustered',
			},
			scar: {
				text: "Oh! Oh dear, that's... quite a setback...",
				direction: 'startled pained gasp trying to remain bravely polite',
			},
			upgrade: {
				text: 'Oh, marvelous! That changes every equation!',
				direction: 'gleeful thrilled scholarly burst',
			},
			thanks: {
				text: 'Ah, splendid! Most kind of you!',
				direction: 'warm flustered heartfelt appreciation',
			},
			greet: {
				text: 'Oh! Hello there! Just solving a tiny puzzle!',
				direction: 'cheerful startled warm greeting',
			},
			leave: {
				text: 'Excuse me — I just had a thought! Back soon!',
				direction: 'hurried charming scatterbrained departure',
			},
			danger: {
				text: 'Goodness me! That is not supposed to be here!',
				direction: 'flustered urgent scholarly alarm',
			},
			death: {
				text: "Ah... oh dear... the numbers... they're blurring... please... remember the formula...",
				direction: 'heartbreakingly gentle bewildered gasp, kind older voice trembling and fading into quiet',
			},
		},
	},
	'haven-worker': {
		id: 'haven-worker',
		archetype: 'Haven Worker',
		voiceBrief: {
			displayName: 'PLS2 · Haven Worker',
			label: 'Quiet Steady Muffled Duty Voice',
			gender: 'neutral',
			languageCode: 'en-US',
			accent: 'American-Neutral',
			tone: 'faceless steady dependable haven worker speaking softly through a wrapped cloth mask',
			designPrompt:
				'A quiet, steady, understated gender-neutral adult voice speaking calmly and humbly as if through a heavy wrapped cloth face covering. Soft, measured, dependable, zero ego, wholly devoted to carrying supplies.',
			defaultDelivery: 'quiet, steady, humble, understated as if spoken through wrapped cloth',
			muffled: true,
		},
		lines: {
			punchline: {
				text: "Crate's ready. Point the way.",
				direction: 'quiet steady dependable readiness',
			},
			scar: {
				text: 'Ngh... still standing. Still carrying.',
				direction: 'muffled pained grunt followed by quiet stubborn endurance',
			},
			upgrade: {
				text: 'Understood. More work I can do.',
				direction: 'quiet humble resolve',
			},
			thanks: {
				text: "Thank you. It'll reach the city.",
				direction: 'quiet sincere duty-bound gratitude',
			},
			greet: {
				text: 'Safe travels. Need a hand?',
				direction: 'quiet warm steady greeting',
			},
			leave: {
				text: 'On my way. More crates waiting.',
				direction: 'quiet purposeful departure',
			},
			danger: {
				text: 'Watch your step... danger right ahead.',
				direction: 'low tense muffled warning',
			},
			death: {
				text: 'Ngh... drop the crate... run... someone else... will carry it...',
				direction: 'muffled ragged gasp of selfless duty, quiet voice breaking and fading into silence',
			},
		},
	},
};

export const CHARACTER_PERSONA_LIST: readonly CharacterPersona[] = Object.values(CHARACTER_PERSONAS);

/** Resolves a playable character (including hooded Haven Workers) to its figure & voice key. */
export function characterFigureKey(character: Pick<Character, 'portrait' | 'job' | 'worker'>): FigureKey {
	return figureKey({ portrait: character.portrait, job: character.job, hooded: character.worker }) as FigureKey;
}

export const characterVoiceKey = (figure: FigureKey, kind: CharacterLineKind) => `${figure}_${kind}`;

// Fail immediately at startup if a figure lacks a persona or any required voice line.
const missingFigures = Object.keys(HEADS).filter(key => !(key in CHARACTER_PERSONAS));
if (missingFigures.length) {
	throw new Error(`Missing character voice persona for: ${missingFigures.join(', ')}`);
}
for (const persona of CHARACTER_PERSONA_LIST) {
	const missingLines = CHARACTER_LINE_KINDS.filter(kind => !persona.lines[kind]?.text.trim());
	if (missingLines.length) {
		throw new Error(`Character persona ${persona.id} is missing lines: ${missingLines.join(', ')}`);
	}
}
