import { YtDlpPlugin } from "@distube/yt-dlp";
import { YouTubePlugin } from "@distube/youtube";
import { Song } from "distube";
import fs from "node:fs";
import yts from "yt-search";
import { Log } from "./log.js";

interface Cookie {
	domain: string;
	path: string;
	secure: boolean;
	expirationDate: number;
	name: string;
	value: string;
}

// Helper to parse Netscape cookies file into a JSON cookies array for YouTubePlugin
function parseNetscapeCookies(filePath: string): Cookie[] {
	try {
		if (!fs.existsSync(filePath)) {
			Log.Warning(`[CustomYtDlpPlugin] Cookie file not found at ${filePath}. Recommendations might be rate limited.`);
			return [];
		}
		const content = fs.readFileSync(filePath, "utf8");
		const cookies: Cookie[] = [];
		for (const line of content.split(/\r?\n/)) {
			if (!line || line.startsWith("#")) continue;
			const parts = line.split("\t");
			if (parts.length < 7) continue;

			const domain = parts[0];
			if (!domain.toLowerCase().includes("youtube.com")) continue;

			cookies.push({
				domain: domain,
				path: parts[2],
				secure: parts[3] === "TRUE",
				expirationDate: parseInt(parts[4], 10),
				name: parts[5],
				value: parts[6]
			});
		}
		Log.Info(`[CustomYtDlpPlugin] Successfully parsed ${cookies.length} YouTube cookies.`);
		return cookies;
	}
	catch (err: unknown) {
		Log.Error("[CustomYtDlpPlugin] Failed to parse cookies file: " + (err instanceof Error ? err.message : ""));
		return [];
	}
}

export class CustomYtDlpPlugin extends YtDlpPlugin {
	private ytPlugin: YouTubePlugin;

	constructor(options?: { update?: boolean }) {
		super(options);

		const cookieFile = process.env.YTDLP_COOKIES_FILE || "Jacobi.cookie";
		const cookies = parseNetscapeCookies(cookieFile);

		this.ytPlugin = new YouTubePlugin({
			cookies: cookies.length > 0 ? cookies : undefined
		});
	}

	// @ts-expect-error: Override return type is wider than never[]
	override async getRelatedSongs(song?: Song) {
		try {
			if (!song) return [];
			Log.Info(`[CustomYtDlpPlugin] Fetching related songs for: "${song.name}"`);
			const related = await this.ytPlugin.getRelatedSongs(song);

			if (related && related.length > 0) {
				return related;
			}

			// Fallback: search for related/similar songs using yt-search (very robust)
			Log.Info(`[CustomYtDlpPlugin] YouTubePlugin returned no recommendations. Falling back to yt-search...`);
			const searchQuery = `${song.name} similar songs`;
			const results = await yts(searchQuery);

			if (!results || !results.videos || results.videos.length === 0) {
				return [];
			}

			// Filter out the currently playing song if it matches
			const currentId = song.id;
			const filteredVideos = results.videos.filter(v => v.videoId !== currentId).slice(0, 5);

			return filteredVideos.map(v => new Song({
				plugin: this,
				source: "youtube",
				playFromSource: true,
				id: v.videoId,
				name: v.title,
				url: v.url,
				thumbnail: v.thumbnail,
				duration: v.seconds,
				uploader: {
					name: v.author?.name
				}
			}));
		}
		catch (err: unknown) {
			Log.Error("[CustomYtDlpPlugin] Error fetching related songs: " + (err instanceof Error ? err.message : ""));
			return [];
		}
	}
}
