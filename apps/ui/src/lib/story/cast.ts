export type SpeakerId = 'chronicler' | 'mara' | 'tomas' | 'kai' | 'archive' | 'amaya' | 'vey';

export type SpeakerDef = {
	id: SpeakerId;
	name: string;
	title: string;
	side: 'left' | 'right' | 'center';
	image: string | null;
	accent: string;
	defaultStyle: 'narrator' | 'speech' | 'thought' | 'radio';
	/** Guidance for ElevenLabs voice casting in scripts/gen-voices.ts. */
	voiceBrief: {
		gender: 'male' | 'female';
		age: 'young' | 'middle' | 'older';
		tone: string;
		stability: number;
		similarityBoost: number;
		style: number;
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
			gender: 'male',
			age: 'older',
			tone: 'deep resonant cinematic documentary narrator, gravelly maritime gravitas',
			stability: 0.56,
			similarityBoost: 0.8,
			style: 0.32,
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
			gender: 'female',
			age: 'middle',
			tone: 'steady commanding weathered alto, protective, resolute leader under pressure',
			stability: 0.48,
			similarityBoost: 0.78,
			style: 0.4,
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
			gender: 'male',
			age: 'older',
			tone: 'warm articulate compassionate older scholar/physician, haunted and gentle',
			stability: 0.52,
			similarityBoost: 0.78,
			style: 0.35,
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
			gender: 'male',
			age: 'young',
			tone: 'energetic crisp young scout, urgent, sharp-edged and fiercely brave',
			stability: 0.42,
			similarityBoost: 0.76,
			style: 0.48,
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
			gender: 'female',
			age: 'middle',
			tone: 'crisp patrician cold authoritative institutional voice, clinical radio clarity',
			stability: 0.64,
			similarityBoost: 0.8,
			style: 0.25,
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
			gender: 'female',
			age: 'middle',
			tone: 'intelligent calm determined scientist, warm urgent precision',
			stability: 0.5,
			similarityBoost: 0.8,
			style: 0.36,
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
			gender: 'male',
			age: 'middle',
			tone: 'raspy hushed weary exile, rough bruised intensity, quiet confession',
			stability: 0.44,
			similarityBoost: 0.78,
			style: 0.46,
		},
	},
};

export const CAST_LIST = Object.values(CAST);
