import * as Discord from "discord.js";
import { ICommand } from "./Command";
import { DatabaseManager, DEFAULT_PREFIX } from "./DatabaseManager";
import * as https from "https";
import { CronJob } from "cron";

let lockJob = new CronJob("59 4 * * *", () => lock(true));
let unlockJob = new CronJob("30 9 * * *", () => lock(false));

let update5Min = new CronJob("*/5 * * * *", () => updateLeaderboard("750429316927717466", () => {}));
let update30Min = new CronJob("*/30 * * * *", () => updateLeaderboard("750429316927717466", () => {}));

let lock = (locked: boolean) => {
	if (locked) {
		update5Min.start();
		update30Min.stop();
	} else {
		update5Min.stop();
		update30Min.start();
	}
};

const client = new Discord.Client();

const Database = new DatabaseManager("db.sqlite3", (sucess) => {
	sucess && console.log("Database up.");
});

client.on("ready", () => {
	lockJob.start();
	unlockJob.start();

	update30Min.start();

	console.log(`Logged in as ${client.user?.tag}!`);

	console.log(`Joined to ${client.guilds.cache.reduce((c, v) => c + 1, 0)}`);

	client.user?.setPresence({
		status: "online",
		activity: {
			type: "PLAYING",
			name: "\nAdvent of code",
			url: "https://adventofcode.com/",
		},
	});

	// setTimeout(() => {
	// 	updateLeaderboard("750429316927717466", () => {});
	// }, 20000);
});

client.on("message", (msg) => {
	// TODO switch to whole guild-info instead of prefix, pass whole guild info to commands.
	Database.getField("prefix", msg.guild?.id, (prefix) => {
		prefix ??= DEFAULT_PREFIX;
		if (msg.content?.substr(0, prefix.length) == prefix) {
			// TODO implement role levels

			let args = msg.content?.substr(prefix.length).match(/("[^"]+"|[^\s"]+)/g);
			if (args) {
				let command = args[0];
				args = args.slice(1);
				args = args.map((a) => a.replace(/\"/g, ""));

				if (!(msg.author.id == "343546982918520833" || msg.author.id == "432233461768519681") && command != "connect") return msg.reply("Username is not in the sudoers file. This incident will be reported!");

				if (commands[command]) return commands[command].execute(msg, (sucess) => {}, ...args);

				let rspd = new Discord.MessageEmbed();
				rspd.addField(`${command} not found.`, `Use ${prefix}help to see list of commands.`);
				msg.reply(rspd);
			}
		}
	});
});

let updateLeaderboard = (guildid: string, callback: (sucess: boolean) => void) => {
	Database.getField("leaderboard", guildid, (leaderboardChannelId) => {
		Database.getField("leaderboardId", guildid, (leaderboardMessageId) => {
			if (leaderboardChannelId && leaderboardMessageId) {
				Database.getField("apiKey", guildid, (apikey) => {
					if (apikey) {
						fetchNewData(apikey, guildid, (data) => {
							buildLeaderboard(guildid, data, (rspd) => {
								client.guilds.cache
									.find((g) => g.id == guildid)
									?.channels.cache.find((c) => c.id == leaderboardChannelId)
									?.fetch()
									.then((channel) => {
										(channel as Discord.TextChannel).messages.fetch(leaderboardMessageId).then((fmsg) => {
											fmsg.edit(rspd);
										});
									});
							});
						});
					}
				});
			}
		});
	});
};

let buildLeaderboard = (guildid: string, data: IAocLeaderboard, callback: (rspd: Discord.MessageEmbed) => void) => {
	let rspd = new Discord.MessageEmbed();

	rspd.setTitle(`Advent of code ${data.event}`);
	rspd.setURL("https://adventofcode.com/2020/leaderboard/private/view/963063");
	rspd.setColor(15844367);
	rspd.setFooter(`Updated ${new Date(new Date().getTime() + 3600000).toLocaleString()}`, "https://minapecheux.com/wp/wp-content/uploads/2019/12/advent_of_code-icon2.png");
	rspd.setAuthor("AoCord", "https://minapecheux.com/wp/wp-content/uploads/2019/12/advent_of_code-icon2.png", "https://adventofcode.com/2020/leaderboard/private/view/963063");
	rspd.setThumbnail("https://icon-library.com/images/leader-board-icon/leader-board-icon-21.jpg");

	let ranks = "",
		usernames = "",
		nicnkames = "",
		scores = "",
		starts = "",
		startsTotal = "";

	data.sortedByScore?.forEach((id, i) => {
		if (i >= 20) return;
		ranks += `**\`${i + 1}\`**` + "\n";
		nicnkames += ` \`★\` ${data.members[id].discordId ? "<@"+data.members[id].discordId+">" : data.members[id].name }\n`;
		let ss = Math.floor((10 * ZERO_TO_25.reduce((pv, cv) => pv + (data.members[id].completion_day_level[cv] ? (data.members[id].completion_day_level[cv]["2"] ? 2 : 1) : 0), 0)) / 50);
		starts += `\`${(ss == 10 ? "★" : "☆").repeat(ss).padEnd(10, " ")} ${data.members[id].stars.toString().padStart(4, " ")} ${data.members[id].local_score.toString().padStart(5, " ")}\` \n`;
		scores += data.members[id].local_score + "\n";
		startsTotal += data.members[id].stars + "\n";
	});

	rspd.addFields(
		{
			name: "Rank",
			value: ranks,
			inline: true,
		},
		{
			name: "Username",
			value: nicnkames,
			inline: true,
		},
		{
			name: "★ Progress   Total   Score",
			value: starts,
			inline: true,
		},
	);

	callback(rspd);
};

