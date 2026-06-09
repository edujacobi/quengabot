import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder
} from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { checkVoiceState, replyWithContainer } from "../utils/discordInteractions.js";
import { EmoteString } from "../utils/emotes.js";

export const pauseCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("pause")
		.setDescription("Pause or resume the playback"),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!await checkVoiceState(interaction, true)) return;

		const queue = interaction.client.distube.getQueue(interaction.guildId!);

		if (!queue) {
			const container = new SimpleContainerBuilder(`${EmoteString.Info} **Nothing is currently playing.**`);
			await replyWithContainer(interaction, container);
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
		await replyWithContainer(interaction, container);
	}
};
export default pauseCommand;
