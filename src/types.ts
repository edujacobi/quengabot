import { type Collection, type ChatInputCommandInteraction, type SlashCommandBuilder, type SlashCommandOptionsOnlyBuilder, type SlashCommandSubcommandsOnlyBuilder } from "discord.js";

export interface Track {
	id: string; // unique ID for referencing (e.g., for removal)
	title: string;
	artist: string;
	url: string; // Source URL
	thumbnailUrl?: string;
	duration: number; // in seconds
	durationString: string; // e.g. "3:45"
	source: "youtube" | "spotify" | "deezer" | "soundcloud" | "youtube_music" | "search" | "direct";
	requestedBy: string; // Username of requester
}

export interface Command {
	data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

declare module "discord.js" {
	export interface Client {
		commands: Collection<string, Command>,
		cooldowns: Collection<string, Collection<string, number>>
		userLastCommand: Collection<string, number>,
		userLastSync: Collection<string, number>,
		invites: Collection<number, Collection<string, number>>,
	}
}