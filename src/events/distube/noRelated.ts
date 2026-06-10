import { Events, type Queue } from "distube";
import { SimpleContainerBuilder } from "../../utils/CustomContainerBuilder.js";
import { sendMessageInTextChannel } from "../../utils/discordInteractions.js";
import { EmoteString } from "../../utils/emotes.js";
import { Log } from "../../utils/log.js";

export default {
	name: Events.NO_RELATED,
	once: false,
	async execute(queue: Queue) {
		Log.Info(`[DisTube] No related songs found in guild ${queue.id}`);

		const container = new SimpleContainerBuilder(
			`${EmoteString.Warning} **Autoplay:** Could not find any related songs to play next.`
		);

		await sendMessageInTextChannel(queue.textChannel!, container);
	}
};
