import dotenv from "dotenv";
dotenv.config();

import ffmpegStatic from "ffmpeg-static";

import {
	Client,
	Collection,
	Events,
	GatewayIntentBits,
	type GuildMember,
	type GuildTextBasedChannel,
	MessageFlags,
} from "discord.js";
import { DisTube, Events as DisTubeEvents } from "distube";
import { SoundCloudPlugin } from "@distube/soundcloud";
import { SpotifyPlugin } from "@distube/spotify";
import { DeezerPlugin } from "@distube/deezer";
import { YtDlpPlugin } from "@distube/yt-dlp";
import { DirectLinkPlugin } from "@distube/direct-link";
import { type Command } from "./types.js";
import { deferReply, replyWithContainer } from "./utils/discordInteractions.js";
import { CustomContainerBuilder, SimpleContainerBuilder } from "./utils/CustomContainerBuilder.js";
import { EmoteString } from "./utils/emotes.js";

// Import commands
import leaveCommand from "./commands/leave.js";
import nextCommand from "./commands/next.js";
import nowplayingCommand from "./commands/nowplaying.js";
import pauseCommand from "./commands/pause.js";
import playCommand from "./commands/play.js";
import queueCommand from "./commands/queue.js";
import removeCommand from "./commands/remove.js";
import helpCommand from "./commands/help.js";

// ── Discord Client ─────────────────────────────────────────────────────────────
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	]
});

// ── DisTube ────────────────────────────────────────────────────────────────────
const ffmpegPath = ffmpegStatic ?? "ffmpeg";
console.log(`[Bot] Using ffmpeg at: ${ffmpegPath}`);

// Write a yt-dlp.conf to the working directory so yt-dlp picks it up automatically.
// This lets us inject cookies and suppress the deprecated --no-call-home warning
// without forking or monkey-patching the @distube/yt-dlp plugin.
import { writeFileSync } from "fs";
const ytDlpConfLines: string[] = [
	"--remote-components ejs:github",
	"--js-runtimes node"
];

if (process.env.YTDLP_COOKIES_FILE) {
	ytDlpConfLines.push(`--cookies ${process.env.YTDLP_COOKIES_FILE}`);
	console.log(`[Bot] yt-dlp: using cookies file: ${process.env.YTDLP_COOKIES_FILE}`);
}
else {
	console.warn("[Bot] No YouTube cookies configured. Set YTDLP_COOKIES_BROWSER (e.g. 'chrome') or YTDLP_COOKIES_FILE in .env to avoid bot detection.");
}
writeFileSync("yt-dlp.conf", ytDlpConfLines.join("\n"));
console.log("[Bot] yt-dlp.conf written.");

const distube = new DisTube(client, {
	emitNewSongOnly: true,
	emitAddSongWhenCreatingQueue: false,
	emitAddListWhenCreatingQueue: false,
	ffmpeg: {
		path: ffmpegPath,
	},
	plugins: [
		// YtDlpPlugin must be LAST — it acts as a catch-all for any URL the other plugins don't handle
		new SpotifyPlugin(),
		new DeezerPlugin(),
		new SoundCloudPlugin(),
		new DirectLinkPlugin(),
		new YtDlpPlugin({ update: true }),
	],
});

client.distube = distube;

// ── DisTube events ─────────────────────────────────────────────────────────────
distube
	.on(DisTubeEvents.PLAY_SONG, (queue, song) => {
		console.log(`[DisTube] Now playing: "${song.name}" by ${song.uploader?.name || "Unknown"} in guild ${queue.id}`);
		const container = new SimpleContainerBuilder(
			`${EmoteString.NowPlaying} **Now playing:** **[${song.name}](${song.url})** by ${song.uploader?.name || "Unknown"}\n-# requested by <@${song.user?.id || "Unknown"}>`
		);
		queue.textChannel?.send({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		}).catch((err: unknown) => console.error("[DisTube] Failed to send playSong message:", err));
	})

	.on(DisTubeEvents.ADD_SONG, (queue, song) => {
		console.log(`[DisTube] Added to queue: "${song.name}" in guild ${queue.id}`);
		const container = new SimpleContainerBuilder(
			`${EmoteString.Check} Added **[${song.name}](${song.url})** to the queue.`
		);
		queue.textChannel?.send({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		}).catch((err: unknown) => console.error("[DisTube] Failed to send addSong message:", err));
	})

	.on(DisTubeEvents.ADD_LIST, (queue, playlist) => {
		console.log(`[DisTube] Added playlist: "${playlist.name}" (${playlist.songs.length} songs) in guild ${queue.id}`);
		const container = new SimpleContainerBuilder(
			`${EmoteString.Check} Added playlist **${playlist.name}** with **${playlist.songs.length}** songs to the queue.`
		);
		queue.textChannel?.send({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		}).catch((err: unknown) => console.error("[DisTube] Failed to send addList message:", err));
	})

	.on(DisTubeEvents.FINISH, (queue) => {
		console.log(`[DisTube] Queue finished in guild ${queue.id}`);
		const container = new SimpleContainerBuilder(
			`${EmoteString.Heart} **Queue finished.** Add more songs with \`/play\`!`
		);
		queue.textChannel?.send({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		}).catch((err: unknown) => console.error("[DisTube] Failed to send finish message:", err));
	})

	.on(DisTubeEvents.DISCONNECT, (queue) => {
		console.log(`[DisTube] Disconnected from voice in guild ${queue.id}`);
	})

	.on(DisTubeEvents.ERROR, (error, queue) => {
		console.error(`[DisTube] Error in guild ${queue?.id || "unknown"}:`, error);
		const container = new SimpleContainerBuilder(
			`${EmoteString.Error} **Playback error:** ${error.message}`
		);
		queue?.textChannel?.send({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		}).catch((err: unknown) => console.error("[DisTube] Failed to send error message:", err));
	});

