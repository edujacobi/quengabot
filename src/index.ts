import {
	Client,
	Collection,
	Events,
	GatewayIntentBits,
	type GuildMember,
	type TextBasedChannel
} from "discord.js";
import dotenv from "dotenv";
import { getPlayer } from "./music/player.js";
import { resolveUrl } from "./music/resolver.js";
import { type Command } from "./types.js";
import { deferReply, replyWithContainer } from "./utils/discordInteractions.js";

// Import commands
import leaveCommand from "./commands/leave.js";
import nextCommand from "./commands/next.js";
import nowplayingCommand from "./commands/nowplaying.js";
import pauseCommand from "./commands/pause.js";
import playCommand from "./commands/play.js";
import queueCommand from "./commands/queue.js";
import removeCommand from "./commands/remove.js";
import { CustomContainerBuilder, SimpleContainerBuilder } from "./utils/CustomContainerBuilder.js";
import { EmoteString } from "./utils/emotes.js";

// Create Discord Client
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates
	]
});

process.on("unhandledRejection", (reason) => {
	console.error("Unhandled Rejection at Promise", reason);
});

process.on("uncaughtException", (err) => {
	console.error("Uncaught Exception thrown", err);
});

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

// Load environmental variables
dotenv.config();

// Store commands
const commands = new Collection<string, Command>();
commands.set(playCommand.data.name, playCommand);
commands.set(pauseCommand.data.name, pauseCommand);
commands.set(nextCommand.data.name, nextCommand);
commands.set(leaveCommand.data.name, leaveCommand);
commands.set(queueCommand.data.name, queueCommand);
commands.set(nowplayingCommand.data.name, nowplayingCommand);
commands.set(removeCommand.data.name, removeCommand);

// Startup message
client.once(Events.ClientReady, () => {
	console.log(`[Bot] Logged in as ${client.user?.tag}!`);
});

// Handle Interactions
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

	// 2. Dropdown select menu handler (for text search results)
	if (interaction.isStringSelectMenu()) {
		if (interaction.customId === "play_search_select") {
			const member = interaction.member as GuildMember;
			if (!member.voice.channel) {
				const container = new SimpleContainerBuilder(`${EmoteString.Error} You must be in a voice channel to play music.`);

				await replyWithContainer(interaction, container, true);
				return;
			}

			const player = getPlayer(interaction.guildId!);
			const botVoiceChannel = interaction.guild?.members.me?.voice.channel;

			if (botVoiceChannel && botVoiceChannel.id !== member.voice.channel.id) {
				const container = new SimpleContainerBuilder(`${EmoteString.Error} You must be in the same voice channel as the bot to play music.`);

				await replyWithContainer(interaction, container, true);
				return;
			}

			await deferReply(interaction);

			try {
				const selectedUrl = interaction.values[0];

				if (!botVoiceChannel) {
					player.Connect(member.voice.channel);
					player.SetTextChannel(interaction.channel as TextBasedChannel);
				}

				const tracks = await resolveUrl(selectedUrl, interaction.user.id);
				await player.Add(tracks);

				const container = new SimpleContainerBuilder(`${EmoteString.Check} Added **${tracks[0].title}** to the queue.`);

				// Edit original message to remove select menu so it cannot be re-triggered
				await interaction.message.edit({
					components: []
				}).catch(() => undefined);

				await replyWithContainer(interaction, container);
			}
			catch (err: unknown) {
				const error = err as Error;
				console.error("[SelectMenu] Error playing selection:", error);
				const container = new SimpleContainerBuilder(`${EmoteString.Error} An error occurred executing this command: ${error.message}`);

				await replyWithContainer(interaction, container, true);
			}
		}
	}
});

// Log bot in
if (process.env.DISCORD_TOKEN) {
	client.login(process.env.DISCORD_TOKEN).catch((err: unknown) => {
		const error = err as Error;
		console.error("[Bot] Failed to log in. Please check your DISCORD_TOKEN in .env:", error.message);
	});
}
else {
	console.error("[Bot] Error: DISCORD_TOKEN is missing in the environmental variables (.env).");
}
