// Stream view for OBS: a keyboard strip that lights up as you play. Open it in its own browser
// window and add that window to OBS as a window capture (OBS browser sources cannot use MIDI).
// Options: ?bg=green|black|transparent  &names=1  &low=C2&high=C7
import { octaveRange } from "../core/keyboard-layout.js";
import { PianoKeyboard } from "../core/keyboard.js";
import * as icons from "../content/icons.js";
import { $, boot, el } from "./common.js";

const ctx = await boot();
const { t, hub, noteNames } = ctx;
const q = new URLSearchParams(location.search);
document.body.dataset.bg = ["green", "black", "transparent"].includes(q.get("bg")) ? q.get("bg") : "green";
const root = $("#app-root");
const box = el("div");
let low = 36;
let high = 95;
try {
	if (q.get("low") && q.get("high")) ({ low, high } = octaveRange(q.get("low"), q.get("high")));
} catch {
	/* keep the default range */
}
const keyboard = new PianoKeyboard(box, { t, noteNames, low, high, interactive: false, names: q.get("names") === "1", id: "stream-kbd" });
root.append(box);
hub.addEventListener("note", (e) => keyboard.setOn(e.detail.midi, e.detail.on));
hub.addEventListener("status", (e) => {
	if (e.detail.state === "connected") connect.hidden = true;
});
const connect = el("button", { type: "button", className: "btn", icon: icons.plugs, text: t("device.connect") });
connect.hidden = !hub.web.supported;
connect.addEventListener("click", () => hub.connectMidi().catch(() => {}));
root.append(connect);