// ── Commands ───────────────────────────────────────────────────────────────────
const commands = new Collection<string, Command>();
commands.set(playCommand.data.name, playCommand);
commands.set(pauseCommand.data.name, pauseCommand);
commands.set(nextCommand.data.name, nextCommand);
commands.set(leaveCommand.data.name, leaveCommand);
commands.set(queueCommand.data.name, queueCommand);
commands.set(nowplayingCommand.data.name, nowplayingCommand);
commands.set(removeCommand.data.name, removeCommand);
commands.set(helpCommand.data.name, helpCommand);

client.commands = commands;

// ── Startup ────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, () => {
	console.log(`[Bot] Logged in as ${client.user?.tag}!`);
});

// ── Interactions ───────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
	// 1. Slash commands router
	if (interaction.isChatInputCommand()) {
		const command = commands.get(interaction.commandName);
		if (!command) return;

		try {
			await command.execute(interaction);
		}
		catch (err: unknown) {
			console.error(`[Bot] Error executing command ${interaction.commandName}:`, err);
			const container = new CustomContainerBuilder()
				.addTexts([`${EmoteString.Error} An error occurred executing this command: ${(err as Error).message}`]);

			await replyWithContainer(interaction, container, true);
		}
	}

	// 2. Dropdown select menu handler (search result picker)
	if (interaction.isStringSelectMenu()) {
		if (interaction.customId === "play_search_select") {
			const member = interaction.member as GuildMember;
			if (!member.voice.channel) {
				const container = new SimpleContainerBuilder(`${EmoteString.Error} You must be in a voice channel to play music.`);
				await replyWithContainer(interaction, container, true);
				return;
			}

			const botVoiceChannel = interaction.guild?.members.me?.voice.channel;
			if (botVoiceChannel && botVoiceChannel.id !== member.voice.channel.id) {
				const container = new SimpleContainerBuilder(`${EmoteString.Error} You must be in the same voice channel as the bot to play music.`);
				await replyWithContainer(interaction, container, true);
				return;
			}

			await deferReply(interaction);

			try {
				const selectedUrl = interaction.values[0];

				await client.distube.play(member.voice.channel, selectedUrl, {
					member,
					textChannel: interaction.channel as GuildTextBasedChannel,
				});

				// Remove the select menu so it can't be re-triggered
				await interaction.message.edit({ components: [] }).catch(() => undefined);

				const container = new SimpleContainerBuilder(`${EmoteString.Check} Got it! Adding to queue...`);
				await replyWithContainer(interaction, container);
			}
			catch (err: unknown) {
				const error = err as Error;
				console.error("[SelectMenu] Error playing selection:", error);
				const container = new SimpleContainerBuilder(`${EmoteString.Error} **Error:** ${error.message}`);
				await replyWithContainer(interaction, container, true);
			}
		}
	}
});

// ── Message Command Handler (Prefix "q!") ──────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
	// Ignore messages from bots or outside guilds
	if (message.author.bot || !message.guild) return;

	const prefix = "q!";
	if (!message.content.startsWith(prefix)) return;

	// Split message content into command and args
	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const commandName = args.shift()?.toLowerCase();

	if (!commandName) return;

	// Find command by name or alias
	const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases?.includes(commandName));

	if (!command) return;

	try {
		if (command.executePrefix) {
			await command.executePrefix(message, args);
		}
		else {
			const container = new SimpleContainerBuilder(`${EmoteString.Error} This command cannot be run via prefix.`);
			await message.reply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		}
	}
	catch (err: unknown) {
		console.error(`[Prefix] Error executing command ${commandName}:`, err);
		const container = new SimpleContainerBuilder(`${EmoteString.Error} An error occurred: ${(err as Error).message}`);
		await message.reply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		}).catch(() => undefined);
	}
});

// ── Error guards ───────────────────────────────────────────────────────────────
client.on(Events.Error, (error) => {
	console.error("Discord Client Error:", error);
});

client.on(Events.ShardError, (error, shardId) => {
	console.error(`Discord Shard ${shardId} Error (Network issue):`, error);
});

client.on(Events.ShardDisconnect, (event, shardId) => {
	console.warn(`Discord Shard ${shardId} Disconnected (Code: ${event.code}, Reason: ${event.reason || "None"}). Waiting to reconnect...`);
});

client.on(Events.ShardReconnecting, (shardId) => {
	console.info(`Discord Shard ${shardId} Reconnecting to Discord Gateway...`);
});

client.on(Events.ShardResume, (shardId, replayedEvents) => {
	console.info(`Discord Shard ${shardId} Successfully Resumed. Replayed ${replayedEvents} events.`);
});

const handleExit = (signal: string) => {
	console.info(`Received ${signal}. Shutting down gracefully...`);
	client.destroy();
	process.exit(0);
};

process.on("SIGINT", () => handleExit("SIGINT"));
process.on("SIGTERM", () => handleExit("SIGTERM"));

process.on("unhandledRejection", (reason, promise) => {
	console.error("[Process] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
	console.error("[Process] Uncaught Exception:", error);
});

// ── Login ──────────────────────────────────────────────────────────────────────
if (process.env.DISCORD_TOKEN) {
	client.login(process.env.DISCORD_TOKEN).catch((err: unknown) => {
		const error = err as Error;
		console.error("[Bot] Failed to log in. Please check your DISCORD_TOKEN in .env:", error.message);
	});
}
else {
	console.error("[Bot] Error: DISCORD_TOKEN is missing in the environmental variables (.env).");
}
