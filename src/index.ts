import { DeezerPlugin } from "@distube/deezer";
import { DirectLinkPlugin } from "@distube/direct-link";
import { SoundCloudPlugin } from "@distube/soundcloud";
import { SpotifyPlugin } from "@distube/spotify";
import { YouTubePlugin } from "@distube/youtube";
import { CustomYtDlpPlugin, parseNetscapeCookies } from "./utils/CustomYtDlpPlugin.js";
import { YouTubeSearchPlugin } from "./utils/YouTubeSearchPlugin.js";
import { setupCustomAutoplay } from "./utils/customAutoplay.js";
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
import { Log } from "./utils/log.js";

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
Log.Info(`[Bot] Using ffmpeg at: ${ffmpegPath}`);

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
	Log.Info(`[Bot] yt-dlp: using cookies file: ${process.env.YTDLP_COOKIES_FILE}`);
}
else {
	Log.Warning("[Bot] No YouTube cookies configured. Set YTDLP_COOKIES_BROWSER (e.g. 'chrome') or YTDLP_COOKIES_FILE in .env to avoid bot detection.");
}
writeFileSync("yt-dlp.conf", ytDlpConfLines.join("\n"));
Log.Info("[Bot] yt-dlp.conf written.");

const customYtDlpPlugin = new CustomYtDlpPlugin({ update: true });

const cookieFile = process.env.YTDLP_COOKIES_FILE || "Jacobi.cookie";
const cookies = parseNetscapeCookies(cookieFile);

const youtubePlugin = new YouTubePlugin({
	cookies: cookies.length > 0 ? cookies : undefined
});

const distube = new DisTube(client, {
	emitNewSongOnly: true,
	emitAddSongWhenCreatingQueue: false,
	emitAddListWhenCreatingQueue: false,
	ffmpeg: {
		path: ffmpegPath,
	},
	plugins: [
		new SpotifyPlugin(),
		new YouTubeSearchPlugin(youtubePlugin),
		new DeezerPlugin(),
		new SoundCloudPlugin(),
		new DirectLinkPlugin(),
		youtubePlugin,
		customYtDlpPlugin,
	],
});

client.distube = distube;

// Setup the custom autoplay logic
setupCustomAutoplay(customYtDlpPlugin);

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
				let command = commandModule.default || commandModule;

				if (command && !("data" in command) && command.default && "data" in command.default) {
					command = command.default;
				}

				if (command && "data" in command && "execute" in command) {
					client.commands.set(command.data.name, command);
					Log.Info(`[Bot] Command ${file} loaded successfully.`);
				}
				else {
					Log.Warning(`[Bot] The command at ${filePath} is missing a required "data" or "execute" property.`);
				}
			}
			catch (err) {
				Log.Error(`[Bot] Error loading command ${file}: ` + (err instanceof Error ? err.message : ""));
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
				let event = eventModule.default || eventModule;

				if (event && !("name" in event) && event.default && "name" in event.default) {
					event = event.default;
				}

				if (event && "name" in event && "execute" in event) {
					if (event.once) {
						client.once(event.name, (...args: unknown[]) => event.execute(...args));
					}
					else {
						client.on(event.name, (...args: unknown[]) => event.execute(...args));
					}
					Log.Info(`[Bot] Discord Event ${file} loaded successfully.`);
				}
			}
			catch (err) {
				Log.Error(`[Bot] Error loading Discord event ${file}: ` + (err instanceof Error ? err.message : ""));
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
				let event = eventModule.default || eventModule;

				if (event && !("name" in event) && event.default && "name" in event.default) {
					event = event.default;
				}

				if (event && "name" in event && "execute" in event) {
					if (event.once) {
						client.distube.once(event.name, (...args: unknown[]) => event.execute(...args));
					}
					else {
						client.distube.on(event.name, (...args: unknown[]) => event.execute(...args));
					}
					Log.Info(`[Bot] DisTube Event ${file} loaded successfully.`);
				}
			}
			catch (err) {
				Log.Error(`[Bot] Error loading DisTube event ${file}: ` + (err instanceof Error ? err.message : ""));
			}
		}
	}
}

