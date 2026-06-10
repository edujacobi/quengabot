import { Events, type Playlist, type Queue } from "distube";
import { SimpleContainerBuilder } from "../../utils/CustomContainerBuilder.js";
import { sendMessageInTextChannel } from "../../utils/discordInteractions.js";
import { EmoteString } from "../../utils/emotes.js";

export default {
	name: Events.ADD_LIST,
	once: false,
	async execute(queue: Queue, playlist: Playlist) {
		console.log(`[DisTube] Added playlist: "${playlist.name}" (${playlist.songs.length} songs) in guild ${queue.id}`);

		const container = new SimpleContainerBuilder(
			`${EmoteString.Add} Added playlist **${playlist.name}** with **${playlist.songs.length}** songs to the queue.`
		);

		await sendMessageInTextChannel(queue.textChannel!, container);
	}
};
