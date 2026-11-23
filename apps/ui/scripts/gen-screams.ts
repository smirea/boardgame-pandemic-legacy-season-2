#!/usr/bin/env bun
/**
 * Records the cries of pain a scar is heard as: one take from each of four of the cast's designed voices, with
 * `gemini-3.8-flash-tts`, into `apps/ui/static/sfx/scream-<n>.mp3`. `sfxExposure` picks a take by character, so a
 * character keeps one voice all campaign.
 *
 * Usage:
 *   ./apps/ui/scripts/gen-screams.ts            # record the takes that are missing
 *   ./apps/ui/scripts/gen-screams.ts --force    # record all four again
 *   ./apps/ui/scripts/gen-screams.ts 3          # record take 3 again
 */
import { GoogleGenAI } from '@google/genai';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { designedVoices } from '../src/lib/story/voices.generated.ts';

const ROOT = resolve(dirname(import.meta.path), '../../..');
const OUT_DIR = resolve(ROOT, 'apps/ui/static/sfx');
const TTS_MODEL = 'gemini-3.8-flash-tts';

const key = process.env.GEMINI_API_KEY?.trim();
if (!key) throw new Error('GEMINI_API_KEY is missing. Run this from the repository root, where Bun loads .env.local.');

const TAKES = [
	{ speaker: 'mara', text: 'AAAAAAAAAAAAAAAAAAAAHHHHHH!!!' },
	{ speaker: 'kai', text: 'AAAAAAAAARRRRRRRRGGGGHHHHH!!!' },
	{ speaker: 'amaya', text: 'AAAAAAAAAAAAAAAAAAAAIIIEEEEE!!!' },
	{ speaker: 'tomas', text: 'NNNGGGAAAAAAAAAAAAAAAHHHHH!!!' },
] as const;
// The model reads a short interjection as a grunt. It screams when the text is one long held vowel and the
// direction rules out everything shorter.
const STYLE =
	'a long, full-throated, blood-curdling scream of agony held for two full seconds, like someone being burned; the voice cracks and breaks at its peak, raw, ragged and desperate; one sustained scream at the top of the lungs, not a word, not a grunt, not a short shout, no speech before or after it';

// A scream held for seconds reads as theatre. Its first second and a half, cut off, reads as sudden pain.
const CUT = 'atrim=0:1.5,afade=t=out:st=1.15:d=0.35';

function encode(audio: Buffer, mime: string): Uint8Array {
	const input = /audio\/L16|pcm/i.test(mime)
		? ['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0']
		: ['-i', 'pipe:0'];
	// Whatever silence the model leaves before and after the cry is cut, so it sounds the moment the box is scratched.
	const trim =
		'silenceremove=start_periods=1:start_threshold=-38dB:stop_periods=1:stop_duration=0.25:stop_threshold=-38dB';
	const result = spawnSync(
		'ffmpeg',
		[
			'-hide_banner',
			'-loglevel',
			'error',
			...input,
			'-af',
			`${trim},${CUT},loudnorm=I=-15:TP=-1.5:LRA=11`,
			'-codec:a',
			'libmp3lame',
			'-b:a',
			'96k',
			'-f',
			'mp3',
			'pipe:1',
		],
		{ input: audio, maxBuffer: 32 * 1024 * 1024 },
	);
	if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr?.toString('utf8')}`);
	return new Uint8Array(result.stdout);
}

const ai = new GoogleGenAI({ apiKey: key, apiVersion: 'v1beta' });
mkdirSync(OUT_DIR, { recursive: true });
const force = process.argv.includes('--force');
const only = process.argv.find(arg => /^\d$/.test(arg));

for (const [index, take] of TAKES.entries()) {
	const path = resolve(OUT_DIR, `scream-${index + 1}.mp3`);
	if (only ? Number(only) !== index + 1 : existsSync(path) && !force) {
		console.log(`kept      ${path}`);
		continue;
	}
	const voice = designedVoices[take.speaker]?.voiceId;
	if (!voice) throw new Error(`No designed voice for ${take.speaker}: run gen-voices.ts first`);
	const response = await ai.models.generateContent({
		model: TTS_MODEL,
		contents: [{ role: 'user', parts: [{ text: take.text, speechMetadata: { style: STYLE } }] }],
		config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice } } },
	} as Parameters<typeof ai.models.generateContent>[0]);
	const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
	if (!part?.inlineData?.data) throw new Error(`No audio returned for take ${index + 1}`);
	const mp3 = encode(Buffer.from(part.inlineData.data, 'base64'), part.inlineData.mimeType ?? 'audio/wav');
	writeFileSync(path, mp3);
	console.log(`recorded  ${path} (${take.speaker}, ${mp3.byteLength} bytes)`);
}
