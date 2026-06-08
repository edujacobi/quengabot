import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder
} from "discord.js";
import { getPlayer } from "../music/player.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { checkVoiceState, replyWithContainer } from "../utils/discordInteractions.js";
import { EmoteString } from "../utils/emotes.js";

export const removeCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("remove")
		.setDescription("Remove a song from the queue by its index number")
		.addIntegerOption(option => option
			.setName("index")
			.setDescription("The number of the song in the queue (from /queue)")
			.setRequired(true)
			.setMinValue(1)
		),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!await checkVoiceState(interaction, true)) return;

		const player = getPlayer(interaction.guildId!);

		const indexInput = interaction.options.getInteger("index", true);
		// Convert 1-based to 0-based
		const removedTrack = player.Remove(indexInput - 1);

		const container = new SimpleContainerBuilder(
			removedTrack ?
				`${EmoteString.Check} Removed **${removedTrack.title}** by *${removedTrack.artist}* from the queue.` :
				`${EmoteString.Error} Invalid index. Please check the current queue using \`/queue\`.`
		);

		await replyWithContainer(interaction, container);
	}
};
export default removeCommand;
