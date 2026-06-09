import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { CommandContext } from "../utils/commandContext.js";

export const removeCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("remove")
		.setDescription("Remove a song from the queue by its index number")
		.addIntegerOption(option => option
			.setName("index")
			.setDescription("The number of the song in the queue (from /queue)")
			.setRequired(true)
			.setMinValue(1)
		),

	aliases: ["rem", "r"],

	async execute(interaction) {
		const indexInput = interaction.options.getInteger("index", true);
		await handleRemove(new CommandContext(interaction), indexInput);
	},

	async executePrefix(message, args) {
		const indexInputStr = args[0];
		const indexInput = indexInputStr ? parseInt(indexInputStr, 10) : NaN;
		const ctx = new CommandContext(message);

		if (isNaN(indexInput) || indexInput < 1) {
			const container = new SimpleContainerBuilder(
				`${EmoteString.Error} Please provide a valid index number from the queue (e.g. \`q!remove 1\`).`
			);

			await ctx.reply(container);
			return;
		}

		await handleRemove(ctx, indexInput);
	}
};

async function handleRemove(ctx: CommandContext, songIndex: number) {
	if (!await ctx.checkVoice(true)) return;

	const queue = ctx.client.distube.getQueue(ctx.guildId);
	if (!queue) {
		const container = new SimpleContainerBuilder(`${EmoteString.Info} **The queue is empty.**`);
		await ctx.reply(container);
		return;
	}

	const song = queue.songs[songIndex];
	if (!song) {
		const container = new SimpleContainerBuilder(
			`${EmoteString.Error} Invalid index. Please check the current queue using \`${ctx.isInteraction ? "/queue" : "q!queue"}\`.`
		);
		await ctx.reply(container);
		return;
	}

	queue.songs.splice(songIndex, 1);

	const container = new SimpleContainerBuilder(
		`${EmoteString.Add} Removed **${song.name}** by *${song.uploader?.name || "Unknown"}* from the queue.`
	);
	await ctx.reply(container);
}

export default removeCommand;
