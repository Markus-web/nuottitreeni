// Photos from Unsplash, used under the Unsplash License (https://unsplash.com/license), not
// MIT: free to use, change and redistribute, but not to sell unaltered or to build a competing
// photo service. Credit is not required; the app gives it anyway under every photo.
//
// scripts/build-photos.mjs downloads each source (pinned by sha256), crops it to 2:1 and writes
// src/assets/photos/<id>-<width>.avif and .webp, which are committed. Alt texts live in the
// locale files (photos.<id>). To add a photo: only free photos (not Unsplash+), add an entry
// here, its alt texts, a THIRD_PARTY_NOTICES.md line, then run npm run build:photos.
export const PHOTO_WIDTHS = [480, 800, 1200];
/** Width / height of every output file. */
export const PHOTO_ASPECT = 2;

export const PHOTOS = {
	keys: {
		photographer: "Johannes Plenio",
		profile: "https://unsplash.com/@jplenio",
		page: "https://unsplash.com/photos/piano-keys-RWytwNueNng",
		source: "https://images.unsplash.com/photo-1512733596533-7b00ccf8ebaf?ixlib=rb-4.1.0&q=85&fm=jpg&cs=srgb&w=2400",
		sha256: "44d1a14f6ca9162453d6e9eabc4ab0e9c947091857db86cf092d7d36f23c935f",
		crop: { w: 2400, h: 1200, x: 0, y: 150 },
	},
	"music-stand": {
		photographer: "Lorenzo Spoleti",
		profile: "https://unsplash.com/@lorenzospoleti",
		page: "https://unsplash.com/photos/music-note-on-brown-piano-MlhJNEUQpBs",
		source: "https://images.unsplash.com/photo-1514119412350-e174d90d280e?ixlib=rb-4.1.0&q=85&fm=jpg&cs=srgb&w=2400",
		sha256: "416512ac03f0a04407d0ee605dbfdc1c85b945e389bcb260dbaa83192329b371",
		// Leaves out the piano maker's logo at the top right.
		crop: { w: 1840, h: 920, x: 0, y: 560 },
	},
	hands: {
		photographer: "Seth Gerak",
		profile: "https://unsplash.com/@true_films",
		page: "https://unsplash.com/photos/a-man-is-playing-a-keyboard-with-his-hands-PwT9HOd2JsA",
		source: "https://images.unsplash.com/photo-1635989410193-314dad5975e8?ixlib=rb-4.1.0&q=85&fm=jpg&cs=srgb&w=2400",
		sha256: "7528a52d51f881623fcfd143d0639ed96740c30a60034f319aa5ad4e982a8b35",
		crop: { w: 2400, h: 1200, x: 0, y: 100 },
	},
	"sheet-music": {
		photographer: "Marius Masalar",
		profile: "https://unsplash.com/@marius",
		page: "https://unsplash.com/photos/tilt-selective-photograph-of-music-notes-rPOmLGwai2w",
		source: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?ixlib=rb-4.1.0&q=85&fm=jpg&cs=srgb&w=2400",
		sha256: "1f05cb57040e450731a763b8f208061d8ada019dd2af100a71d68cf75d1ee2ad",
		crop: { w: 2400, h: 1200, x: 0, y: 250 },
	},
};