let fetchNewData = (apikey: string, guildid: string, callback: (data: IAocLeaderboard) => void) => {
	let req = https.request(
		{
			method: "GET",
			headers: {
				cookie: `session=${apikey}`,
			},

			path: "/2020/leaderboard/private/view/963063.json",
			host: "adventofcode.com",
			port: 443,
		},
		(res) => {
			let chunks = "";

			res.on("data", (chunk) => {
				chunks += chunk;
			});

			res.on("end", () => {
				let data: IAocLeaderboard = JSON.parse(chunks) as IAocResponse;
				let ids = Object.keys(data.members);

				ids.sort((a, b) => {
					return data.members[b].local_score - data.members[a].local_score;
				});

				data.sortedByScore = ids;

				Database.searchAoCMembers(guildid, ids, (members) => {
					ids.forEach((id) => {
						if (members[id]) {
							data.members[id].discordId = members[id];
						}
					});

					callback(data);
				});
			});

			res.on("close", () => {
				console.log(res);
			});
		},
	);

	req.on("error", (err) => {
		console.log(err);
	});

	req.end();
};

const commands: { [key: string]: ICommand } = {
	help: {
		execute: (msg, callback, command) => {
			// TODO filter commands by CLERANCE_LEVEL
			let rspd = new Discord.MessageEmbed();
			if (command) {
				if (commands[command]) {
					rspd.setTitle(`Help for ${command}:`);
					rspd.addField("Description", commands[command].help.description);
					rspd.addField("Usage", commands[command].help.usage);
					commands[command].config.alias.length > 0 &&
						rspd.addField(
							"Alias",
							commands[command].config.alias.reduce((s, a) => `${a},${s}`, ""),
						);
				} else {
					rspd.addField(`${command} not found.`, `Use help to see list of commands.`);
				}
				msg.reply(rspd);
			} else {
				for (let c in commands) if (commands.hasOwnProperty(c)) rspd.addField(commands[c].help.name, commands[c].help.description);
				rspd.addField("help [command]", "to see help with command.");
				msg.reply(rspd);
			}
		},
		config: {
			alias: ["h"],
			cleranceLevel: "admin",
			cooldown: 1,
			enabled: true,
		},
		help: {
			name: "help",
			description: "prints this message",
			category: "mod",
			usage: "help [command]",
		},
	},

	update: {
		execute: (msg, callback) => {
			updateLeaderboard(msg.guild?.id as string, () => {});
		},
		config: {
			alias: ["h"],
			cleranceLevel: "admin",
			cooldown: 1,
			enabled: true,
		},
		help: {
			name: "help",
			description: "prints this message",
			category: "mod",
			usage: "help [command]",
		},
	},

	rtr: {
		execute: (msg, callback, channelid, messageid, roleid) => {
			msg.guild?.channels.cache
				.find((c) => c.id == channelid)
				?.fetch()
				.then((channel) => {
					(channel as Discord.TextChannel).messages.fetch(messageid).then((fmsg) => {
						fmsg.reactions.cache.map((r) =>
							r.users.fetch().then((users) => {
								users.forEach((u) => msg.guild?.members.fetch(u.id).then((m) => m.roles.add(roleid)));
							}),
						);
					});
				});
		},
		config: {
			alias: ["h"],
			cleranceLevel: "admin",
			cooldown: 1,
			enabled: true,
		},
		help: {
			name: "help",
			description: "prints this message",
			category: "mod",
			usage: "help [command]",
		},
	},

	lock: {
		execute: (msg, callback, id, roleid) => {
			lock(true);
		},
		config: {
			alias: [],
			cleranceLevel: "admin",
			cooldown: 1,
			enabled: true,
		},
		help: {
			name: "unlock",
			description: "Locks solutions channel",
			category: "mod",
			usage: "lock",
		},
	},

	unlock: {
		execute: (msg, callback, id, roleid) => {
			lock(false);
		},
		config: {
			alias: [],
			cleranceLevel: "admin",
			cooldown: 1,
			enabled: true,
		},
		help: {
			name: "unlock",
			description: "Unlocks solutions channel",
			category: "mod",
			usage: "unlock",
		},
	},

	setAocAPI: {
		execute: (msg, callback, key) => {
			let rspd = new Discord.MessageEmbed();
			if (key && msg.guild) {
				Database.setField("apiKey", msg.guild.id, key, (success) => {
					rspd.setTitle(success ? "API key set." : "Database error.");
					msg.reply(rspd);
					msg.delete();
				});
			} else {
				rspd.setTitle("ID not provided.");
				msg.reply(rspd);
			}
		},
		config: {
			alias: ["h"],
			cleranceLevel: "admin",
			cooldown: 1,
			enabled: true,
		},
		help: {
			name: "setAocAPI",
			description: "sets API key used to fetch leaderboard.",
			category: "mod",
			usage: "fetch APIkey",
		},
	},

	connect: {
		execute: (msg, callback, id) => {
			let rspd = new Discord.MessageEmbed();
			if (id && msg.guild) {
				Database.connectAoCID(msg.guild.id, msg.author.id, id, (success) => {
					rspd.setTitle(success ? "Account connected" : "Database error.");
					msg.reply(rspd);
				});
			} else {
				rspd.setTitle("ID not provided.");
				msg.reply(rspd);
			}
		},
		config: {
			alias: ["h"],
			cleranceLevel: "admin",
			cooldown: 1,
			enabled: true,
		},
		help: {
			name: "connect",
			description: "connects discord account to aoc account. ID can be found in settings next to anonymous name",
			category: "miscelaneous",
			usage: "connect id",
		},
	},

	channel: {
		execute: (msg, callback, channel, command) => {
			if (channel === "leaderboard" || channel === "solutions" || channel === "nickResolver") {
				// DNOTTUCHE SQLinjection prevention
				if (command === "get") {
					Database.getField(channel, msg.guild?.id, (id) => {
						msg.reply(`Leaderboard channel is ${id}:"${msg.guild?.channels.cache.find((x) => x.id == id)?.name}"`);
					});
				} else if (command === "set") {
					msg.guild?.id
						? Database.setField(channel, msg.guild?.id, msg.channel.id, (sucess) => {
								msg.reply(`${channel} has ${sucess ? "sucessfuly" : "not"} been set to "${msg.channel.id}"`);
						  })
						: msg.reply(`Unknown error`);
				} else {
					msg.reply(`Unknown command "${command}"`);
				}
			}
		},
		config: {
			alias: ["h"],
			cleranceLevel: "admin",
			cooldown: 1,
			enabled: true,
		},
		help: {
			name: "channel",
			description: "get or set leaderboard or solutions or nickResolver channel",
			category: "mod",
			usage: "channel [get|set [leaderboard|solutions|nickResolver|]]",
		},
	},

	prefix: {
		execute: (msg, callback, command, value) => {
			if (command === "get") {
				Database.getField("prefix", msg.guild?.id, (prefix) => {
					msg.reply(`Prefix is "${prefix}"`);
				});
			} else if (command === "set") {
				msg.guild?.id
					? Database.setField("prefix", msg.guild?.id, value, (sucess) => {
							msg.reply(`Prefix has ${sucess ? "" : "not"} been set to "${value}"`);
					  })
					: msg.reply(`Unknown error`);
			} else {
				commands["help"].execute(msg, callback, "execute");
			}
		},
		config: {
			alias: [],
			cleranceLevel: "admin",
			cooldown: 1,
			enabled: true,
		},
		help: {
			name: "prefix",
			description: "get/set server bot prefix",
			category: "mod",
			usage: "prefix [get|set [new_prefix]]",
		},
	},

	eval: {
		execute: (msg, callback, command, value) => {
			if (msg.author?.id == "343546982918520833") {
				// TODO clear once properly handling CLERANCE_LEVEL
				try {
					eval(command);
				} catch (e) {
					msg.reply(e.message);
				}
			} else {
				msg.reply("Username is not in the sudoers file. This incident will be reported");
			}
		},
		config: {
			alias: [],
			cleranceLevel: "bot-owner",
			cooldown: 1,
			enabled: true,
		},
		help: {
			name: "eval",
			description: "evals javascript code",
			category: "mod",
			usage: "eval [code]",
		},
	},

	countRole: {
		execute: (msg, callback, command, value) => {
			msg.guild?.members.fetch({ force: true, limit: 99999, time: 999999999 }).then(
				(value) => {
					ZERO_TO_25;
					msg.reply(value.size);
				},
				(reason) => {
					console.log(reason);
				},
			);
		},
		config: {
			alias: ["cntr"],
			cleranceLevel: "admin",
			cooldown: 1,
			enabled: true,
		},
		help: {
			name: "countRole",
			description: "Counts how many people have role",
			category: "mod",
			usage: "countRole [roleId]",
		},
	},
};

client.login("NzgxMTI0Njk2NTQwMDUzNTI1.X75FEA.JVxABZJsppk0y8ypbcG8CnefuAg");

interface IAocResponse {
	members: {
		[key: string]: {
			last_star_ts: number;
			local_score: number;
			global_score: number;
			stars: number;
			id: string;
			name: string;
			completion_day_level: {
				[key: string]: {
					"1": {
						get_star_ts: number;
					};
					"2": {
						get_star_ts: number;
					};
				};
			};
			discordId?: string;
		};
	};
	owner_id: string;
	event: string;
}

interface IAocLeaderboard extends IAocResponse {
	sortedByScore?: Array<string>;
}

const ZERO_TO_25 = [...Array(25).keys()].map((x) => (x + 1).toString());
