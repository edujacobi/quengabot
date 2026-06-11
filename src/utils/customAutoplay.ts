import { Queue, Song, DisTubeError } from "distube";
import yts from "yt-search";
import { Log } from "./log.js";
import { type CustomYtDlpPlugin } from "./CustomYtDlpPlugin.js";

export function setupCustomAutoplay(customYtDlpPlugin: CustomYtDlpPlugin) {
	// @ts-ignore - Override private/internal method
	const originalAddRelatedSong = Queue.prototype._addRelatedSong;

	// @ts-ignore - Override private/internal method
	Queue.prototype._addRelatedSong = async function (this: Queue, song?: Song): Promise<Song> {
		try {
			const current = song || this.songs[0] || this.previousSongs[this.previousSongs.length - 1];
			if (!current) {
				throw new DisTubeError("NO_RELATED");
			}

			// Clean the artist name from the uploader/channel name
			const uploaderName = current.uploader?.name || "";
			const artistName = uploaderName
				.replace(/\s*-\s*Topic/i, "")
				.replace(/\s*VEVO/i, "")
				.replace(/\s*Official/i, "")
				.replace(/\s*Music/i, "")
				.trim();

			let genres: string[] = [];
			const clientId = process.env.SPOTIFY_CLIENT_ID;
			const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

			if (clientId && clientSecret && artistName) {
				try {
					Log.Info(`[Autoplay] Fetching Spotify genres for artist: "${artistName}"`);
					const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
						method: "POST",
						headers: {
							"Content-Type": "application/x-www-form-urlencoded",
							Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
						},
						body: "grant_type=client_credentials"
					});
					if (tokenResponse.ok) {
						const tokenData = await tokenResponse.json() as { access_token: string };
						const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`;
						const searchResponse = await fetch(searchUrl, {
							headers: {
								Authorization: `Bearer ${tokenData.access_token}`
							}
						});
						if (searchResponse.ok) {
							const searchData = await searchResponse.json() as any;
							genres = searchData.artists?.items[0]?.genres || [];
							Log.Info(`[Autoplay] Spotify genres found for "${artistName}": [${genres.join(", ")}]`);
						}
					}
				} catch (err) {
					Log.Error("[Autoplay] Error fetching genres from Spotify: " + (err instanceof Error ? err.message : ""));
				}
			}

			// genres query, fall back to artistName if no genres are found
			const genresQuery = genres.length > 0 ? genres.slice(0, 3).join(" ") : artistName;

			// Clean current title to remove special search query punctuation
			const cleanTitle = (current.name || "").replace(/["()]/g, "").trim();
			const searchQuery = `"${genresQuery}" -"${cleanTitle}"`;

			Log.Info(`[Autoplay] Custom autoplay searching YouTube for: "${searchQuery}"`);
			const results = await yts(searchQuery);
			if (!results || !results.videos || results.videos.length === 0) {
				Log.Warning(`[Autoplay] No custom autoplay search results found for query: "${searchQuery}". Falling back to original autoplay.`);
				return await originalAddRelatedSong.call(this, song);
			}

			// Filter out YouTube Shorts / short teasers (typically < 60 seconds) if possible.
			const video = results.videos.find(v => v.seconds >= 60) || results.videos[0];
			Log.Info(`[Autoplay] Selected recommendation: "${video.title}" (${video.timestamp})`);

			// @ts-ignore - DisTube Song constructor takes song info and resolve options
			const nextSong = new Song({
				plugin: customYtDlpPlugin,
				source: "youtube",
				playFromSource: true,
				id: video.videoId,
				name: video.title,
				url: video.url,
				thumbnail: video.thumbnail,
				duration: video.seconds,
				uploader: {
					name: video.author?.name,
					url: video.author?.url
				}
			}, { member: this.clientMember });

			nextSong.metadata = current.metadata;
			nextSong.member = this.clientMember;
			this.addToQueue(nextSong);
			return nextSong;
		} catch (error) {
			Log.Error("[Autoplay] Custom autoplay failed, falling back to original: " + (error instanceof Error ? error.message : ""));
			return await originalAddRelatedSong.call(this, song);
		}
	};
}
