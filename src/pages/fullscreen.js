// "Full screen" button for practice pages: shows the page's main area (score, keys, controls)
// on the whole screen with the Fullscreen API. Esc or the same button leaves. Not shown where
// the browser cannot do it (iPhone).
import * as icons from "../content/icons.js";
import { el, setLabel } from "./common.js";

export function fullscreenButton(ctx, target = document.querySelector("main")) {
	if (!document.fullscreenEnabled || !target?.requestFullscreen) return null;
	const { t } = ctx;
	const btn = el("button", { type: "button", className: "btn", icon: icons.cornersOut, text: t("common.fullscreen") });
	const sync = () => setLabel(btn, icons.cornersOut, document.fullscreenElement ? t("common.fullscreenExit") : t("common.fullscreen"));
	btn.addEventListener("click", () => (document.fullscreenElement ? document.exitFullscreen() : target.requestFullscreen()).catch(() => {}));
	document.addEventListener("fullscreenchange", sync);
	return btn;
}
