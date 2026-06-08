import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder
} from "discord.js";
import { getPlayer } from "../music/player.js";
import { formatDuration } from "../music/resolver.js";
import { type Command } from "../types.js";
import { CustomContainerBuilder, CustomSectionBuilder, SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { replyWithContainer } from "../utils/discordInteractions.js";
import { EmoteString } from "../utils/emotes.js";
import { ImageUrls } from "../utils/imageUrls.js";

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

		const container = new CustomContainerBuilder();

		// 1. Add currently playing section (with thumbnail)
		if (current) {
			const currentSection = new CustomSectionBuilder()
				.addTexts([
					`### ${EmoteString.NowPlaying} Currently Playing:`,
					`**${current.title}** by *${current.artist}* (${current.durationString})`,
					`Requested by: <@${current.requestedBy}>`
				])
				.setThumbnailAccessory(thumb => thumb
					.setURL(current.thumbnailUrl || ImageUrls.NoThumbnail)
				);

			container.addSectionComponents(currentSection);
		}

		// 2. Add upcoming queue list section
		const totalDurationSec = queue.reduce((acc, t) => acc + t.duration, 0) + (current ? current.duration : 0);
		const totalDurationStr = formatDuration(totalDurationSec);

		let upcomingContent = `${EmoteString.Queue} **Upcoming Tracks:**\n`;
		if (queue.length === 0) {
			upcomingContent += "\n*No upcoming tracks in the queue.*";
		}
		else {
			const queueList = queue
				.map((track, i) => `${i + 1}. **${track.title.substring(0, 70)}** - *${track.artist.substring(0, 40)}* (${track.durationString}) [Requested by: <@${track.requestedBy}>]`)
				.slice(0, 10)
				.join("\n");
			upcomingContent += `\n${queueList}`;

			if (queue.length > 10) {
				upcomingContent += `\n\n*... and ${queue.length - 10} more tracks*`;
			}
		}

		upcomingContent += `\n\n**Total Tracks:** ${queue.length + (current ? 1 : 0)} | **Total Queue Duration:** ${totalDurationStr}`;

		const upcomingSection = new CustomSectionBuilder()
			.addTexts([upcomingContent]);

		container.addSectionComponents(upcomingSection);

		await replyWithContainer(interaction, container);
	}
};
export default queueCommand;
