import { Database, RunResult, Statement } from "sqlite3";

export class DatabaseManager {
	private db: Database;

	constructor(name: string, callback: (sucess: boolean) => void) {
		this.db = new Database(name, (err) => {
			if (err) {
				callback(false);
				return console.log(err);
			}

			callback(true);

			this.db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, rows) => {
				if (!err && rows.length == 0) this.createMainTable();
			});
		});
	}

	getField(field: FIELDS, id: string | undefined | null, callback: (value: string | null) => void) {
		if (typeof id != "string") return callback(null);
		this.db.all(`SELECT ${field} FROM guilds WHERE id=?`, id, (res: Statement, rows: any[]) => {
			if (rows && rows.length != 0) return callback(rows[0][field]);
			callback(null);
		});
	}

	setField(field: FIELDS, id: string, value: string, callback: (sucess: boolean) => void) {
		this.db.run(`INSERT INTO guilds (id, ${field}) VALUES(?, ?) ON CONFLICT(id) DO UPDATE SET ${field}=excluded.${field};`, id, value, (res: RunResult, err: Error | null) => {
			callback(!err);
			err && console.log(err);
		});
	}

	connectAoCID(guild: string, id: string, aocid: string, callback: (sucess: boolean) => void) {
		this.db.run(`INSERT INTO members (guild, id, aocid) VALUES(?, ?, ?) ON CONFLICT(id, aocid) DO UPDATE SET aocid=excluded.aocid;`, guild, id, aocid, (res: RunResult, err: Error | null) => {
			callback(!err);
			err && console.log(err);
		});
	}

	searchAoCMembers(guild: string, ids: Array<string>, callback: (memmbers: { [key: string]: string }) => void) {
		this.db.all(`SELECT id, aocid FROM members WHERE aocid IN (${"?".repeat(ids.length).split("").join()})`, ...ids, (res: Statement, rows: Array<{ aocid: string; id: string }>) => {
			let members: { [key: string]: string } = {};
			rows.forEach((v) => (members[v.aocid] = v.id));
			callback(members);
		});
	}

	createMainTable() {
		this.db.run(`CREATE TABLE "guilds" ("id" TEXT,"prefix" TEXT,"solutions" TEXT,"nickResolver" TEXT,"leaderboard" TEXT,"reactToRole" TEXT,"role" TEXT,"apiKey" TEXT, "leaderboardId" TEXT, PRIMARY KEY("id"));`);
	}
}

export const DEFAULT_PREFIX = "$";
export type FIELDS = "id" | "prefix" | "solutions" | "nickResolver" | "leaderboard" | "reactToRole" | "role" | "apiKey" | "leaderboardId";
