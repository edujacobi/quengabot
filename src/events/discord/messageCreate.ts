import { Events, type Message } from "discord.js";
import { SimpleContainerBuilder } from "../../utils/CustomContainerBuilder.js";
import { replyMessageWithContainer } from "../../utils/discordInteractions.js";
import { EmoteString } from "../../utils/emotes.js";
import { Log } from "../../utils/log.js";

export default {
	name: Events.MessageCreate,
	once: false,
	async execute(message: Message) {
		// Ignore messages from bots or outside guilds
		if (message.author.bot || !message.guild) return;

		const prefix = "q!";
		if (!message.content.startsWith(prefix)) return;

		// Split message content into command and args
		const args = message.content.slice(prefix.length).trim().split(/ +/);
		const commandName = args.shift()?.toLowerCase();

		if (!commandName) return;

		// Find command by name or alias
		const command = message.client.commands.get(commandName) || message.client.commands.find(cmd => cmd.aliases?.includes(commandName));

		if (!command) return;

		try {
			if (command.executePrefix) {
				await command.executePrefix(message, args);
			}
			else {
				const container = new SimpleContainerBuilder(`${EmoteString.Error} This command cannot be run via prefix.`);
				await replyMessageWithContainer(message, container);
			}
		}
		catch (err: unknown) {
			Log.Error(`[Prefix] Error executing command ${commandName}: ` + (err instanceof Error ? err.message : ""));

			const container = new SimpleContainerBuilder(`${EmoteString.Error} An error occurred: ${(err as Error).message}`);
			await replyMessageWithContainer(message, container);
		}
	}
};
