import { Events, type Queue, type Song } from "distube";
import { SimpleContainerBuilder } from "../../utils/CustomContainerBuilder.js";
import { sendMessageInTextChannel } from "../../utils/discordInteractions.js";
import { EmoteString } from "../../utils/emotes.js";
import { Log } from "../../utils/log.js";

export default {
	name: Events.ADD_SONG,
	once: false,
	async execute(queue: Queue, song: Song) {
		Log.Success(`[DisTube] Added to queue: "${song.name}" in guild ${queue.id}`);

		const container = new SimpleContainerBuilder(
			`${EmoteString.Add} Added **[${song.name}](${song.url})** to the queue.`
		);

		await sendMessageInTextChannel(queue.textChannel, container);
	}
};
