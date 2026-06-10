import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { CustomContainerBuilder, SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { CommandContext } from "../utils/commandContext.js";
import { RepeatMode } from "distube";

/** Format seconds into MM:SS or H:MM:SS */
function formatDuration(seconds: number): string {
	if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	if (hrs > 0) {
		return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const queueCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("queue")
		.setDescription("Display the current music queue"),

	aliases: ["q"],

	async execute(interaction) {
		await handleQueue(new CommandContext(interaction));
	},

	async executePrefix(message) {
		await handleQueue(new CommandContext(message));
	}
};

async function handleQueue(ctx: CommandContext) {
	const queue = ctx.client.distube.getQueue(ctx.guildId);

	if (!queue || queue.songs.length === 0) {
		const container = new SimpleContainerBuilder(
			`${EmoteString.Queue} **The queue is empty. Use \`${ctx.isInteraction ? "/play" : "q!play"}\` to add songs!**`
		);
		await ctx.reply(container);
		return;
	}

	const current = queue.songs[0];
	const upcoming = queue.songs.slice(1);

	const container = new CustomContainerBuilder()
		.addTexts([`### ${EmoteString.Queue} Music Queue`])
		.addLargeSeparator();

	// Now playing
	container
		.addTexts([
			`> -# ${EmoteString.NowPlaying} **Now Playing**`,
			`> ### [${current.name}](${current.url})`,
			`> ${current.uploader?.name || "Unknown"}`,
			`> -# \`${current.formattedDuration || formatDuration(current.duration || 0)}\``,
		])
		.addLargeSeparator();

	// Upcoming queue
	const totalDurationSec = queue.songs.reduce((acc, s) => acc + (s.duration || 0), 0);
	const totalDurationStr = formatDuration(totalDurationSec);

	if (upcoming.length === 0) {
		container.addTexts(["*No upcoming tracks in the queue.*"]);
	}
	else {
		const PAGE_LIMIT = Math.min(15, upcoming.length);
		for (let i = 0; i < PAGE_LIMIT; i++) {
			const song = upcoming[i];
			container.addTexts([
				`\`${i + 1}.\` **[${song.name}](${song.url})** by ${song.uploader?.name || "Unknown"} \`${song.formattedDuration || formatDuration(song.duration || 0)}\``,
			]);
			if (i < PAGE_LIMIT - 1) {
				container.addSmallSeparator();
			}
		}
		if (upcoming.length > PAGE_LIMIT) {
			container
				.addSmallSeparator()
				.addTexts([`and ${upcoming.length - PAGE_LIMIT} more tracks`]);
		}
	}

	let emote = "";

	if (queue.repeatMode === RepeatMode.DISABLED) emote = EmoteString.Normal;
	else if (queue.repeatMode === RepeatMode.SONG) emote = EmoteString.RepeatOne;
	else if (queue.repeatMode === RepeatMode.QUEUE) emote = EmoteString.Repeat;

	container
		.addLargeSeparator()
		.addTexts([
			`-# **Total Tracks:** \`${queue.songs.length}\` | **Total Queue Duration:** \`${totalDurationStr}\` | **Repeat:** ${emote} ${RepeatMode[queue.repeatMode].toLowerCase()}`,
		]);

	await ctx.reply(container);
}

export default queueCommand;
