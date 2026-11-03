// Keeps the screen on while an exercise runs (Screen Wake Lock API), so a tablet on the music
// stand does not dim in the middle of a piece. The browser drops the lock when the page is
// hidden; it is taken again when the page comes back while the exercise still runs. Nothing
// happens where the API is missing or the "wakeLock" setting is off.
import { getSettings } from "./store.js";

let sentinel = null;
let wanted = false;

async function acquire() {
	if (!wanted || sentinel || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
	try {
		sentinel = await navigator.wakeLock.request("screen");
		sentinel.addEventListener("release", () => (sentinel = null));
	} catch {
		sentinel = null; // refused (battery saver, permissions policy): the screen just follows its own timer
	}
}

/** Ask for the screen to stay on (true) or let it sleep again (false). */
export function keepAwake(on) {
	wanted = on && getSettings().wakeLock !== false;
	if (wanted) acquire();
	else if (sentinel) {
		sentinel.release().catch(() => {});
		sentinel = null;
	}
}

document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") acquire();
});
