/**
 * A Tabletop Simulator save holds no game state, only objects: where each one lies and which picture it
 * shows. The census flattens the file into pieces, each named by its picture, so everything after it
 * reads pictures and positions and never the raw file.
 */

export type Vec = { x: number; y: number; z: number };

/** A picture: the first 8 hex digits of the content hash in its URL, or `<sheet>#<index>` for one card of a sheet. */
export type ImageId = string;

export type Decal = { image: ImageId; pos: Vec; scale: number };

export type Colour = { r: number; g: number; b: number };

/** A stroke of the drawing tool. Drawn over an object, it is stored on that object in the object's own frame. */
export type Stroke = { colour: Colour; points: Vec[] };

export type Piece = {
	guid: string;
	/** The TTS object type: `Card`, `Deck`, `Custom_Token`, `Bag`, `3DText` and so on. */
	type: string;
	nickname: string;
	description: string;
	pos: Vec;
	rot: Vec;
	scale: number;
	/** The scale along the table's other axis, which differs from `scale` only for zones. */
	scaleZ: number;
	locked: boolean;
	tint: Colour;
	image: ImageId | null;
	/** The picture on the back of a card. Cards of one deck type share it. */
	back: ImageId | null;
	/** A card lying face down. */
	faceDown: boolean;
	/** Which of its states the piece shows, when it has several. */
	state: number | null;
	/** The pictures of the other states, by state number. */
	states: Record<number, Piece>;
	decals: Decal[];
	/** Objects glued to this one. Their positions are relative to it. */
	attached: Piece[];
	/** What a deck or bag holds, top of a deck first. */
	contents: Piece[];
	text: string | null;
	/** Strokes drawn over this piece, already placed on the table. */
	strokes: Stroke[];
	script: string;
	/** The guid of the bag or deck that holds this piece, or null on the table. */
	holder: string | null;
};

export type Census = {
	name: string;
	date: string;
	pieces: Piece[];
	/** Strokes drawn on the bare table. */
	strokes: Stroke[];
	snapPoints: Vec[];
	table: ImageId | null;
};

type Raw = Record<string, any>;

const hash = (url: string): ImageId => {
	const parts = url.split('/').filter(Boolean);
	const last = parts.at(-1)!;
	return /^[0-9A-F]{40}$/.test(last) ? last.slice(0, 8) : url.replaceAll(/[^A-Za-z0-9]/g, '').slice(-24);
};

const vec = (t: Raw, prefix: string): Vec => ({ x: t[`${prefix}X`], y: t[`${prefix}Y`], z: t[`${prefix}Z`] });

/** A point in an object's own frame, which is scaled and turned about the vertical axis, as a point on the table. */
function onTable(local: Vec, transform: Raw): Vec {
	const turn = (transform.rotY * Math.PI) / 180;
	const x = local.x * transform.scaleX;
	const z = local.z * transform.scaleZ;
	return {
		x: transform.posX + x * Math.cos(turn) + z * Math.sin(turn),
		y: transform.posY + local.y * transform.scaleY,
		z: transform.posZ - x * Math.sin(turn) + z * Math.cos(turn),
	};
}

/** A card inside a deck may leave its sheet to the deck, so the deck's sheets are passed down. */
function piece(raw: Raw, holder: string | null, inherited: Raw = {}): Piece {
	const transform = raw.Transform;
	let image: ImageId | null = null;
	let back: ImageId | null = null;
	if (typeof raw.CardID === 'number') {
		const sheet = { ...inherited, ...raw.CustomDeck }[String(Math.floor(raw.CardID / 100))];
		if (!sheet) throw new Error(`Card ${raw.GUID} names a sheet the save does not hold`);
		image = `${hash(sheet.FaceURL)}#${raw.CardID % 100}`;
		back = hash(sheet.BackURL);
	} else if (raw.CustomImage?.ImageURL) {
		image = hash(raw.CustomImage.ImageURL);
	}
	const others = Object.entries((raw.States ?? {}) as Record<string, Raw>);
	const numbers = others.map(([number]) => Number(number));
	let state: number | null = null;
	if (numbers.length > 0) {
		state = 1;
		while (numbers.includes(state)) state++;
	}
	const rot = vec(transform, 'rot');
	const sheets = { ...inherited, ...raw.CustomDeck };
	return {
		guid: raw.GUID,
		type: raw.Name,
		nickname: raw.Nickname ?? '',
		description: raw.Description ?? '',
		pos: vec(transform, 'pos'),
		rot,
		scale: transform.scaleX,
		scaleZ: transform.scaleZ,
		locked: raw.Locked === true,
		tint: raw.ColorDiffuse ?? { r: 1, g: 1, b: 1 },
		image,
		back,
		faceDown: Math.abs((((rot.z % 360) + 360) % 360) - 180) < 45,
		state,
		states: Object.fromEntries(others.map(([number, other]) => [Number(number), piece(other, holder, sheets)])),
		decals: ((raw.AttachedDecals ?? []) as Raw[]).map(decal => ({
			image: hash(decal.CustomDecal.ImageURL),
			pos: vec(decal.Transform, 'pos'),
			scale: decal.Transform.scaleX,
		})),
		attached: ((raw.ChildObjects ?? []) as Raw[]).map(child => piece(child, holder, sheets)),
		contents: ((raw.ContainedObjects ?? []) as Raw[]).map(child => piece(child, raw.GUID, sheets)),
		text: raw.Text?.Text ?? null,
		strokes: ((raw.AttachedVectorLines ?? []) as Raw[]).map(line => ({
			colour: line.color,
			points: (line.points3 as Vec[]).map(point => onTable(point, transform)),
		})),
		script: raw.LuaScript ?? '',
		holder,
	};
}

export function census(raw: unknown): Census {
	const save = raw as Raw | null;
	if (!save || !Array.isArray(save.ObjectStates) || typeof save.SaveName !== 'string')
		throw new Error('That is not a Tabletop Simulator save');
	return {
		name: save.SaveName.trim(),
		date: save.Date ?? '',
		pieces: (save.ObjectStates as Raw[]).map(object => piece(object, null)),
		strokes: ((save.VectorLines ?? []) as Raw[]).map(line => ({ colour: line.color, points: line.points3 as Vec[] })),
		snapPoints: ((save.SnapPoints ?? []) as Raw[]).map(point => point.Position as Vec),
		table: save.TableURL ? hash(save.TableURL) : null,
	};
}

/** Every piece and everything inside or attached to it, depth first. States are not walked: they are not on the table. */
export function* everyPiece(pieces: Piece[]): Generator<Piece> {
	for (const each of pieces) {
		yield each;
		yield* everyPiece(each.attached);
		yield* everyPiece(each.contents);
	}
}
