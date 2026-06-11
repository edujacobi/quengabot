import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { CustomContainerBuilder, SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { CommandContext } from "../utils/commandContext.js";
import { ImageUrls } from "../utils/imageUrls.js";
import { Log } from "../utils/log.js";

interface LyricsResponse {
	data?: {
		artistName?: string;
		trackName?: string;
		trackId?: string;
		searchEngine?: string;
		artworkUrl?: string;
		lyrics?: string;
		message?: string;
		respone?: string; // Spelling match from API
	};
}

export const lyricsCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("lyrics")
		.setDescription("Fetch lyrics for the current playing song or a specified song")
		.addStringOption(option => option
			.setName("query")
			.setDescription("The song name (and optionally artist, e.g., 'Beatles - Yesterday')")
			.setRequired(false)
		),

	aliases: ["ly", "l"],

	async execute(interaction) {
		const query = interaction.options.getString("query") ?? undefined;
		await handleLyrics(new CommandContext(interaction), query);
	},

	async executePrefix(message, args) {
		const query = args.join(" ") || undefined;
		await handleLyrics(new CommandContext(message), query);
	}
};

async function handleLyrics(ctx: CommandContext, query?: string) {
	await ctx.defer();

	let searchTitle = "";
	let searchArtist = "";
	let videoId: string | undefined;

	if (query) {
		if (query.includes("-")) {
			const parts = query.split("-");
			searchArtist = parts[0].trim();
			searchTitle = parts.slice(1).join("-").trim();
		}
		else {
			searchTitle = query.trim();
		}
	}
	else {
		// Get currently playing song in the guild
		const queue = ctx.client.distube.getQueue(ctx.guildId);
		const current = queue?.songs[0];

		if (!current) {
			const container = new SimpleContainerBuilder(
				`${EmoteString.Info} **Nothing is currently playing.** Provide a song name to search, e.g. \`!lyrics Beatles - Yesterday\``
			);
			await ctx.reply(container);
			return;
		}

		videoId = current.id;
		const uploaderName = current.uploader?.name || "";
		searchArtist = cleanArtistName(uploaderName);
		searchTitle = extractSongTitle(current.name || "", searchArtist);
	}

	Log.Info(`[LyricsCommand] Searching lyrics for title: "${searchTitle}", artist: "${searchArtist}", videoId: "${videoId || "none"}"`);

	let lyricsData: {
		artistName: string;
		trackName: string;
		searchEngine: string;
		artworkUrl?: string;
		lyrics: string;
	} | null = null;

	// 1. If videoId is available, try YouTube by trackId
	if (videoId) {
		try {
			const url = `https://lyrics.lewdhutao.my.eu.org/v2/youtube/lyrics?trackId=${videoId}`;
			const response = await fetch(url);
			if (response.ok) {
				const json = await response.json() as LyricsResponse;
				if (json.data && json.data.lyrics && !json.data.message) {
					lyricsData = {
						artistName: json.data.artistName || "Unknown",
						trackName: json.data.trackName || "Unknown",
						searchEngine: json.data.searchEngine || "YouTube",
						artworkUrl: json.data.artworkUrl,
						lyrics: json.data.lyrics
					};
				}
			}
		}
		catch (err) {
			Log.Error(`[LyricsCommand] YouTube trackId fetch failed: ` + (err instanceof Error ? err.message : ""));
		}
	}

	// 2. Try YouTube by title & artist
	if (!lyricsData && searchTitle) {
		try {
			const url = `https://lyrics.lewdhutao.my.eu.org/v2/youtube/lyrics?title=${encodeURIComponent(searchTitle)}&artist=${encodeURIComponent(searchArtist)}`;
			const response = await fetch(url);
			if (response.ok) {
				const json = await response.json() as LyricsResponse;
				if (json.data && json.data.lyrics && !json.data.message) {
					lyricsData = {
						artistName: json.data.artistName || "Unknown",
						trackName: json.data.trackName || "Unknown",
						searchEngine: json.data.searchEngine || "YouTube",
						artworkUrl: json.data.artworkUrl,
						lyrics: json.data.lyrics
					};
				}
			}
		}
		catch (err) {
			Log.Error(`[LyricsCommand] YouTube search fetch failed: ` + (err instanceof Error ? err.message : ""));
		}
	}

	// 3. Try Musixmatch by title & artist
	if (!lyricsData && searchTitle) {
		try {
			const url = `https://lyrics.lewdhutao.my.eu.org/v2/musixmatch/lyrics?title=${encodeURIComponent(searchTitle)}&artist=${encodeURIComponent(searchArtist)}`;
			const response = await fetch(url);
			if (response.ok) {
				const json = await response.json() as LyricsResponse;
				if (json.data && json.data.lyrics && !json.data.message) {
					lyricsData = {
						artistName: json.data.artistName || "Unknown",
						trackName: json.data.trackName || "Unknown",
						searchEngine: json.data.searchEngine || "Musixmatch",
						artworkUrl: json.data.artworkUrl,
						lyrics: json.data.lyrics
					};
				}
			}
		}
		catch (err) {
			Log.Error(`[LyricsCommand] Musixmatch fetch failed: ` + (err instanceof Error ? err.message : ""));
		}
	}

	if (!lyricsData) {
		const container = new SimpleContainerBuilder(
			`${EmoteString.Error} **No lyrics found for:** \`${searchArtist ? `${searchArtist} - ` : ""}${searchTitle}\``
		);
		await ctx.reply(container);
		return;
	}

	// Create output container
	const container = new CustomContainerBuilder();
	container
		.addTexts([`### ${EmoteString.NowPlaying} Lyrics`])
		.addLargeSeparator()
		.addSectionComponents(section => section
			.addTexts([
				`## ${lyricsData!.trackName}`,
				`${lyricsData!.artistName}`,
				`-# Source: \`${lyricsData!.searchEngine}\``,
			])
			.setThumbnailAccessory(thumb => thumb
				.setURL(lyricsData!.artworkUrl || ImageUrls.NoThumbnail)
			)
		)
		.addLargeSeparator();

	// Split long lyrics to avoid Discord character limit per block (using 3000 char chunks)
	const chunks: string[] = [];
	let currentChunk = "";
	const lines = lyricsData.lyrics.split("\n");

	for (const line of lines) {
		// Clean up carriage returns
		const cleanLine = line.replace(/\r/g, "");
		if (currentChunk.length + cleanLine.length + 1 > 3000) {
			chunks.push(currentChunk);
			currentChunk = cleanLine;
		}
		else {
			currentChunk = currentChunk ? `${currentChunk}\n${cleanLine}` : cleanLine;
		}
	}
	if (currentChunk) {
		chunks.push(currentChunk);
	}

	for (const chunk of chunks) {
		container.addTexts([chunk]);
	}

	container.addFooter({
		text: `requested by ${ctx.member.user?.username || "Unknown"}`
	});

	await ctx.reply(container);
}

function cleanArtistName(uploaderName: string): string {
	return uploaderName
		.replace(/\s*-\s*Topic/i, "")
		.replace(/\s*VEVO/i, "")
		.replace(/\s*Official/i, "")
		.replace(/\s*Music/i, "")
		.trim();
}

function extractSongTitle(videoTitle: string, artistName: string): string {
	let title = videoTitle;
	if (artistName) {
		const escapedArtist = artistName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
		const artistRegex = new RegExp(escapedArtist, "gi");
		title = title.replace(artistRegex, "");
	}
	// Remove common video/audio suffixes and bracketed info
	title = title.replace(/[([][^)\]]*(official|video|music|lyric|audio|live|hd|hq|visualizer|remastered|cover|screen|fallon)[^)\]]*[)\]]/gi, "");
	// Remove extra symbols
	title = title.replace(/[-|:|•\n]/g, " ");
	return title.replace(/\s+/g, " ").trim();
}

export default lyricsCommand;