// ── Error guards ───────────────────────────────────────────────────────────────
client.on(Events.Error, (error) => {
	Log.Error("Discord Client Error: " + error.message);
});

client.on(Events.ShardError, (error, shardId) => {
	Log.Error(`Discord Shard ${shardId} Error (Network issue): ` + error.message);
});

client.on(Events.ShardDisconnect, (event, shardId) => {
	Log.Warning(`Discord Shard ${shardId} Disconnected (Code: ${event.code}, Reason: ${event.reason || "None"}). Waiting to reconnect...`);
});

client.on(Events.ShardReconnecting, (shardId) => {
	Log.Info(`Discord Shard ${shardId} Reconnecting to Discord Gateway...`);
});

client.on(Events.ShardResume, (shardId, replayedEvents) => {
	Log.Info(`Discord Shard ${shardId} Successfully Resumed. Replayed ${replayedEvents} events.`);
});

const handleExit = (signal: string) => {
	Log.Info(`[Exit] Received ${signal}. Leaving voice channels...`);

	for (const guild of client.guilds.cache.values()) {
		const member = guild.members.me;
		if (member?.voice.channel) {
			member.voice.disconnect().catch((err: unknown) => Log.Error("[Bot] Error disconnecting from voice channel:" + (err instanceof Error ? ` ${err.message}` : "")));
		}
	}

	Log.Info(`[Exit] Received ${signal}. Shutting down gracefully...`);

	client.destroy();
	process.exit(0);
};

process.on("SIGINT", () => handleExit("SIGINT"));
process.on("SIGTERM", () => handleExit("SIGTERM"));
process.on("unhandledRejection", (reason, promise) => Log.Error("[Process] Unhandled Rejection at: " + promise + " reason: " + reason));
process.on("uncaughtException", (error) => Log.Error("[Process] Uncaught Exception: " + error.message));

// ── Startup ────────────────────────────────────────────────────────────────────
async function start() {
	Log.Info("[Bot] Loading commands...");
	await loadCommands(commandsPath);
	Log.Success(`[Bot] Loaded ${client.commands.size} commands.`);

	// ── Diagnostics ─────────────────────────────────────────────────────────────
	try {
		const opus = await import("@discordjs/opus");
		Log.Info("[Diagnose] @discordjs/opus loaded successfully.");
	}
	catch (err: unknown) {
		Log.Error("[Diagnose] Failed to load @discordjs/opus: " + (err instanceof Error ? err.message : ""));
	}

	try {
		const davey = await import("@snazzah/davey");
		Log.Info("[Diagnose] @snazzah/davey loaded successfully.");
	}
	catch (err: unknown) {
		Log.Error("[Diagnose] Failed to load @snazzah/davey: " + (err instanceof Error ? err.message : ""));
	}

	try {
		const { execSync } = await import("child_process");
		const version = execSync(`"${ffmpegPath}" -version`).toString().split("\n")[0];
		Log.Info("[Diagnose] ffmpeg binary is executable. Version: " + version);
	}
	catch (err: unknown) {
		Log.Error("[Diagnose] ffmpeg execution check failed: " + (err instanceof Error ? err.message : ""));
	}


	Log.Info("[Bot] Loading Discord events...");
	await loadDiscordEvents(discordEventsPath);

	Log.Success("[Bot] Loading DisTube events...");
	await loadDisTubeEvents(distubeEventsPath);

	// ── Login ──────────────────────────────────────────────────────────────────
	if (process.env.DISCORD_TOKEN) {
		try {
			await client.login(process.env.DISCORD_TOKEN);
		}
		catch (err: unknown) {
			const error = err as Error;
			Log.Error("[Bot] Failed to log in. Please check your DISCORD_TOKEN in .env: " + error.message);
		}
	}
	else {
		Log.Error("[Bot] Error: DISCORD_TOKEN is missing in the environmental variables (.env).");
	}
}

start().catch(err => {
	Log.Error("[Bot] Critical error during startup: " + (err instanceof Error ? err.message : ""));
});
