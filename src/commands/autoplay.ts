import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { CommandContext } from "../utils/commandContext.js";
import { Log } from "../utils/log.js";

export const autoplayCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("autoplay")
		.setDescription("Toggle autoplay to automatically play related songs when the queue ends"),

	aliases: ["ap"],

	async execute(interaction) {
		await handleAutoplay(new CommandContext(interaction));
	},

	async executePrefix(message) {
		await handleAutoplay(new CommandContext(message));
	}
};

async function handleAutoplay(ctx: CommandContext) {
	if (!await ctx.checkVoice(true)) return;

	const queue = ctx.client.distube.getQueue(ctx.guildId);
	if (!queue) {
		const container = new SimpleContainerBuilder(`${EmoteString.Info} **Nothing is currently playing.**`);
		await ctx.reply(container);
		return;
	}

	const autoplayState = queue.toggleAutoplay();
	const status = autoplayState ? "enabled" : "disabled";

	Log.Info(`[Autoplay] Autoplay is now ${status} for ${queue.textChannel?.guild.name}`);

	const container = new SimpleContainerBuilder(
		`${EmoteString.Megaphone} **Autoplay is now ${status}.**`
	);
	await ctx.reply(container);
}

export default autoplayCommand;
