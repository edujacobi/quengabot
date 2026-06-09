import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { CommandContext } from "../utils/commandContext.js";

export const shuffleCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("shuffle")
		.setDescription("Shuffle the current music queue"),

	aliases: ["sh"],

	async execute(interaction) {
		await handleShuffle(new CommandContext(interaction));
	},

	async executePrefix(message) {
		await handleShuffle(new CommandContext(message));
	}
};

async function handleShuffle(ctx: CommandContext) {
	if (!await ctx.checkVoice(true)) return;

	const queue = ctx.client.distube.getQueue(ctx.guildId);

	if (!queue || queue.songs.length <= 1) {
		const container = new SimpleContainerBuilder(`${EmoteString.Info} **There are not enough songs in the queue to shuffle.**`);
		await ctx.reply(container);
		return;
	}

	await queue.shuffle();

	const container = new SimpleContainerBuilder(
		`${EmoteString.Shuffle} **Shuffled the queue.**`
	);
	await ctx.reply(container);
}

export default shuffleCommand;
