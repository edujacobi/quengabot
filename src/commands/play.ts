import {
	ActionRowBuilder,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder
} from "discord.js";
import yts from "yt-search";
import { type Command } from "../types.js";
import { CommandContext } from "../utils/commandContext.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { Log } from "../utils/log.js";

export const playCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("play")
		.setDescription("Play a song from YouTube, Spotify, Deezer, SoundCloud, or search")
		.addStringOption(option => option
			.setName("query")
			.setDescription("Song link or search query")
			.setRequired(true)
		),

	aliases: ["p"],

	async execute(interaction) {
		const query = interaction.options.getString("query", true);
		await handlePlay(new CommandContext(interaction), query);
	},

	async executePrefix(message, args) {
		const query = args.join(" ");
		const ctx = new CommandContext(message);

		if (!query) {
			const container = new SimpleContainerBuilder(`${EmoteString.Error} Please provide a song link or search query.`);
			await ctx.reply(container);

			return;
		}

		await handlePlay(ctx, query);
	}
};

async function handlePlay(ctx: CommandContext, query: string) {
	if (!await ctx.checkVoice()) return;

	const member = ctx.member;
	const voiceChannel = member.voice.channel!;

	const isUrl = /^https?:\/\//i.test(query);

	if (isUrl) {
		await ctx.defer();
		try {
			await ctx.client.distube.play(voiceChannel, query, {
				member,
				textChannel: ctx.channel,
			});
			// playSong / addSong events in index.ts handle the UI feedback
			const container = new SimpleContainerBuilder(`${EmoteString.Search} **Looking it up...**`);
			await ctx.reply(container);
		}
		catch (err: unknown) {
			const error = err as Error;
			Log.Error("[PlayCommand] Error playing URL: " + error.message);
			const container = new SimpleContainerBuilder(`${EmoteString.Error} **Error:** ${error.message}`);
			await ctx.reply(container, true);
		}
	}
	else {
		// Text search — show 5-result picker using yt-search (fast, no platform SDK needed)
		await ctx.defer();
		try {
			Log.Info(`[PlayCommand] Searching YouTube for: "${query}"`);
			const result = await yts(query);
			const videos = result.videos.slice(0, 10);

			if (videos.length === 0) {
				const container = new SimpleContainerBuilder(`${EmoteString.Error} No results found for: \`${query}\``);
				await ctx.reply(container);
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

			await ctx.reply(container);
		}
		catch (err: unknown) {
			const error = err as Error;
			Log.Error("[PlayCommand] Error searching: " + error.message);
			const container = new SimpleContainerBuilder(`${EmoteString.Error} **Error:** ${error.message}`);
			await ctx.reply(container, true);
		}
	}
}

export default playCommand;
