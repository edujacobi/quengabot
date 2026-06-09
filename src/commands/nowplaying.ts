import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder
} from "discord.js";
import { type Command } from "../types.js";
import { CustomContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { replyWithContainer } from "../utils/discordInteractions.js";
import { EmoteString } from "../utils/emotes.js";
import { ImageUrls } from "../utils/imageUrls.js";

export const nowplayingCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("nowplaying")
		.setDescription("Show details of the song currently playing"),

	async execute(interaction: ChatInputCommandInteraction) {
		const queue = interaction.client.distube.getQueue(interaction.guildId!);
		const current = queue?.songs[0] ?? null;

		const container = new CustomContainerBuilder();

		if (!current) {
			container.addTexts([`${EmoteString.Info} **Nothing is currently playing.**`]);
			await replyWithContainer(interaction, container);
			return;
		}

		container
			.addTexts([`### ${EmoteString.NowPlaying} Now Playing`])
			.addLargeSeparator()
			.addSectionComponents(section => section
				.addTexts([
					`## [${current.name}](${current.url})`,
					`${current.uploader?.name || "Unknown"}`,
					`-# \`${current.formattedDuration || "?"}\``,
				])
				.setThumbnailAccessory(thumb => thumb
					.setURL(current.thumbnail || ImageUrls.NoThumbnail)
				)
			)
			.addFooter({
				text: `Requested by: <@${current.user?.id || "Unknown"}>`,
			});

		await replyWithContainer(interaction, container);
	}
};
export default nowplayingCommand;
