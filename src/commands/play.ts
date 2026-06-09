import {
	type ChatInputCommandInteraction,
	type GuildMember,
	type GuildTextBasedChannel,
	ActionRowBuilder,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder
} from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { checkVoiceState, deferReply, replyWithContainer } from "../utils/discordInteractions.js";
import { EmoteString } from "../utils/emotes.js";
import yts from "yt-search";

export const playCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("play")
		.setDescription("Play a song from YouTube, Spotify, Deezer, SoundCloud, or search")
		.addStringOption(option => option
			.setName("query")
			.setDescription("Song link or search query")
			.setRequired(true)
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const query = interaction.options.getString("query", true);

		if (!await checkVoiceState(interaction)) return;

		const member = interaction.member as GuildMember;
		const voiceChannel = member.voice.channel!;

		const isUrl = /^https?:\/\//i.test(query);

		if (isUrl) {
			await deferReply(interaction);
			try {
				await interaction.client.distube.play(voiceChannel, query, {
					member,
					textChannel: interaction.channel as GuildTextBasedChannel,
				});
				// playSong / addSong events in index.ts handle the UI feedback
				const container = new SimpleContainerBuilder(`${EmoteString.Search} **Looking it up...**`);
				await replyWithContainer(interaction, container);
			}
			catch (err: unknown) {
				const error = err as Error;
				console.error("[PlayCommand] Error playing URL:", error);
				const container = new SimpleContainerBuilder(`${EmoteString.Error} **Error:** ${error.message}`);
				await replyWithContainer(interaction, container, true);
			}
		}
		else {
			// Text search — show 5-result picker using yt-search (fast, no platform SDK needed)
			await deferReply(interaction);
			try {
				console.log(`[PlayCommand] Searching YouTube for: "${query}"`);
				const result = await yts(query);
				const videos = result.videos.slice(0, 5);

				if (videos.length === 0) {
					const container = new SimpleContainerBuilder(`${EmoteString.Error} No results found for: \`${query}\``);
					await replyWithContainer(interaction, container);
					return;
				}

				const container = new SimpleContainerBuilder(`### ${EmoteString.Search} **Search Results for:** \`${query}\``);

				const select = new StringSelectMenuBuilder()
					.setCustomId("play_search_select")
					.setPlaceholder("Choose a song to play...");

				videos.forEach((video, i) => {
					const duration = video.timestamp || "?";
					select.addOptions(
						new StringSelectMenuOptionBuilder()
							.setLabel(`${i + 1}. ${video.title.substring(0, 80)}`)
							.setDescription(`${video.author?.name?.substring(0, 50) || "Unknown"} | ${duration}`)
							.setValue(video.url)
					);
				});

				const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
				container.addActionRowComponents(row);

				await replyWithContainer(interaction, container);
			}
			catch (err: unknown) {
				const error = err as Error;
				console.error("[PlayCommand] Error searching:", error);
				const container = new SimpleContainerBuilder(`${EmoteString.Error} **Error:** ${error.message}`);
				await replyWithContainer(interaction, container, true);
			}
		}
	}
};
export default playCommand;
