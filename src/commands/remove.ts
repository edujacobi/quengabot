import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder
} from "discord.js";
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

		const queue = interaction.client.distube.getQueue(interaction.guildId!);
		if (!queue) {
			const container = new SimpleContainerBuilder(`${EmoteString.Info} **The queue is empty.**`);
			await replyWithContainer(interaction, container);
			return;
		}

		const indexInput = interaction.options.getInteger("index", true);
		// queue.songs[0] is current song — upcoming songs start at index 1
		// User-facing index 1 maps to queue.songs[1] (first upcoming)
		const songIndex = indexInput; // 1-based user input = index in songs[] (skip songs[0])

		const song = queue.songs[songIndex];
		if (!song) {
			const container = new SimpleContainerBuilder(
				`${EmoteString.Error} Invalid index. Please check the current queue using \`/queue\`.`
			);
			await replyWithContainer(interaction, container);
			return;
		}

		queue.songs.splice(songIndex, 1);

		const container = new SimpleContainerBuilder(
			`${EmoteString.Check} Removed **${song.name}** by *${song.uploader?.name || "Unknown"}* from the queue.`
		);
		await replyWithContainer(interaction, container);
	}
};
export default removeCommand;
