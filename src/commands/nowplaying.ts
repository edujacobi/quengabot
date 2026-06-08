import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder
} from "discord.js";
import { getPlayer } from "../music/player.js";
import { type Command } from "../types.js";
import { CustomContainerBuilder, CustomSectionBuilder, SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { replyWithContainer } from "../utils/discordInteractions.js";
import { EmoteString } from "../utils/emotes.js";
import { ImageUrls } from "../utils/imageUrls.js";

export const nowplayingCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("nowplaying")
		.setDescription("Show details of the song currently playing"),

	async execute(interaction: ChatInputCommandInteraction) {
		const player = getPlayer(interaction.guildId!);
		const current = player.GetCurrentTrack();

		if (!current) {
			const container = new SimpleContainerBuilder(
				`${EmoteString.Info} **Nothing is currently playing.**`
			);

			await replyWithContainer(interaction, container);
			return;
		}

		const section = new CustomSectionBuilder()
			.addTexts([
				`### ${EmoteString.NowPlaying} Now Playing`,
				`**Title:** ${current.title}`,
				`**Artist:** ${current.artist}`,
				`**Duration:** ${current.durationString}`,
				`**Source:** ${current.source.replace("_", " ").toUpperCase()}`,
				`**Requested By:** <@${current.requestedBy}>`
			])
			.setThumbnailAccessory(thumb => thumb
				.setURL(current.thumbnailUrl || ImageUrls.NoThumbnail)
			);

		const container = new CustomContainerBuilder()
			.addSectionComponents(section);

		await replyWithContainer(interaction, container);
	}
};
export default nowplayingCommand;
