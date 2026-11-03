// In-process stand-in for a Cloudflare D1 binding, backed by Node's built-in SQLite.
// Implements the subset the Worker uses: prepare().bind().first()/run()/all() and batch().
// Lets the API tests run without wrangler or network. Real D1 is covered by the browser
// suite (wrangler dev) and the live proof.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

class Statement {
	constructor(db, sql, params = []) {
		this.db = db;
		this.sql = sql;
		this.params = params;
	}
	bind(...params) {
		return new Statement(this.db, this.sql, params);
	}
	async first(column) {
		const row = this.db.prepare(this.sql).get(...this.params);
		if (!row) return null;
		return column ? row[column] : { ...row };
	}
	async all() {
		return { success: true, results: this.db.prepare(this.sql).all(...this.params).map((r) => ({ ...r })) };
	}
	async run() {
		const r = this.db.prepare(this.sql).run(...this.params);
		return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
	}
}

export function createD1(migrationFiles = []) {
	const db = new DatabaseSync(":memory:");
	for (const file of migrationFiles) db.exec(readFileSync(file, "utf8"));
	return {
		raw: db,
		prepare: (sql) => new Statement(db, sql),
		async batch(statements) {
			db.exec("BEGIN");
			try {
				const out = [];
				for (const s of statements) out.push(await s.run());
				db.exec("COMMIT");
				return out;
			} catch (e) {
				db.exec("ROLLBACK");
				throw e;
			}
		},
	};
}
