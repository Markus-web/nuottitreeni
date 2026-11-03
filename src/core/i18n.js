// Translation lookup and locale-aware number formatting. Pure; each locale module exports a
// plain object (src/content/locales/<lang>.js). Missing keys fall back to English, then to the
// key itself, so a partial community translation still renders.

export function lookup(dict, key) {
	let cur = dict;
	for (const part of key.split(".")) {
		if (cur == null || typeof cur !== "object") return undefined;
		cur = cur[part];
	}
	return cur;
}

export function makeT(dict, fallback) {
	return (key, vars = {}) => {
		const raw = lookup(dict, key) ?? (fallback ? lookup(fallback, key) : undefined) ?? key;
		if (typeof raw !== "string") return raw;
		return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "").toString());
	};
}

/** Locale-aware formatting helpers, e.g. fmt("fi-FI").percent(90) -> "90 %". */
export function fmt(tag) {
	const pct = new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 0 });
	const one = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
	const int = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
	const date = new Intl.DateTimeFormat(tag, { year: "numeric", month: "numeric", day: "numeric" });
	const dateTime = new Intl.DateTimeFormat(tag, { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
	return {
		percent: (n) => pct.format(n / 100),
		seconds: (ms) => one.format(ms / 1000),
		int: (n) => int.format(n),
		minutes: (sec) => int.format(Math.round(sec / 60)),
		date: (ts) => date.format(ts),
		dateTime: (ts) => dateTime.format(ts),
	};
}
