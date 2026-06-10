import { Events, type Queue } from "distube";
import { Log } from "../../utils/log.js";

export default {
	name: Events.DISCONNECT,
	once: false,
	async execute(queue: Queue) {
		Log.Success(`[DisTube] Disconnected from voice in guild ${queue.id}`);

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
