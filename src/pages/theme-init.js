// Runs before first paint (render-blocking, about 500 bytes) so a chosen theme and the note
// colours setting never flash. It also starts the page's script one frame after the first
// paint (data-entry, data-preload on this script tag): everything visible is already in the
// HTML, so the stylesheet and the fonts get the network first on a slow phone.
(function () {
	var me = document.currentScript;
	var entry = me && me.getAttribute("data-entry");
	if (entry)
		requestAnimationFrame(function () {
			setTimeout(function () {
				var list = (me.getAttribute("data-preload") || "").split(" ");
				for (var i = 0; i < list.length; i++) {
					if (!list[i]) continue;
					var l = document.createElement("link");
					l.rel = "modulepreload";
					l.href = list[i];
					document.head.appendChild(l);
				}
				var s = document.createElement("script");
				s.type = "module";
				s.src = entry;
				document.head.appendChild(s);
			}, 0);
		});
})();
(function () {
	try {
		var s = JSON.parse(localStorage.getItem("nt.v1.settings") || "{}");
		if (s.theme === "dark" || s.theme === "light") document.documentElement.setAttribute("data-theme", s.theme);
		var c = s.noteColors === true ? "names" : s.noteColors;
		if (c === "names" || c === "hands" || c === "fingers") document.documentElement.setAttribute("data-note-colors", c);
		if (s.namesOnBlackKeys === true) document.documentElement.setAttribute("data-black-names", "");
	} catch (e) {
		/* storage blocked: follow the system theme */
	}
})();
