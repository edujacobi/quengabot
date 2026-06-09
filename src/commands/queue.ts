import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder
} from "discord.js";
import { getPlayer } from "../music/player.js";
import { formatDuration } from "../music/resolver.js";
import { type Command } from "../types.js";
import { CustomContainerBuilder, SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { replyWithContainer } from "../utils/discordInteractions.js";
import { EmoteString } from "../utils/emotes.js";

export const queueCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("queue")
		.setDescription("Display the current music queue"),

	async execute(interaction: ChatInputCommandInteraction) {
		const player = getPlayer(interaction.guildId!);
		const current = player.GetCurrentTrack();
		const queue = player.GetQueue();

		if (!current && queue.length === 0) {
			const container = new SimpleContainerBuilder(`${EmoteString.Queue} **The queue is empty. Use \`/play\` to add songs!**`);

			await replyWithContainer(interaction, container);
			return;
		}

		const container = new CustomContainerBuilder()
			.addTexts([
				`### ${EmoteString.Queue} Music Queue`
			])
			.addLargeSeparator();

		// 1. Add currently playing section (with thumbnail)
		if (current) {
			container
				.addTexts([
					`> -# ${EmoteString.NowPlaying} **Now Playing**`,
					`> ### [${current.title}](${current.url})`,
					`> ${current.artist}`,
					`> -# \`${current.durationString}\``
				])
				.addLargeSeparator();
		}

		// 2. Add upcoming queue list section
		const totalDurationSec = queue.reduce((acc, t) => acc + t.duration, 0) + (current ? current.duration : 0);
		const totalDurationStr = formatDuration(totalDurationSec);

		if (queue.length === 0) {
			container.addTexts(["*No upcoming tracks in the queue.*"]);
		}
		else {
			const PAGE_LIMIT = Math.min(15, queue.length);

			for (let i = 0; i < PAGE_LIMIT; i++) {
				const track = queue[i];
				container
					.addTexts([
						`\`${i + 1}.\` **[${track.title}](${track.url})** by ${track.artist} \`${track.durationString}\``,
					]);

				const shouldSeparate = i < PAGE_LIMIT - 1 && i < queue.length - 1;

				if (shouldSeparate) {
					container.addSmallSeparator();
				}
			}

			if (queue.length > PAGE_LIMIT) {
				container
					.addSmallSeparator()
					.addTexts([`and ${queue.length - PAGE_LIMIT} more tracks`]);
			}
		}

		container
			.addLargeSeparator()
			.addTexts([
				`-# **Total Tracks:** ${queue.length + (current ? 1 : 0)} | **Total Queue Duration:** ${totalDurationStr}`
			]);

		await replyWithContainer(interaction, container);
	}
};
export default queueCommand;
