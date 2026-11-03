// Third-party parts shipped with the app. Shown on the Licences page and listed in
// THIRD_PARTY_NOTICES.md; keep both in step when a dependency changes.
export const LICENSES = [
	{
		name: "Nuottitreeni",
		version: "app",
		license: "MIT",
		url: "https://github.com/Markus-web/nuottitreeni/blob/main/LICENSE",
		use: { fi: "Sovelluksen oma koodi, tekstit, oppitunnit ja kappaleiden nuotinnokset", en: "The app's own code, texts, lessons and piece transcriptions" },
	},
	{
		name: "OpenSheetMusicDisplay",
		version: "2.2.1",
		license: "BSD-3-Clause",
		url: "https://github.com/opensheetmusicdisplay/opensheetmusicdisplay",
		use: { fi: "Kappaleiden nuottien näyttäminen (MusicXML)", en: "Showing sheet music for pieces (MusicXML)" },
	},
	{
		name: "VexFlow",
		version: "1.2.93",
		license: "MIT",
		url: "https://github.com/0xfe/vexflow",
		use: { fi: "Nuottien piirtäminen OpenSheetMusicDisplayn osana", en: "Music engraving inside OpenSheetMusicDisplay" },
	},
	{
		name: "JSZip",
		version: "3.10.1",
		license: "MIT (dual MIT or GPL-3.0, used under MIT)",
		url: "https://github.com/Stuk/jszip",
		use: { fi: "Pakattujen MXL-nuottitiedostojen avaaminen", en: "Opening compressed MXL sheet music files" },
	},
	{
		name: "Space Grotesk",
		version: "2.0.0",
		license: "SIL Open Font License 1.1",
		url: "https://github.com/floriankarsten/space-grotesk",
		use: { fi: "Otsikoiden kirjasin", en: "Heading font" },
	},
	{
		name: "Noto Music",
		version: "2.004",
		license: "SIL Open Font License 1.1",
		url: "https://github.com/notofonts/music",
		use: { fi: "Nuottiavaimet, etumerkit ja taukomerkit", en: "Clefs, accidentals and rest signs" },
	},
	{
		name: "Phosphor Icons",
		version: "2.1.1",
		license: "MIT",
		url: "https://github.com/phosphor-icons/core",
		use: { fi: "Kuvakkeet valikossa ja painikkeissa", en: "Icons in the menu and on buttons" },
	},
	{
		name: "Unsplash",
		version: "photos",
		license: "Unsplash License",
		url: "https://unsplash.com/license",
		use: {
			fi: "Valokuvat: Johannes Plenio, Lorenzo Spoleti, Seth Gerak ja Marius Masalar. Ei MIT-lisenssin alainen.",
			en: "Photos by Johannes Plenio, Lorenzo Spoleti, Seth Gerak and Marius Masalar. Not covered by the MIT licence.",
		},
	},
	{
		name: "FluidR3_GM",
		version: "3.1",
		license: "MIT",
		url: "https://github.com/FluidSynth/fluidsynth/wiki/SoundFont",
		use: { fi: "Pianoäänet (näytteet renderöity tästä soundfontista)", en: "Piano sound (samples rendered from this soundfont)" },
	},
];
