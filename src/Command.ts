import { Message } from "discord.js";

export interface ICommand {
	execute: (msg: Message, callback: (sucess: boolean) => void, ...args: Array<string>) => void;

	config: {
		cleranceLevel: CLERANCE_LEVEL;
		cooldown: number;
		enabled: boolean;
		alias: Array<string>;
	};

	help: {
		name: string;
		category: CATEGORY;
		description: string;
		usage: string;
	};
}

export type CLERANCE_LEVEL = "admin" | "user" | "owner" | "bot-owner";
export type CATEGORY = "miscelaneous" | "mod";
