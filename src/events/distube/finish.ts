import { Events, type Queue } from "distube";
import { SimpleContainerBuilder } from "../../utils/CustomContainerBuilder.js";
import { sendMessageInTextChannel } from "../../utils/discordInteractions.js";
import { EmoteString } from "../../utils/emotes.js";
import { Log } from "../../utils/log.js";

export default {
	name: Events.FINISH,
	once: false,
	async execute(queue: Queue) {
		Log.Info(`[DisTube] Queue finished in guild ${queue.id}`);

		const container = new SimpleContainerBuilder(
			`${EmoteString.Megaphone} **Queue finished.** Add more songs with \`/play\`!`
		);

		await sendMessageInTextChannel(queue.textChannel!, container);

		// Clear voice channel status
		const voiceChannel = queue.voiceChannel;
		if (voiceChannel) {
			try {
				await queue.distube.client.rest.put(`/channels/${voiceChannel.id}/voice-status`, {
					body: { status: "" }
				});
			}
			catch (err: unknown) {
				Log.Error("[DisTube] Failed to clear voice channel status: " + (err instanceof Error ? err.message : ""));
			}
		}
	}
};
