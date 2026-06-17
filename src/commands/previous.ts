import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { CommandContext } from "../utils/commandContext.js";

export const previousCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("previous")
		.setDescription("Play the previous song in the queue"),

	aliases: ["prev", "back"],

	async execute(interaction) {
		await handlePrevious(new CommandContext(interaction));
	},

	async executePrefix(message) {
		await handlePrevious(new CommandContext(message));
	}
};

async function handlePrevious(ctx: CommandContext) {
	if (!await ctx.checkVoice(true)) return;

	const queue = ctx.client.distube.getQueue(ctx.guildId);

	if (!queue) {
		const container = new SimpleContainerBuilder(`${EmoteString.Info} **Nothing is currently playing.**`);
		await ctx.reply(container);
		return;
	}

	if (!queue.previousSongs || queue.previousSongs.length === 0) {
		const container = new SimpleContainerBuilder(`${EmoteString.Info} **There are no previous songs in the queue history.**`);
		await ctx.reply(container);
		return;
	}

	try {
		// Mark as manual skip so autoplay/instant end checks are not incorrectly triggered
		queue._manualUpdate = true;
		await queue.previous();
		const container = new SimpleContainerBuilder(`${EmoteString.Skip} **Playing the previous track.**`);
		await ctx.reply(container);
	}
	catch (err: unknown) {
		const error = err as Error;
		const container = new SimpleContainerBuilder(`${EmoteString.Error} **Failed to play previous track:** ${error.message || error}`);
		await ctx.reply(container);
	}
}

export default previousCommand;
