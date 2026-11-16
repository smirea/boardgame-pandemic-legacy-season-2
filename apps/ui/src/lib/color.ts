/** Ink that reads on a filled colour: dark on light fills, bone on dark ones. */
export function inkOn(hex: string) {
	const value = Number.parseInt(hex.slice(1), 16);
	const channel = (shift: number) => {
		const c = ((value >> shift) & 255) / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
	return luminance > 0.3 ? '#2a2017' : '#f6efe0';
}
