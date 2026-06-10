import dotenv from "dotenv";
dotenv.config();

import { REST, Routes } from "discord.js";

// Import commands
import playCommand from "./commands/play.js";
import pauseCommand from "./commands/pause.js";
import nextCommand from "./commands/next.js";
import leaveCommand from "./commands/leave.js";
import queueCommand from "./commands/queue.js";
import nowplayingCommand from "./commands/nowplaying.js";
import removeCommand from "./commands/remove.js";
import helpCommand from "./commands/help.js";
import shuffleCommand from "./commands/shuffle.js";
import repeatCommand from "./commands/repeat.js";


const commands = [
	playCommand.data.toJSON(),
	pauseCommand.data.toJSON(),
	nextCommand.data.toJSON(),
	leaveCommand.data.toJSON(),
	queueCommand.data.toJSON(),
	nowplayingCommand.data.toJSON(),
	removeCommand.data.toJSON(),
	helpCommand.data.toJSON(),
	shuffleCommand.data.toJSON(),
	repeatCommand.data.toJSON(),
];

async function deploy() {
	const token = process.env.DISCORD_TOKEN;
	const clientId = process.env.DISCORD_CLIENT_ID;
	const guildId = process.env.DISCORD_GUILD_ID;

	if (!token) {
		console.error("[Deploy] Error: DISCORD_TOKEN is missing in the .env file.");
		return;
	}
	if (!clientId) {
		console.error("[Deploy] Error: DISCORD_CLIENT_ID is missing in the .env file.");
		return;
	}

	console.log("[Deploy] Starting command registration...");
	const rest = new REST({ version: "10" }).setToken(token);

	try {
		if (guildId) {
			console.log(`[Deploy] Registering commands locally to guild ${guildId}...`);
			await rest.put(
				Routes.applicationGuildCommands(clientId, guildId),
				{ body: commands }
			);
			console.log("[Deploy] Guild-specific commands registered successfully.");
		}
		else {
			console.log("[Deploy] Registering commands globally (this can take up to an hour to propagate)...");
			await rest.put(
				Routes.applicationCommands(clientId),
				{ body: commands }
			);
			console.log("[Deploy] Global commands registered successfully.");
		}
	}
	catch (err) {
		console.error("[Deploy] Error deploying commands:", err);
	}
}

deploy();
