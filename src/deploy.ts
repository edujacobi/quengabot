import dotenv from "dotenv";
dotenv.config();

import { REST, Routes } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type Command } from "./types.js";

const commands: unknown[] = [];
const commandsPath = path.join(__dirname, "commands");

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
					commands.push(command.data.toJSON());
					console.log(`[Deploy] Command ${file} loaded successfully.`);
				}
				else {
					console.warn(`[Deploy] The command at ${filePath} is missing a required "data" or "execute" property.`);
				}
			}
			catch (err) {
				console.error(`[Deploy] Error loading command ${file}:`, err);
			}
		}
	}
}

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

	console.log("[Deploy] Loading commands...");
	await loadCommands(commandsPath);
	console.log(`[Deploy] Loaded ${commands.length} commands for registration.`);

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

