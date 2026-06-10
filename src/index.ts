import { DeezerPlugin } from "@distube/deezer";
import { DirectLinkPlugin } from "@distube/direct-link";
import { SoundCloudPlugin } from "@distube/soundcloud";
import { SpotifyPlugin } from "@distube/spotify";
import { YtDlpPlugin } from "@distube/yt-dlp";
import {
	Client,
	Collection,
	Events,
	GatewayIntentBits,
} from "discord.js";
import { DisTube } from "distube";
import dotenv from "dotenv";
import ffmpegStatic from "ffmpeg-static";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type Command } from "./types.js";

dotenv.config();

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

// ── Commands ───────────────────────────────────────────────────────────────────
client.cooldowns = new Collection<string, Collection<string, number>>();
client.commands = new Collection<string, Command>();
client.userLastCommand = new Collection<string, number>();
client.userLastSync = new Collection<string, number>();
client.invites = new Collection<number, Collection<string, number>>();

const commandsPath = path.join(__dirname, "commands");
const discordEventsPath = path.join(__dirname, "events", "discord");
const distubeEventsPath = path.join(__dirname, "events", "distube");

async function loadCommands(dir: string) {
	const files = fs.readdirSync(dir);

	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.lstatSync(filePath);

		if (stat.isDirectory()) {
			await loadCommands(filePath);
		}
		else if ((file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts") && !file.endsWith(".map")) {
			try {
				const moduleUrl = pathToFileURL(filePath).href;
				const commandModule = await import(moduleUrl);
				const command: Command = commandModule.default || commandModule;

				if (command && "data" in command && "execute" in command) {
					client.commands.set(command.data.name, command);
					console.log(`[Bot] Command ${file} loaded successfully.`);
				}
				else {
					console.warn(`[Bot] The command at ${filePath} is missing a required "data" or "execute" property.`);
				}
			}
			catch (err) {
				console.error(`[Bot] Error loading command ${file}:`, err);
			}
		}
	}
}

async function loadDiscordEvents(dir: string) {
	if (!fs.existsSync(dir)) return;
	const files = fs.readdirSync(dir);

	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.lstatSync(filePath);

		if (stat.isDirectory()) {
			await loadDiscordEvents(filePath);
		}
		else if ((file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts") && !file.endsWith(".map")) {
			try {
				const moduleUrl = pathToFileURL(filePath).href;
				const eventModule = await import(moduleUrl);
				const event = eventModule.default || eventModule;

				if (event && "name" in event && "execute" in event) {
					if (event.once) {
						client.once(event.name, (...args: unknown[]) => event.execute(...args));
					}
					else {
						client.on(event.name, (...args: unknown[]) => event.execute(...args));
					}
					console.log(`[Bot] Discord Event ${file} loaded successfully.`);
				}
			}
			catch (err) {
				console.error(`[Bot] Error loading Discord event ${file}:`, err);
			}
		}
	}
}

async function loadDisTubeEvents(dir: string) {
	if (!fs.existsSync(dir)) return;
	const files = fs.readdirSync(dir);

	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.lstatSync(filePath);

		if (stat.isDirectory()) {
			await loadDisTubeEvents(filePath);
		}
		else if ((file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts") && !file.endsWith(".map")) {
			try {
				const moduleUrl = pathToFileURL(filePath).href;
				const eventModule = await import(moduleUrl);
				const event = eventModule.default || eventModule;

				if (event && "name" in event && "execute" in event) {
					if (event.once) {
						client.distube.once(event.name, (...args: unknown[]) => event.execute(...args));
					}
					else {
						client.distube.on(event.name, (...args: unknown[]) => event.execute(...args));
					}
					console.log(`[Bot] DisTube Event ${file} loaded successfully.`);
				}
			}
			catch (err) {
				console.error(`[Bot] Error loading DisTube event ${file}:`, err);
			}
		}
	}
}

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
	console.info(`[Exit] Received ${signal}. Leaving voice channels...`);

	for (const guild of client.guilds.cache.values()) {
		const member = guild.members.me;
		if (member?.voice.channel) {
			member.voice.disconnect().catch((err: unknown) => console.error("[Bot] Error disconnecting from voice channel:", err));
		}
	}

	console.info(`[Exit] Received ${signal}. Shutting down gracefully...`);

	client.destroy();
	process.exit(0);
};

process.on("SIGINT", () => handleExit("SIGINT"));
process.on("SIGTERM", () => handleExit("SIGTERM"));
process.on("unhandledRejection", (reason, promise) => console.error("[Process] Unhandled Rejection at:", promise, "reason:", reason));
process.on("uncaughtException", (error) => console.error("[Process] Uncaught Exception:", error));

// ── Startup ────────────────────────────────────────────────────────────────────
async function start() {
	console.log("[Bot] Loading commands...");
	await loadCommands(commandsPath);
	console.log(`[Bot] Loaded ${client.commands.size} commands.`);

	console.log("[Bot] Loading Discord events...");
	await loadDiscordEvents(discordEventsPath);

	console.log("[Bot] Loading DisTube events...");
	await loadDisTubeEvents(distubeEventsPath);

	// ── Login ──────────────────────────────────────────────────────────────────
	if (process.env.DISCORD_TOKEN) {
		try {
			await client.login(process.env.DISCORD_TOKEN);
		}
		catch (err: unknown) {
			const error = err as Error;
			console.error("[Bot] Failed to log in. Please check your DISCORD_TOKEN in .env:", error.message);
		};
	}
	else {
		console.error("[Bot] Error: DISCORD_TOKEN is missing in the environmental variables (.env).");
	}
}

start().catch(err => {
	console.error("[Bot] Critical error during startup:", err);
});
