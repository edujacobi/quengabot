import { type Collection, type ChatInputCommandInteraction, type Message, type SlashCommandBuilder, type SlashCommandOptionsOnlyBuilder, type SlashCommandSubcommandsOnlyBuilder } from "discord.js";
import type { DisTube } from "distube";

export interface Command {
	data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
	aliases?: string[];
	executePrefix?: (message: Message, args: string[]) => Promise<void>;
}

declare module "discord.js" {
	export interface Client {
		commands: Collection<string, Command>,
		cooldowns: Collection<string, Collection<string, number>>
		userLastCommand: Collection<string, number>,
		userLastSync: Collection<string, number>,
		invites: Collection<number, Collection<string, number>>,
		distube: DisTube,
	}
}