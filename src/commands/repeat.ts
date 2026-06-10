import type { ChatInputCommandInteraction, GuildMember, Message } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { createButtonCollector } from "../utils/collectors.js";
import { CommandContext } from "../utils/commandContext.js";
import { CustomContainerBuilder, SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteId, EmoteString } from "../utils/emotes.js";
import { RepeatMode } from "distube";
import { deferUpdate } from "../utils/discordInteractions.js";
import { Log } from "../utils/log.js";

export const repeatCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("repeat")
		.setDescription("Configure the repeat mode for the queue"),

	aliases: ["loop"],

	async execute(interaction) {
		await handleRepeat(new CommandContext(interaction));
	},

	async executePrefix(message) {
		await handleRepeat(new CommandContext(message));
	}
};

export function getRepeatContainer(currentMode: RepeatMode) {
	return new CustomContainerBuilder()
		.addTexts([`${EmoteString.Queue} **Current repeat mode:** \`${RepeatMode[currentMode]}\``])
		.addButtonRow(
			button => button
				.setCustomId("repeat_disable")
				.setLabel("Disable")
				.setEmoji(EmoteId.Normal)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(currentMode === RepeatMode.DISABLED),
			button => button
				.setCustomId("repeat_song")
				.setLabel("Song")
				.setEmoji(EmoteId.RepeatOne)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(currentMode === RepeatMode.SONG),
			button => button
				.setCustomId("repeat_queue")
				.setLabel("Queue")
				.setEmoji(EmoteId.Repeat)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(currentMode === RepeatMode.QUEUE)
		);
}

async function handleRepeat(ctx: CommandContext) {
	if (!await ctx.checkVoice(true)) return;

	const queue = ctx.client.distube.getQueue(ctx.guildId);

	if (!queue) {
		const container = new SimpleContainerBuilder(`${EmoteString.Info} **Nothing is currently playing.**`);
		await ctx.reply(container);
		return;
	}

	const container = getRepeatContainer(queue.repeatMode);
	const response = await ctx.reply(container);

	if (!response) return;

	const interactionUser = ctx.isInteraction
		? (ctx.source as ChatInputCommandInteraction).user
		: (ctx.source as Message).author;

	const collector = createButtonCollector({ user: interactionUser } as unknown as ChatInputCommandInteraction, response);
	if (!collector) return;

	collector.on("collect", async (btn) => {
		const member = btn.member as GuildMember;
		deferUpdate(btn);

		if (!member.voice.channel) {
			const warningContainer = new SimpleContainerBuilder(`${EmoteString.Warning} You must be in a voice channel to configure repeat mode.`);
			await ctx.reply(warningContainer, true);
			return;
		}

		const botVoiceChannel = btn.guild?.members.me?.voice.channel;
		if (botVoiceChannel && botVoiceChannel.id !== member.voice.channel.id) {
			const warningContainer = new SimpleContainerBuilder(`${EmoteString.Warning} You must be in the same voice channel as the bot to configure repeat mode.`);
			await ctx.reply(warningContainer, true);
			return;
		}

		let targetMode: RepeatMode = RepeatMode.DISABLED;
		if (btn.customId === "repeat_song") targetMode = RepeatMode.SONG;
		else if (btn.customId === "repeat_queue") targetMode = RepeatMode.QUEUE;

		queue.setRepeatMode(targetMode);
		Log.Info(`[RepeatCommand] Repeat mode changed to ${RepeatMode[targetMode]} for guild ${ctx.guildId}`);

		const updatedContainer = getRepeatContainer(targetMode);
		await ctx.reply(updatedContainer);
	});

	collector.on("end", async () => {
		const currentMode = queue.repeatMode;
		const finalContainer = getRepeatContainer(currentMode);

		for (const row of finalContainer.components) {
			if (row instanceof ActionRowBuilder) {
				for (const btn of row.components) {
					if (btn instanceof ButtonBuilder) {
						btn.setDisabled(true);
					}
				}
			}
		}

		await ctx.reply(finalContainer, false);
	});
}

export default repeatCommand;
