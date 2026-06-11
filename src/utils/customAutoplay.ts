import { Queue, Song, DisTubeError } from "distube";
import yts from "yt-search";
import { Log } from "./log.js";
import { type CustomYtDlpPlugin } from "./CustomYtDlpPlugin.js";

export function setupCustomAutoplay(customYtDlpPlugin: CustomYtDlpPlugin) {
	const originalAddRelatedSong = Queue.prototype._addRelatedSong;

	Queue.prototype._addRelatedSong = async function addRelatedSong(this: Queue, song?: Song): Promise<Song> {
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

					if (!tokenResponse.ok) {
						Log.Warning(`[Autoplay] Error fetching token from Spotify: ${tokenResponse.statusText}`);

					}
					else {
						const tokenData = await tokenResponse.json() as { access_token: string };
						const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`;
						const searchResponse = await fetch(searchUrl, {
							headers: {
								Authorization: `Bearer ${tokenData.access_token}`
							}
						});

						if (!searchResponse.ok) {
							if (searchResponse.status === 403) {
								Log.Warning(`[Autoplay] Error fetching genres from Spotify: 403 Forbidden (Spotify API now requires an active Premium subscription for developer accounts)`);
							}
							else {
								Log.Warning(`[Autoplay] Error fetching genres from Spotify: ${searchResponse.statusText}`);
							}
						}
						else {
							const searchData = await searchResponse.json() as { artists: { items: { genres: string[] }[] } };
							genres = searchData.artists?.items[0]?.genres || [];
							Log.Info(`[Autoplay] Spotify genres found for "${artistName}": [${genres.join(", ")}]`);
						}
					}
				}
				catch (err) {
					Log.Error("[Autoplay] Error fetching genres from Spotify: " + (err instanceof Error ? err.message : ""));
				}
			}

			if (genres.length === 0 && artistName) {
				try {
					const songTitle = extractSongTitle(current.name || "", artistName);
					const searchTerm = songTitle ? `${artistName} ${songTitle}` : artistName;
					const entity = songTitle ? "song" : "musicArtist";

					Log.Info(`[Autoplay] Fetching iTunes genres for song: "${searchTerm}"`);
					let url = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=${entity}&limit=1`;
					let response = await fetch(url);

					if (response.ok) {
						let data = await response.json() as { results: { primaryGenreName?: string }[] };

						// If we searched for a song and got no results, try falling back to searching the artist directly
						if ((!data.results || data.results.length === 0) && entity === "song") {
							Log.Info(`[Autoplay] Song not found on iTunes, falling back to artist search for: "${artistName}"`);
							url = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=1`;
							response = await fetch(url);
							if (response.ok) {
								data = await response.json() as { results: { primaryGenreName?: string }[] };
							}
						}

						if (data.results && data.results[0] && data.results[0].primaryGenreName) {
							genres = [data.results[0].primaryGenreName];
							Log.Info(`[Autoplay] iTunes genre found: [${genres.join(", ")}]`);
						}
					}
					else {
						Log.Warning(`[Autoplay] Error fetching genres from iTunes: ${response.statusText}`);
					}
				}
				catch (err) {
					Log.Error("[Autoplay] Error fetching genres from iTunes: " + (err instanceof Error ? err.message : ""));
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

			const currentCore = extractSongTitle(current.name || "", artistName);

			// Filter results: skip shorts and videos that play the same song
			const filteredVideos = results.videos.filter(v => {
				if (v.seconds < 60) return false; // Skip Shorts
				const candidateCore = extractSongTitle(v.title, artistName);
				const isSameSong = candidateCore.includes(currentCore) || currentCore.includes(candidateCore);
				return !isSameSong;
			});

			const video = filteredVideos[0] || results.videos.find(v => v.seconds >= 60) || results.videos[0];
			Log.Info(`[Autoplay] Selected recommendation: "${video.title}" (${video.timestamp})`);

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
		}
		catch (error) {
			Log.Error("[Autoplay] Custom autoplay failed, falling back to original: " + (error instanceof Error ? error.message : ""));
			return await originalAddRelatedSong.call(this, song);
		}
	};
}

function extractSongTitle(videoTitle: string, artistName: string): string {
	let title = videoTitle;
	if (artistName) {
		const escapedArtist = artistName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
		const artistRegex = new RegExp(escapedArtist, "gi");
		title = title.replace(artistRegex, "");
	}
	// Remove common video/audio suffixes and bracketed info
	title = title.replace(/[([][^)\]]*(official|video|music|lyric|audio|live|hd|hq|visualizer|remastered|cover|screen|fallon)[^)\]]*[)\]]/gi, "");
	// Remove extra symbols
	title = title.replace(/[-|:|•\n]/g, " ");
	return title.replace(/\s+/g, " ").trim().toLowerCase();
}
