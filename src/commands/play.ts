import {
	type ChatInputCommandInteraction,
	type GuildMember,
	type TextBasedChannel,
	ActionRowBuilder,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder
} from "discord.js";
import { getPlayer } from "../music/player.js";
import { resolveUrl, searchTracks } from "../music/resolver.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { checkVoiceState, deferReply, replyWithContainer } from "../utils/discordInteractions.js";
import { EmoteString } from "../utils/emotes.js";

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
		const player = getPlayer(interaction.guildId!);
		const botVoiceChannel = interaction.guild?.members.me?.voice.channel;

		await deferReply(interaction);

		try {
			const isUrl = /^https?:\/\//i.test(query);

			if (isUrl) {
				if (!botVoiceChannel) {
					player.Connect(member.voice.channel!);
					player.SetTextChannel(interaction.channel as TextBasedChannel);
				}

				const tracks = await resolveUrl(query, interaction.user.id);
				await player.Add(tracks);

				const container = new SimpleContainerBuilder(tracks.length > 1
					? `${EmoteString.Check} Added **${tracks.length}** songs to the queue.`
					: `${EmoteString.Check} Added **${tracks[0].title}** to the queue.`);

				await replyWithContainer(interaction, container);
			}
			else {
				// Search query
				const results = await searchTracks(query, 5);
				if (results.length === 0) {
					const container = new SimpleContainerBuilder(`${EmoteString.Error} No search results found for: \`${query}\``);
					await replyWithContainer(interaction, container);
					return;
				}

				// Show select menu
				const container = new SimpleContainerBuilder(`### ${EmoteString.Search} **Search Results for:** \`${query}\``);

				const select = new StringSelectMenuBuilder()
					.setCustomId("play_search_select")
					.setPlaceholder("Choose a song to play...");

				results.forEach((track, i) => {
					select.addOptions(
						new StringSelectMenuOptionBuilder()
							.setLabel(`${i + 1}. ${track.title.substring(0, 80)}`)
							.setDescription(`${track.artist.substring(0, 50)} | ${track.durationString}`)
							.setValue(track.url)
					);
				});

				const row = new ActionRowBuilder<StringSelectMenuBuilder>()
					.addComponents(select);

				container.addActionRowComponents(row);

				await replyWithContainer(interaction, container);
			}
		}
		catch (err: unknown) {
			const error = err as Error;
			console.error("[PlayCommand] Error playing song:", error);
			const container = new SimpleContainerBuilder(`${EmoteString.Error} **Error:** ${error.message}`);
			await replyWithContainer(interaction, container, true);
		}
	}
};
export default playCommand;
