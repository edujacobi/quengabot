import { Events, type Queue } from "distube";

export default {
	name: Events.DISCONNECT,
	once: false,
	async execute(queue: Queue) {
		console.log(`[DisTube] Disconnected from voice in guild ${queue.id}`);

		// Clear voice channel status
		const voiceChannel = queue.voiceChannel;
		if (voiceChannel) {
			try {
				await queue.distube.client.rest.put(`/channels/${voiceChannel.id}/voice-status`, {
					body: { status: "" }
				});
			}
			catch (err: unknown) {
				console.error("[DisTube] Failed to clear voice channel status:", err);
			}
		}
	}
};
