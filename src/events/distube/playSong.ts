import { Events, type Queue, type Song } from "distube";
import { SimpleContainerBuilder } from "../../utils/CustomContainerBuilder.js";
import { sendMessageInTextChannel } from "../../utils/discordInteractions.js";
import { EmoteString } from "../../utils/emotes.js";
import { Log } from "../../utils/log.js";

export default {
	name: Events.PLAY_SONG,
	once: false,
	async execute(queue: Queue, song: Song) {
		// If the song was resolved from an alternative YouTube source, copy the metadata over
		// so that the Title, Artist, Url, and Thumbnail match the YouTube version.
		if (!song.stream.playFromSource && song.stream.song) {
			const altSong = song.stream.song;
			song.name = altSong.name;
			song.url = altSong.url;
			song.thumbnail = altSong.thumbnail;
			song.uploader = altSong.uploader;
			song.duration = altSong.duration;
			song.formattedDuration = altSong.formattedDuration;
		}

		(queue as any).lastSongStart = Date.now();
		(queue as any).manualSkip = false;

		Log.Info(`[DisTube] Now playing: "${song.name}" by ${song.uploader?.name || "Unknown"} in guild ${queue.id}`);

		const container = new SimpleContainerBuilder(
			`${EmoteString.NowPlaying} **Now playing:** **[${song.name}](${song.url})** by ${song.uploader?.name || "Unknown"}\n-# requested by ${song.user?.username || "Unknown"}`
		);

		await sendMessageInTextChannel(queue.textChannel, container);

		// Update voice channel status
		const voiceChannel = queue.voiceChannel;
		if (voiceChannel) {
			try {
				await queue.distube.client.rest.put(`/channels/${voiceChannel.id}/voice-status`, {
					body: { status: `${EmoteString.NowPlaying} ${song.name}`.substring(0, 500) }
				});
			}
			catch (err: unknown) {
				Log.Error("[DisTube] Failed to set voice channel status: " + (err instanceof Error ? err.message : ""));
			}
		}
	}
};
