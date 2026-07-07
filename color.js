// color.js
// Gives every note a unique, consistent color identity.
// The hex color is derived locally from the note's id (so it's instant
// and never fails), then a human-readable name is looked up via the
// free Color API (thecolorapi.com) — no API key required.

/**
 * Deterministic string hash -> unsigned 32-bit integer.
 * Not cryptographic, just needs to be stable and evenly distributed
 * so the same note id always produces the same color.
 */
function hashStringToInt(str) {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return hash >>> 0; // force unsigned
}

/**
 * Derives a 6-digit hex color (no #) from any string, typically a note id.
 */
function stringToHexColor(str) {
	const hash = hashStringToInt(str);
	return (hash & 0xffffff).toString(16).padStart(6, "0");
}

/**
 * Looks up a human-readable name for a hex color via the Color API.
 * Returns null on failure so a lookup issue never blocks note saving —
 * the hex value alone is always enough to render a swatch.
 */
async function getColorName(hex) {
	const cleanHex = hex.replace(/^#/, "");
	const url = `https://www.thecolorapi.com/id?hex=${cleanHex}&format=json`;
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Color API responded ${res.status}`);
		const data = await res.json();
		return data?.name?.value || null;
	} catch (err) {
		console.warn("Color name fetch failed:", err.message);
		return null;
	}
}

/**
 * Convenience wrapper: derives a color from a note id and fetches
 * its readable name. `hex` is always available (computed locally);
 * `name` may be null if the API call fails.
 */
async function getColorForNote(noteId) {
	const hex = stringToHexColor(noteId);
	const name = await getColorName(hex);
	return { hex: `#${hex}`, name };
}