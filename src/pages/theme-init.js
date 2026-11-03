// Runs before first paint (render-blocking, about 200 bytes) so a chosen theme never flashes.
(function () {
	try {
		var s = JSON.parse(localStorage.getItem("nt.v1.settings") || "{}");
		if (s.theme === "dark" || s.theme === "light") document.documentElement.setAttribute("data-theme", s.theme);
	} catch (e) {
		/* storage blocked: follow the system theme */
	}
})();
