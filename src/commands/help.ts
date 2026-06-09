import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { CommandContext } from "../utils/commandContext.js";
import { CustomContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";

export const helpCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("help")
		.setDescription("Show the list of available commands and descriptions"),

	async execute(interaction) {
		await handleHelp(new CommandContext(interaction));
	},

	async executePrefix(message) {
		await handleHelp(new CommandContext(message));
	}
};

async function handleHelp(ctx: CommandContext) {
	const container = new CustomContainerBuilder()
		.addTexts([`### ${EmoteString.Info} **Available Commands**`])
		.addLargeSeparator();

	const commands = ctx.client.commands;

	commands.forEach((command) => {
		const name = command.data.name;
		const description = command.data.description || "No description provided.";
		const aliasStr = command.aliases && command.aliases.length > 0
			? ` (aliases: ${command.aliases.map(a => `\`q!${a}\``).join(", ")})`
			: "";

		container.addTexts([
			`**/${name}** or **q!${name}**${aliasStr}`,
			description
		]).addSmallSeparator();
	});

	// Remove the trailing separator
	if (container.components.length > 2) {
		container.components.pop();
	}

	await ctx.reply(container);
}

export default helpCommand;
