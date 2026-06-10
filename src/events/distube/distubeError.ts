import { Events, type Queue } from "distube";
import { SimpleContainerBuilder } from "../../utils/CustomContainerBuilder.js";
import { sendMessageInTextChannel } from "../../utils/discordInteractions.js";
import { EmoteString } from "../../utils/emotes.js";
import { Log } from "../../utils/log.js";

export default {
	name: Events.ERROR,
	once: false,
	async execute(error: Error, queue?: Queue) {
		Log.Error(`[DisTube] Error in guild ${queue?.id || "unknown"}: ` + error.message);

		const container = new SimpleContainerBuilder(
			`${EmoteString.Error} **Playback error:** ${error.message}`
		);

		if (!queue) return;

		await sendMessageInTextChannel(queue.textChannel, container);
	}
};
