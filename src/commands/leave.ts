import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { CommandContext } from "../utils/commandContext.js";
import { Log } from "../utils/log.js";

export const leaveCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("leave")
		.setDescription("Stop playback and leave the voice channel"),

	aliases: ["l", "stop"],

	async execute(interaction) {
		await handleLeave(new CommandContext(interaction));
	},

	async executePrefix(message) {
		await handleLeave(new CommandContext(message));
	}
};

async function handleLeave(ctx: CommandContext) {
	if (!await ctx.checkVoice(true)) return;

	const queue = ctx.client.distube.getQueue(ctx.guildId);

	if (!queue) {
		const container = new SimpleContainerBuilder(`${EmoteString.Info} **I am not in a voice channel.**`);
		await ctx.reply(container);
		return;
	}

	await queue.stop();

	const botMember = ctx.source.guild?.members.me;
	if (botMember?.voice.channel) {
		try {
			await botMember.voice.disconnect();
		}
		catch (err: unknown) {
			Log.Error("[Bot] Error disconnecting from voice channel:" + (err instanceof Error ? ` ${err.message}` : ""));
		}
	}

	const container = new SimpleContainerBuilder(
		`${EmoteString.Megaphone} **Left the voice channel and cleared the queue.**`
	);
	await ctx.reply(container);
}

export default leaveCommand;
