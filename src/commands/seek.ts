import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { CommandContext } from "../utils/commandContext.js";

export const seekCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("seek")
		.setDescription("Jump to a specific timestamp in the current song")
		.addStringOption(option => option
			.setName("time")
			.setDescription("The timestamp to jump to (e.g. 1:30 or 90 for seconds)")
			.setRequired(true)
		),

	async execute(interaction) {
		const timeInput = interaction.options.getString("time", true);
		await handleSeek(new CommandContext(interaction), timeInput);
	},

	async executePrefix(message, args) {
		const ctx = new CommandContext(message);
		const timeInput = args.join(" ");

		if (!timeInput) {
			const container = new SimpleContainerBuilder(
				`${EmoteString.Warning} Please provide a timestamp. Example: \`q!seek 1:30\``
			);
			await ctx.reply(container);
			return;
		}

		await handleSeek(ctx, timeInput);
	}
};

function parseTimestamp(input: string): number | null {
	const trimmed = input.trim();

	// Format: mm:ss or m:ss
	const matchMS = /^(\d+)\s*:\s*(\d+)$/.exec(trimmed);
	if (matchMS) {
		const minutes = parseInt(matchMS[1], 10);
		const seconds = parseInt(matchMS[2], 10);
		if (seconds >= 60) return null;
		return minutes * 60 + seconds;
	}

	// Format: hh:mm:ss or h:mm:ss
	const matchHMS = /^(\d+)\s*:\s*(\d+)\s*:\s*(\d+)$/.exec(trimmed);
	if (matchHMS) {
		const hours = parseInt(matchHMS[1], 10);
		const minutes = parseInt(matchHMS[2], 10);
		const seconds = parseInt(matchHMS[3], 10);
		if (minutes >= 60 || seconds >= 60) return null;
		return hours * 3600 + minutes * 60 + seconds;
	}

	// Format: raw seconds
	if (/^\d+$/.test(trimmed)) {
		return parseInt(trimmed, 10);
	}

	return null;
}

async function handleSeek(ctx: CommandContext, timeInput: string) {
	if (!await ctx.checkVoice(true)) return;

	const queue = ctx.client.distube.getQueue(ctx.guildId);
	if (!queue || !queue.songs || queue.songs.length === 0) {
		const container = new SimpleContainerBuilder(`${EmoteString.Info} **Nothing is currently playing.**`);
		await ctx.reply(container);
		return;
	}

	const seconds = parseTimestamp(timeInput);
	if (seconds === null || seconds < 0) {
		const container = new SimpleContainerBuilder(
			`${EmoteString.Warning} **Invalid time format.** Use \`minutes:seconds\` (e.g., \`1:30\`) or raw seconds (e.g., \`90\`).`
		);
		await ctx.reply(container);
		return;
	}

	const currentSong = queue.songs[0];
	if (seconds > currentSong.duration) {
		const container = new SimpleContainerBuilder(
			`${EmoteString.Warning} **Invalid time:** \`${timeInput}\` exceeds the song duration of ${currentSong.formattedDuration}.`
		);
		await ctx.reply(container);
		return;
	}

	await queue.seek(seconds);
	const container = new SimpleContainerBuilder(
		`${EmoteString.Skip} **Jumped to \`${timeInput}\` in the current song.**`
	);
	await ctx.reply(container);
}

export default seekCommand;
