import { ExtractorPlugin, Song, type Playlist, type ResolveOptions, type Awaitable } from "distube";
import yts from "yt-search";
import { type CustomYtDlpPlugin } from "./CustomYtDlpPlugin.js";
import { Log } from "./log.js";

export class YouTubeSearchPlugin extends ExtractorPlugin {
	private customYtDlp: CustomYtDlpPlugin;

	constructor(customYtDlp: CustomYtDlpPlugin) {
		super();
		this.customYtDlp = customYtDlp;
	}

	// Never validate any URL so this plugin is never used to resolve/play URLs directly.
	// It is only used when DisTube calls #searchSong internally for search queries.
	override validate(_url: string): boolean {
		return false;
	}

	// Abstract method implementation. This will never be called since validate always returns false.
	override resolve<T>(_url: string, _options: ResolveOptions<T>): Promise<Song<T> | Playlist<T>> {
		throw new Error("YouTubeSearchPlugin.resolve should not be called.");
	}

	// Implement searchSong using yt-search.
	override async searchSong<T>(query: string, options: ResolveOptions<T>): Promise<Song<T> | null> {
		try {
			Log.Info(`[YouTubeSearchPlugin] Searching YouTube for: "${query}"`);
			const results = await yts(query);
			if (!results || !results.videos || results.videos.length === 0) {
				Log.Warning(`[YouTubeSearchPlugin] No search results found for query: "${query}"`);
				return null;
			}

			// Filter out YouTube Shorts / short teasers (typically < 60 seconds) if possible.
			// If all matching videos are short, default back to the first result.
			const video = results.videos.find(v => v.seconds >= 60) || results.videos[0];
			Log.Info(`[YouTubeSearchPlugin] Selected video: "${video.title}" (${video.timestamp})`);

			return new Song({
				plugin: this.customYtDlp, // Associate with CustomYtDlpPlugin so it plays using yt-dlp
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
			}, options);
		}
		catch (err: unknown) {
			Log.Error("[YouTubeSearchPlugin] Error during search: " + (err instanceof Error ? err.message : ""));
			return null;
		}
	}

	override getStreamURL<T>(song: Song<T>): Awaitable<string> {
		return this.customYtDlp.getStreamURL(song);
	}

	override getRelatedSongs(_song: Song<any>): Awaitable<Song<any>[]> {
		return [];
	}
}
