import dotenv from "dotenv";
dotenv.config();

import { REST, Routes } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type Command } from "./types.js";
import { Log } from "./utils/log.js";

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
				let command = commandModule.default || commandModule;

				if (command && !("data" in command) && command.default && "data" in command.default) {
					command = command.default;
				}

				if (command && "data" in command && "execute" in command) {
					commands.push(command.data.toJSON());
					Log.Info(`[Deploy] Command ${file} loaded successfully.`);
				}
				else {
					Log.Warning(`[Deploy] The command at ${filePath} is missing a required "data" or "execute" property.`);
				}
			}
			catch (err) {
				Log.Error(`[Deploy] Error loading command ${file}: ` + (err instanceof Error ? err.message : ""));
			}
		}
	}
}

async function deploy() {
	const token = process.env.DISCORD_TOKEN;
	const clientId = process.env.DISCORD_CLIENT_ID;
	const guildId = process.env.DISCORD_GUILD_ID;

	if (!token) {
		Log.Error("[Deploy] Error: DISCORD_TOKEN is missing in the .env file.");
		return;
	}
	if (!clientId) {
		Log.Error("[Deploy] Error: DISCORD_CLIENT_ID is missing in the .env file.");
		return;
	}

	Log.Info("[Deploy] Loading commands...");
	await loadCommands(commandsPath);
	Log.Info(`[Deploy] Loaded ${commands.length} commands for registration.`);

	Log.Info("[Deploy] Starting command registration...");
	const rest = new REST({ version: "10" }).setToken(token);

	try {
		if (guildId) {
			Log.Info(`[Deploy] Registering commands locally to guild ${guildId}...`);
			await rest.put(
				Routes.applicationGuildCommands(clientId, guildId),
				{ body: commands }
			);
			Log.Info("[Deploy] Guild-specific commands registered successfully.");
		}
		else {
			Log.Info("[Deploy] Registering commands globally (this can take up to an hour to propagate)...");
			await rest.put(
				Routes.applicationCommands(clientId),
				{ body: commands }
			);
			Log.Info("[Deploy] Global commands registered successfully.");
		}
	}
	catch (err) {
		Log.Error("[Deploy] Error deploying commands: " + (err instanceof Error ? err.message : ""));
	}
}

deploy();

