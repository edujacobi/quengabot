import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { CommandContext } from "../utils/commandContext.js";

export const nextCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("next")
		.setDescription("Skip the currently playing song"),

	aliases: ["n", "skip", "s"],

	async execute(interaction) {
		await handleNext(new CommandContext(interaction));
	},

	async executePrefix(message) {
		await handleNext(new CommandContext(message));
	}
};

async function handleNext(ctx: CommandContext) {
	if (!await ctx.checkVoice(true)) return;

	const queue = ctx.client.distube.getQueue(ctx.guildId);

	if (!queue) {
		const container = new SimpleContainerBuilder(`${EmoteString.Info} **Nothing is currently playing.**`);
		await ctx.reply(container);
		return;
	}

	if (queue.songs.length <= 1) {
		const isAutoplayEnabled = queue.autoplay;
		await queue.stop();
		const container = new SimpleContainerBuilder(`${EmoteString.Skip} **Skipped the track and ended the queue.**`);

		if (isAutoplayEnabled) {
			container.addTexts([`-# Autoplay was disabled.`]);
		}
		await ctx.reply(container);
	}
	else {
		await queue.skip();
		const container = new SimpleContainerBuilder(`${EmoteString.Skip} **Skipped the current track.**`);
		await ctx.reply(container);
	}
}

export default nextCommand;
