// Runs before first paint (render-blocking, about 300 bytes) so a chosen theme and the note
// colours setting never flash.
(function () {
	try {
		var s = JSON.parse(localStorage.getItem("nt.v1.settings") || "{}");
		if (s.theme === "dark" || s.theme === "light") document.documentElement.setAttribute("data-theme", s.theme);
		if (s.noteColors === true) document.documentElement.setAttribute("data-note-colors", "");
	} catch (e) {
		/* storage blocked: follow the system theme */
	}
})();
