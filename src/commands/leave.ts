import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { CommandContext } from "../utils/commandContext.js";
import { Log } from "../utils/log.js";
import { cancelInactivityTimer } from "../utils/inactivityManager.js";

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

	// Cancel any pending inactivity timer
	cancelInactivityTimer(ctx.guildId, "Manual leave command");

	const botMember = ctx.source.guild?.members.me;
	const botVoiceChannel = botMember?.voice.channel;

	if (!botVoiceChannel) {
		const container = new SimpleContainerBuilder(`${EmoteString.Info} **I am not in a voice channel.**`);
		await ctx.reply(container);
		return;
	}

	const queue = ctx.client.distube.getQueue(ctx.guildId);
	const hadQueue = Boolean(queue);

	if (queue) {
		await queue.stop();
	}

	// Clear voice channel status if set
	try {
		await ctx.client.rest.put(`/channels/${botVoiceChannel.id}/voice-status`, {
			body: { status: "" }
		});
	}
	catch (err: unknown) {
		Log.Error("[Bot] Failed to clear voice channel status:" + (err instanceof Error ? ` ${err.message}` : ""));
	}

	// Disconnect using DisTube voice manager and guild member voice
	try {
		ctx.client.distube.voices.leave(ctx.guildId);
	}
	catch (err: unknown) {
		Log.Error("[Bot] Error leaving voice channel with DisTube:" + (err instanceof Error ? ` ${err.message}` : ""));
	}

	if (botMember?.voice.channel) {
		try {
			await botMember.voice.disconnect();
		}
		catch (err: unknown) {
			Log.Error("[Bot] Error disconnecting from voice channel:" + (err instanceof Error ? ` ${err.message}` : ""));
		}
	}

	const message = hadQueue
		? `${EmoteString.Megaphone} **Left the voice channel and cleared the queue.**`
		: `${EmoteString.Megaphone} **Left the voice channel.**`;

	const container = new SimpleContainerBuilder(message);
	await ctx.reply(container);
}

export default leaveCommand;
