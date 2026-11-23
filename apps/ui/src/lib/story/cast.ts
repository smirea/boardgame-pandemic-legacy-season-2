export type SpeakerId = 'chronicler' | 'mara' | 'tomas' | 'kai' | 'archive' | 'amaya' | 'vey';

export type SpeakerDef = {
	id: SpeakerId;
	name: string;
	title: string;
	side: 'left' | 'right' | 'center';
	image: string | null;
	accent: string;
	defaultStyle: 'narrator' | 'speech' | 'thought' | 'radio';
	/** Expressive Google Gemini 3.8 TTS Voice Design + acting direction brief used by scripts/gen-voices.ts. */
	voiceBrief: {
		displayName: string;
		label: string;
		gender: 'male' | 'female';
		languageCode: string;
		accent: string;
		age: 'young' | 'middle' | 'older';
		tone: string;
		/** Prompt passed to Gemini 3.8 Voice Design (`ai.voices.create`) to synthesize a bespoke voice persona. */
		designPrompt: string;
		/** Baseline `speechMetadata.style` passed to `gemini-3.8-flash-tts` for expressive, emphatic delivery. */
		defaultDelivery: string;
	};
};

export const CAST: Record<SpeakerId, SpeakerDef> = {
	chronicler: {
		id: 'chronicler',
		name: 'The Chronicler',
		title: 'Voice of the Havens',
		side: 'center',
		image: null,
		accent: '#e2c36a',
		defaultStyle: 'narrator',
		voiceBrief: {
			displayName: 'PLS2 · The Chronicler',
			label: 'Deep Gravelly Maritime Narrator',
			gender: 'male',
			languageCode: 'en-US',
			accent: 'Transatlantic',
			age: 'older',
			tone: 'thunderous gravelly bass-baritone narrator, dramatic pauses, sweeping maritime gravitas',
			designPrompt:
				'A deep, thunderous, gravelly older male cinematic documentary narrator in his late 50s with dark velvety bass resonance, sea-weathered transatlantic gravitas, bold theatrical projection, and deliberate dramatic cadence — haunting, emphatic, never monotone.',
			defaultDelivery:
				'sweeping theatrical narration, deeply resonant, dramatic pauses before heavy words, strong emphatic inflection',
		},
	},
	mara: {
		id: 'mara',
		name: 'Captain Mara Vance',
		title: 'Haven Operations Lead · Faded',
		side: 'left',
		image: '/cast/mara.webp',
		accent: '#e0a943',
		defaultStyle: 'speech',
		voiceBrief: {
			displayName: 'PLS2 · Captain Mara Vance',
			label: 'Fierce Weathered Alto Commander',
			gender: 'female',
			languageCode: 'en-US',
			accent: 'American',
			age: 'middle',
			tone: 'fierce husky low alto, hardened sea-captain grit, gripping emotional punch',
			designPrompt:
				'A fierce, weathered American woman in her early 40s with a husky, low-pitched commanding alto voice hardened by decades at sea. Strong vocal projection, decisive clipped cadence, raw emotional grit and fiercely protective leadership.',
			defaultDelivery:
				'fierce, commanding, weathered grit, sharp emphatic stress on decisive words, intensely human urgency',
		},
	},
	tomas: {
		id: 'tomas',
		name: 'Dr. Tomas Renn',
		title: 'Haven Archivist & Medic · Faded',
		side: 'right',
		image: '/cast/tomas.webp',
		accent: '#8cb8d4',
		defaultStyle: 'speech',
		voiceBrief: {
			displayName: 'PLS2 · Dr. Tomas Renn',
			label: 'Warm Haunted British Physician',
			gender: 'male',
			languageCode: 'en-GB',
			accent: 'British',
			age: 'older',
			tone: 'warm articulate older British scholar/physician, haunted tender empathy and medical urgency',
			designPrompt:
				'A warm, articulate older British male physician and historian in his 60s with a slightly reedy, tender, deeply empathetic baritone voice. Rich emotional vulnerability, expressive intellect, trembling alarm in crisis and heartfelt ache in quiet reflection.',
			defaultDelivery:
				'warm, articulate, deeply emotional older physician, expressive rising urgency and tender heartfelt emphasis',
		},
	},
	kai: {
		id: 'kai',
		name: 'Kai "Sparks" Osei',
		title: 'Radio & Recon Scout · Faded',
		side: 'left',
		image: '/cast/kai.webp',
		accent: '#df6b4e',
		defaultStyle: 'speech',
		voiceBrief: {
			displayName: 'PLS2 · Kai Sparks Osei',
			label: 'Energetic Young Recon Scout',
			gender: 'male',
			languageCode: 'en-GB',
			accent: 'British-London',
			age: 'young',
			tone: 'kinetic adrenaline-charged young scout, fiery disbelief, sharp rapid cadence',
			designPrompt:
				'An energetic, sharp-edged young London British-Ghanaian man in his early 20s with a bright, punchy, kinetic tenor voice. Quick on his feet, fiercely expressive, crackling with field adrenaline, biting outrage, and breathless youthful courage.',
			defaultDelivery:
				'energetic, urgent, punchy young field scout, sharp emotional inflection, vivid adrenaline and biting emphasis',
		},
	},
	archive: {
		id: 'archive',
		name: 'Haven Archive',
		title: 'Historical Record · Past Leadership',
		side: 'right',
		image: '/cast/archive.webp',
		accent: '#7ec9c2',
		defaultStyle: 'radio',
		voiceBrief: {
			displayName: 'PLS2 · Haven Archive',
			label: 'Cold Patrician Archival Broadcast',
			gender: 'female',
			languageCode: 'en-GB',
			accent: 'British-RP',
			age: 'middle',
			tone: 'chillingly composed patrician officer, clipped clinical radio authority',
			designPrompt:
				'A crisp, cold, patrician British woman in her late 40s with icy Received Pronunciation diction and austere mid-high institutional authority. Chillingly poised, clipped, clinical, and subtly condescending like a high-ranking council official recording an official state broadcast.',
			defaultDelivery:
				'chillingly composed, crisp patrician institutional broadcast, icy clipped enunciation, cold austere authority',
		},
	},
	amaya: {
		id: 'amaya',
		name: 'Dr. Amaya Okafor',
		title: 'Mainland Lab Holdout',
		side: 'right',
		image: '/cast/amaya.webp',
		accent: '#e6b14c',
		defaultStyle: 'speech',
		voiceBrief: {
			displayName: 'PLS2 · Dr. Amaya Okafor',
			label: 'Luminous Determined Lab Scientist',
			gender: 'female',
			languageCode: 'en-NG',
			accent: 'Nigerian-English',
			age: 'middle',
			tone: 'warm luminous determined scientist, fierce hope and solemn reverence',
			designPrompt:
				'A vibrant, brilliant Nigerian-born female scientist in her mid-30s with a luminous, warm, melodic mezzo-soprano voice and crisp educated diction. Fiercely determined, deeply compassionate, radiating hopeful urgency and passionate scientific conviction.',
			defaultDelivery:
				'passionate, warm, fiercely determined scientist, emphatic luminous clarity and heartfelt resolve',
		},
	},
	vey: {
		id: 'vey',
		name: 'Vey',
		title: 'Defected Hollow Man',
		side: 'left',
		image: '/cast/vey.webp',
		accent: '#d45243',
		defaultStyle: 'speech',
		voiceBrief: {
			displayName: 'PLS2 · Vey',
			label: 'Raspy Bruised Hollow Man Exile',
			gender: 'male',
			languageCode: 'en-US',
			accent: 'Eastern-European-tinged',
			age: 'middle',
			tone: 'raspy low bruised exile, jagged simmering fury and haunted quiet confession',
			designPrompt:
				'A scarred, weary man in his mid-30s with a rough, raspy, smoked-out low voice and a subtle guarded Eastern-European edge. Speaks from the shadows with bruised intensity, jagged simmering anger, heavy breath, and haunted raw confession — unsettling yet painfully human.',
			defaultDelivery:
				'raspy, hushed, bruised intensity, jagged simmering anger and raw haunted confession with heavy pauses',
		},
	},
};

export const CAST_LIST = Object.values(CAST);
