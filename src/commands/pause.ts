import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { CommandContext } from "../utils/commandContext.js";

export const pauseCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("pause")
		.setDescription("Pause or resume the playback"),

	async execute(interaction) {
		await handlePause(new CommandContext(interaction));
	},

	async executePrefix(message) {
		await handlePause(new CommandContext(message));
	}
};

async function handlePause(ctx: CommandContext) {
	if (!await ctx.checkVoice(true)) return;

	const queue = ctx.client.distube.getQueue(ctx.guildId);

	if (!queue) {
		const container = new SimpleContainerBuilder(`${EmoteString.Info} **Nothing is currently playing.**`);
		await ctx.reply(container);
		return;
	}

	let message: string;
	if (queue.paused) {
		queue.resume();
		message = `${EmoteString.Play} **Playback resumed.**`;
	}
	else {
		queue.pause();
		message = `${EmoteString.Pause} **Playback paused.**`;
	}

	const container = new SimpleContainerBuilder(message);
	await ctx.reply(container);
}

export default pauseCommand;
