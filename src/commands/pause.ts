import { AudioPlayerStatus } from "@discordjs/voice";
import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder
} from "discord.js";
import { getPlayer } from "../music/player.js";
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

		const player = getPlayer(interaction.guildId!);

		const currentStatus = player.GetStatus();
		let message = "";

		if (currentStatus === AudioPlayerStatus.Playing) {
			player.Pause();
			message = `${EmoteString.Pause} **Playback paused.**`;
		}
		else if (currentStatus === AudioPlayerStatus.Paused) {
			player.Resume();
			message = `${EmoteString.Play} **Playback resumed.**`;
		}
		else {
			message = `${EmoteString.Info} **Nothing is currently playing.**`;
		}

		const container = new SimpleContainerBuilder(message);

		await replyWithContainer(interaction, container);
	}
};
export default pauseCommand;
