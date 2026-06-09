import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder
} from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { checkVoiceState, replyWithContainer } from "../utils/discordInteractions.js";
import { EmoteString } from "../utils/emotes.js";

export const nextCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("next")
		.setDescription("Skip the currently playing song"),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!await checkVoiceState(interaction, true)) return;

		const queue = interaction.client.distube.getQueue(interaction.guildId!);

		if (!queue) {
			const container = new SimpleContainerBuilder(`${EmoteString.Info} **Nothing is currently playing.**`);
			await replyWithContainer(interaction, container);
			return;
		}

		await queue.skip();

		const container = new SimpleContainerBuilder(`${EmoteString.Skip} **Skipped the current track.**`);
		await replyWithContainer(interaction, container);
	}
};
export default nextCommand;
