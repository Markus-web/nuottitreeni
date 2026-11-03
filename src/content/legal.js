// Privacy notice and accessibility statement, per locale. Structure follows GDPR articles
// 13-14 and the Finnish accessibility statement model. Placeholders filled by the build
// (NT_OPERATOR_* variables) or, for self-hosted copies without them, at runtime from
// /api/config: {operator} {contact} {place} {site}. {updated} is the date of the last text change.
//
// Facts here must match the code: retention (worker/index.js RETENTION_DAYS = 365), rate-limit
// hashing (worker/rate-limit.js, rows kept 2 days), storage keys (src/core/store.js).
// Change the text and the code together, and bump UPDATED.

export const UPDATED = "2026-11-03";

export default {
	fi: {
		privacy: {
			title: "Tietosuojaseloste",
			lede: "Miten Nuottitreeni käsittelee tietoja. Tiedot EU:n yleisen tietosuoja-asetuksen (2016/679) 13 ja 14 artiklan mukaisesti.",
			updated: "Päivitetty: {updated}",
			sections: [
				{
					h: "1. Rekisterinpitäjä",
					p: ["{operator}{place}", "Yhteydenotot tietosuoja-asioissa: {contact}", "Erillistä tietosuojavastaavaa ei ole."],
				},
				{
					h: "2. Lyhyesti",
					p: [
						"Nuottitreeni toimii selaimessasi. Edistymisesi, asetuksesi, tallenteesi ja avaamasi nuottitiedostot tallentuvat vain omaan selaimeesi, eikä niitä lähetetä minnekään.",
						"Palvelimelle tallentuu jotain vain, jos itse luot synkronointikoodin. Silloinkin tallentuu vain harjoitustilastoja, ei nimeä, yhteystietoja, tiedostoja eikä tallenteita.",
						"Sovelluksessa ei ole käyttäjätilejä, evästeitä, analytiikkaa eikä mainoksia, eikä se lataa mitään kolmansien osapuolten palveluista.",
					],
				},
				{
					h: "3. Mitä tietoja käsitellään",
					p: ["Selaimessasi (laitteesi omassa tallennustilassa, localStorage ja IndexedDB):"],
					list: [
						"harjoitustilastot: oppitunnit, oikeat ja väärät vastaukset nuoteittain, vastausajat ja harjoitusminuutit päivittäin",
						"asetukset, kuten kieli, teema, ääni ja MIDI-laitteiden asetukset",
						"satunnainen laitetunnus, jolla eri laitteiden tilastot pidetään erillään synkronoinnissa",
						"soitostasi tehdyt MIDI-tallenteet ja avaamasi nuottitiedostot",
					],
					after: [
						"Jos luot synkronointikoodin, palvelimelle tallentuu harjoitustilastot, satunnaiset laitetunnukset ja tallennusajat. Koodia ei tallenneta sellaisenaan, vaan siitä laskettu tiiviste (SHA-256).",
						"Jos otat mikrofonin käyttöön, selaimesi tunnistaa siitä soitetun nuotin korkeuden. Ääntä ei tallenneta eikä lähetetä minnekään, ja mikrofoni on käytössä vain, kun olet itse käynnistänyt sen.",
						"Palvelin käsittelee pyyntöjen yhteydessä IP-osoitteesi. Väärinkäytösten estämiseksi IP-osoitteesta lasketaan suolattu, päivittäin vaihtuva tiiviste, jota säilytetään enintään kaksi vuorokautta. Itse IP-osoitetta ei tallenneta.",
					],
				},
				{
					h: "4. Käyttötarkoitukset ja oikeusperusteet",
					list: [
						"Selaimeen tallennettavat tiedot: sovelluksen toiminta pyynnöstäsi. Tiedot ovat välttämättömiä, jotta pyytämäsi palvelu, kuten edistymisen tallentaminen, toimii.",
						"Synkronointi: palvelun toimittaminen pyynnöstäsi (tietosuoja-asetuksen 6 artiklan 1 kohdan b alakohta).",
						"IP-osoitteen tiiviste: palvelun suojaaminen väärinkäytöltä, oikeutettu etu (6 artiklan 1 kohdan f alakohta).",
					],
				},
				{
					h: "5. Vastaanottajat ja käsittelijät",
					p: [
						"Palvelu toimii Cloudflare, Inc:n alustalla (Cloudflare Workers ja D1-tietokanta), joka käsittelee tietoja käsittelijänä. Cloudflare käsittelee verkkoliikenteen ja IP-osoitteet myös verkon suojaamiseksi.",
						"Tietoja ei myydä eikä luovuteta muille.",
					],
				},
				{
					h: "6. Siirrot ETA-alueen ulkopuolelle",
					p: [
						"Cloudflare voi käsitellä tietoja myös ETA-alueen ulkopuolella. Siirrot perustuvat EU:n ja Yhdysvaltojen väliseen tietosuojakehykseen, jonka piiriin Cloudflare on sertifioitunut, ja Euroopan komission vakiosopimuslausekkeisiin.",
					],
				},
				{
					h: "7. Säilytysajat",
					list: [
						"Selaimeen tallennetut tiedot säilyvät, kunnes poistat ne sovelluksen asetuksista tai selaimen asetuksista.",
						"Synkronointitiedot poistetaan automaattisesti, kun koodia ei ole käytetty 12 kuukauteen. Voit poistaa ne itse milloin tahansa.",
						"IP-osoitteen tiivisteet poistetaan viimeistään kahden vuorokauden kuluttua.",
					],
				},
				{
					h: "8. Suojaus",
					p: [
						"Yhteydet on salattu (HTTPS). Synkronointikoodit tallennetaan vain tiivisteinä, ja palvelin hyväksyy vain harjoitustilastojen muotoisia tietoja. Sivusto ei lataa ulkopuolisia skriptejä.",
						"Synkronointikoodi toimii kuin salasana: kuka tahansa koodin tietävä voi nähdä tilastosi. Älä jaa koodia julkisesti.",
					],
				},
				{
					h: "9. Evästeet ja selaimen tallennustila",
					p: [
						"Sovellus ei käytä evästeitä. Se käyttää selaimen tallennustilaa (localStorage ja IndexedDB) vain pyytämiesi toimintojen, kuten edistymisen ja asetusten, tallentamiseen.",
					],
				},
				{
					h: "10. Oikeutesi",
					p: [
						"Voit nähdä, ladata ja poistaa kaikki selaimeesi tallentuneet tiedot Asetukset-sivulla. Jos käytät synkronointia, voit ladata palvelimelle tallennetut tiedot ja poistaa ne samalla sivulla.",
						"Sinulla on oikeus saada pääsy tietoihisi, oikaista ja poistaa ne, rajoittaa niiden käsittelyä, vastustaa käsittelyä ja siirtää tiedot järjestelmästä toiseen. Pyynnöt: {contact}.",
						"Voit tehdä valituksen Tietosuojavaltuutetun toimistolle (tietosuoja.fi), jos katsot, että tietojasi käsitellään lainvastaisesti.",
					],
				},
				{
					h: "11. Automaattinen päätöksenteko",
					p: ["Tietoja ei käytetä automaattiseen päätöksentekoon eikä profilointiin."],
				},
				{
					h: "12. Muutokset",
					p: ["Selostetta päivitetään, kun sovelluksen tietojen käsittely muuttuu. Päivityspäivä on tämän sivun alussa. Sovelluksen lähdekoodi on julkinen, joten käsittelyn voi tarkistaa myös siitä."],
				},
			],
		},
		accessibility: {
			title: "Saavutettavuusseloste",
			lede: "Nuottitreeni pyrkii siihen, että kuka tahansa voi harjoitella sillä riippumatta siitä, miten käyttää tietokonetta.",
			updated: "Päivitetty: {updated}",
			sections: [
				{ h: "Soveltamisala", p: ["Seloste koskee sivustoa {site} ja Nuottitreeni-sovellusta. Tämä on vapaaehtoinen saavutettavuusseloste."] },
				{
					h: "Tavoitetaso",
					p: ["Tavoitteena on WCAG 2.2 -ohjeiston taso AAA: kaikki sovellettavat A-, AA- ja AAA-tason onnistumiskriteerit."],
				},
				{
					h: "Nykytila",
					p: [
						"Jokainen julkaistava versio testataan automaattisesti: axe-core-säännöt tasoille A, AA ja AAA, tekstin kontrasti vähintään 7:1, kohteiden koko vähintään 44 x 44 pikseliä, näppäimistön kohdistus, 320 pikselin leveys ilman vaakavieritystä, tekstin välistyksen muuttaminen, korkean kontrastin tila ja koko harjoituskierros pelkällä näppäimistöllä.",
						"Kaikki toiminnot toimivat näppäimistöllä. Nuottien ja koskettimien tilaa ei kerrota pelkällä värillä. Sivustolla ei ole liikkuvia tai vilkkuvia osia eikä aikarajoja.",
					],
				},
				{
					h: "Tunnetut rajoitteet",
					list: [
						"Harjoitusnuotti kuvataan avustaville teknologioille vain yleisellä tasolla, koska tarkka kuvaus kertoisi vastauksen. Koskettimien nimet -harjoitus, rytmikysymykset ja sanasto toimivat ruudunlukijalla.",
						"Mustat koskettimet ovat kapeampia kuin 44 pikseliä, koska pianon koskettimiston muoto on harjoituksen sisältöä. Ne ovat vähintään 24 pikseliä leveitä, ja jokaisen koskettimen voi valita myös nuolinäppäimillä.",
						"Kapealla näytöllä koskettimisto ja nuottiviivasto vierivät omassa laatikossaan vaakasuunnassa.",
						"Rytmin soittaminen ja kappaleiden tempotila ovat ajoitettuja harjoituksia. Tempoa voi hidastaa, ja samat asiat voi harjoitella ilman aikaa rytmitehtävissä ja kappaleiden odotustilassa.",
						"Musiikin termejä ei voi välttää. Jokainen termi selitetään oppitunnissa ja sanastossa, ja apuna ovat esimerkit.",
						"Ruudunlukijalla tehtävää käsintestausta ei ole vielä tehty kaikilla laitteilla.",
					],
				},
				{
					h: "Palaute",
					p: ["Jos huomaat saavutettavuusongelman, kerro siitä: {contact}. Pyrimme vastaamaan kahden viikon kuluessa. Voit myös avata ilmoituksen sovelluksen GitHub-sivulla."],
				},
				{
					h: "Valvontaviranomainen",
					p: [
						"Jos katsot, että palvelu kuuluu digitaalisten palvelujen tarjoamisesta annetun lain piiriin, etkä saa meiltä vastausta tai ratkaisua, voit olla yhteydessä Liikenne- ja viestintävirasto Traficomiin: saavutettavuusvaatimukset.fi, saavutettavuus@traficom.fi, puhelin 029 534 5000.",
					],
				},
				{ h: "Laadinta ja tarkistus", p: ["Seloste on laadittu {updated}. Arvio perustuu automaattisiin testeihin ja kehittäjän omaan tarkistukseen."] },
			],
		},
	},
	en: {
		privacy: {
			title: "Privacy notice",
			lede: "How Note Trainer handles data, as required by Articles 13 and 14 of the EU General Data Protection Regulation (2016/679).",
			updated: "Updated: {updated}",
			sections: [
				{ h: "1. Controller", p: ["{operator}{place}", "Privacy questions: {contact}", "There is no separate data protection officer."] },
				{
					h: "2. In short",
					p: [
						"Note Trainer runs in your browser. Your progress, settings, recordings and the sheet music files you open are saved only in your own browser and are not sent anywhere.",
						"Something is stored on the server only if you create a sync code yourself. Even then only practice statistics are stored: no name, contact details, files or recordings.",
						"The app has no user accounts, cookies, analytics or ads, and it loads nothing from third-party services.",
					],
				},
				{
					h: "3. What data is handled",
					p: ["In your browser (your device's own storage, localStorage and IndexedDB):"],
					list: [
						"practice statistics: lessons, right and wrong answers per note, answer times and practice minutes per day",
						"settings such as language, theme, sound and MIDI device settings",
						"a random device id that keeps the statistics of different devices apart when syncing",
						"MIDI recordings of your playing and the sheet music files you open",
					],
					after: [
						"If you create a sync code, the server stores the practice statistics, random device ids and the times of saving. The code itself is not stored, only a hash (SHA-256) of it.",
						"If you turn on the microphone, your browser recognises the pitch of the note you play. The sound is never recorded or sent anywhere, and the microphone is on only after you start it yourself.",
						"The server handles your IP address when you make a request. To prevent abuse, a salted hash of the IP address that changes daily is kept for at most two days. The IP address itself is not stored.",
					],
				},
				{
					h: "4. Purposes and legal bases",
					list: [
						"Data saved in your browser: running the app at your request. It is needed for the service you ask for, such as saving your progress, to work.",
						"Sync: providing the service at your request (GDPR Article 6(1)(b)).",
						"IP address hash: protecting the service from abuse, legitimate interest (Article 6(1)(f)).",
					],
				},
				{
					h: "5. Recipients and processors",
					p: [
						"The service runs on the platform of Cloudflare, Inc. (Cloudflare Workers and the D1 database), which processes data as a processor. Cloudflare also processes network traffic and IP addresses to protect its network.",
						"Data is not sold or given to anyone else.",
					],
				},
				{
					h: "6. Transfers outside the EEA",
					p: [
						"Cloudflare may also process data outside the European Economic Area. Transfers are based on the EU-US Data Privacy Framework, under which Cloudflare is certified, and on the European Commission's standard contractual clauses.",
					],
				},
				{
					h: "7. Retention",
					list: [
						"Data saved in your browser stays until you delete it in the app's settings or your browser settings.",
						"Sync data is deleted automatically when the code has not been used for 12 months. You can delete it yourself at any time.",
						"IP address hashes are deleted within two days.",
					],
				},
				{
					h: "8. Security",
					p: [
						"Connections are encrypted (HTTPS). Sync codes are stored only as hashes, and the server accepts only data shaped like practice statistics. The site loads no outside scripts.",
						"A sync code works like a password: anyone who knows it can see your statistics. Do not share it publicly.",
					],
				},
				{
					h: "9. Cookies and browser storage",
					p: ["The app uses no cookies. It uses browser storage (localStorage and IndexedDB) only to save the things you ask it to, such as progress and settings."],
				},
				{
					h: "10. Your rights",
					p: [
						"You can see, download and delete everything saved in your browser on the Settings page. If you use sync, you can download the data stored on the server and delete it on the same page.",
						"You have the right to access, correct and erase your data, to restrict or object to its processing, and to data portability. Requests: {contact}.",
						"You can lodge a complaint with your data protection authority; in Finland that is the Office of the Data Protection Ombudsman (tietosuoja.fi).",
					],
				},
				{ h: "11. Automated decisions", p: ["The data is not used for automated decision-making or profiling."] },
				{
					h: "12. Changes",
					p: ["This notice is updated when the app's data handling changes. The date is at the top of this page. The app's source code is public, so the handling can also be checked there."],
				},
			],
		},
		accessibility: {
			title: "Accessibility statement",
			lede: "Note Trainer aims to let anyone practise, whatever way they use a computer.",
			updated: "Updated: {updated}",
			sections: [
				{ h: "Scope", p: ["This statement covers the site {site} and the Note Trainer app. It is a voluntary accessibility statement."] },
				{ h: "Target level", p: ["The target is WCAG 2.2 level AAA: every applicable success criterion at levels A, AA and AAA."] },
				{
					h: "Current status",
					p: [
						"Every release is tested automatically: axe-core rules for levels A, AA and AAA, text contrast of at least 7:1, targets of at least 44 by 44 pixels, keyboard focus, a 320 pixel width without horizontal scrolling, changed text spacing, high contrast mode, and a whole practice round with the keyboard only.",
						"Everything works with a keyboard. The state of notes and keys is never shown by colour alone. The site has no moving or flashing parts and no time limits.",
					],
				},
				{
					h: "Known limitations",
					list: [
						"The practice note is described to assistive technology only in general terms, because an exact description would give away the answer. The key-name exercise, the rhythm questions and the glossary work with a screen reader.",
						"Black keys are narrower than 44 pixels because the shape of the piano keyboard is part of what is taught. They are at least 24 pixels wide, and every key can also be chosen with the arrow keys.",
						"On narrow screens the keyboard and the staff scroll sideways inside their own box.",
						"Playing rhythm and the tempo mode for pieces are timed exercises. The tempo can be slowed down, and the same things can be practised without timing in the rhythm questions and the wait mode for pieces.",
						"Music terms cannot be avoided. Every term is explained in the lessons and the glossary, with examples.",
						"Manual testing with screen readers has not yet been done on every device.",
					],
				},
				{ h: "Feedback", p: ["If you notice an accessibility problem, please tell us: {contact}. We aim to reply within two weeks. You can also open an issue on the app's GitHub page."] },
				{
					h: "Enforcement",
					p: [
						"If you think the service falls under the Finnish Act on the Provision of Digital Services and you get no reply or solution from us, you can contact the Finnish Transport and Communications Agency Traficom: saavutettavuusvaatimukset.fi, saavutettavuus@traficom.fi, phone +358 29 534 5000.",
					],
				},
				{ h: "Preparation", p: ["This statement was prepared on {updated}. The assessment is based on automated tests and the developer's own review."] },
			],
		},
	},
};
