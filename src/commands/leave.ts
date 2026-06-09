import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder
} from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { checkVoiceState, replyWithContainer } from "../utils/discordInteractions.js";
import { EmoteString } from "../utils/emotes.js";

export const leaveCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("leave")
		.setDescription("Stop playback and leave the voice channel"),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!await checkVoiceState(interaction, true)) return;

		const queue = interaction.client.distube.getQueue(interaction.guildId!);

		if (!queue) {
			const container = new SimpleContainerBuilder(`${EmoteString.Info} **I am not in a voice channel.**`);
			await replyWithContainer(interaction, container);
			return;
		}

		await queue.stop();

		const container = new SimpleContainerBuilder(
			`${EmoteString.Heart} **Left the voice channel and cleared the queue.**`
		);
		await replyWithContainer(interaction, container);
	}
};
export default leaveCommand;
