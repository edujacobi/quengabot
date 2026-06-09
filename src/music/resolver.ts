import dotenv from "dotenv";
dotenv.config();

import play from "play-dl";
import yts from "yt-search";
import http from "http";
import https from "https";
import { type Readable } from "stream";
import { type Track } from "../types.js";
import { spotifyHelper } from "./spotifyHelper.js";

// Setup YouTube Cookie if provided in .env
if (process.env.YOUTUBE_COOKIE) {
	play.setToken({
		youtube: {
			cookie: process.env.YOUTUBE_COOKIE
		}
	}).catch((err: unknown) => {
		const error = err as Error;
		console.error("[Resolver] Failed to set YouTube Cookie in play-dl:", error.message);
	});
}

/**
 * Format seconds into a MM:SS or HH:MM:SS string.
 */
export function formatDuration(seconds: number): string {
	if (isNaN(seconds) || seconds < 0) return "0:00";
	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hrs > 0) {
		return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Interfaces for Deezer API response payloads
interface DeezerArtist {
	name: string;
}

interface DeezerAlbumRef {
	cover_medium?: string;
	cover_big?: string;
}

interface DeezerTrackData {
	id: number;
	title: string;
	artist: DeezerArtist;
	album?: DeezerAlbumRef;
	duration: number;
	link: string;
}

interface DeezerError {
	message: string;
}

interface DeezerTrackResponse extends DeezerTrackData {
	error?: DeezerError;
}

interface DeezerPlaylistResponse {
	title: string;
	picture_medium?: string;
	tracks?: {
		data: DeezerTrackData[];
	};
	error?: DeezerError;
}

interface DeezerAlbumResponse {
	cover_medium?: string;
	tracks?: {
		data: {
			id: number;
			title: string;
			artist: DeezerArtist;
			duration: number;
		}[];
	};
	error?: DeezerError;
}

// Custom interfaces to wrap SoundCloud types since the play-dl typings are incomplete
interface ResolvableSoundCloudTrack {
	id: number;
	name: string;
	durationInSec: number;
	permalink: string;
	thumbnail?: string;
	user?: {
		name?: string;
	};
}

interface ResolvableSoundCloudPlaylist {
	id: number;
	name: string;
	permalink: string;
	thumbnail?: string;
	all_tracks(): Promise<ResolvableSoundCloudTrack[]>;
}

/**
 * Custom Deezer metadata resolver using the public API.
 */
async function resolveDeezer(url: string, requestedBy: string): Promise<Track[]> {
	let finalUrl = url;

	// Handle redirects for short links (e.g. deezer.page.link)
	if (url.includes("deezer.page.link")) {
		try {
			const res = await fetch(url, { method: "HEAD", redirect: "follow" });
			finalUrl = res.url;
		}
		catch (err: unknown) {
			const error = err as Error;
			throw new Error(`Failed to resolve Deezer redirect link: ${error.message}`);
		}
	}

	// Regex to extract type (track/playlist/album) and ID
	const match = finalUrl.match(/deezer\.com\/(?:\w+\/)?(track|playlist|album)\/(\d+)/i);
	if (!match) {
		throw new Error("Invalid Deezer URL. Must contain track, playlist, or album ID.");
	}

	const type = match[1].toLowerCase();
	const id = match[2];

	if (type === "track") {
		const res = await fetch(`https://api.deezer.com/track/${id}`);
		const data = await res.json() as DeezerTrackResponse;
		if (data.error) {
			throw new Error(`Deezer API Error: ${data.error.message}`);
		}
		return [{
			id: `deezer_track_${data.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
			title: data.title,
			artist: data.artist.name,
			url: data.link,
			thumbnailUrl: data.album?.cover_medium || "",
			duration: data.duration,
			durationString: formatDuration(data.duration),
			source: "deezer",
			requestedBy
		}];
	}
	else if (type === "playlist") {
		const res = await fetch(`https://api.deezer.com/playlist/${id}`);
		const data = await res.json() as DeezerPlaylistResponse;
		if (data.error) {
			throw new Error(`Deezer API Error: ${data.error.message}`);
		}
		if (!data.tracks || !data.tracks.data) {
			throw new Error("Deezer playlist has no tracks or is private.");
		}
		return data.tracks.data.map(track => ({
			id: `deezer_track_${track.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
			title: track.title,
			artist: track.artist.name,
			url: track.link,
			thumbnailUrl: track.album?.cover_medium || data.picture_medium || "",
			duration: track.duration,
			durationString: formatDuration(track.duration),
			source: "deezer",
			requestedBy
		}));
	}
	else if (type === "album") {
		const res = await fetch(`https://api.deezer.com/album/${id}`);
		const data = await res.json() as DeezerAlbumResponse;
		if (data.error) {
			throw new Error(`Deezer API Error: ${data.error.message}`);
		}
		if (!data.tracks || !data.tracks.data) {
			throw new Error("Deezer album has no tracks.");
		}
		const cover = data.cover_medium || "";
		return data.tracks.data.map(track => ({
			id: `deezer_track_${track.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
			title: track.title,
			artist: track.artist.name,
			url: `https://www.deezer.com/track/${track.id}`,
			thumbnailUrl: cover,
			duration: track.duration,
			durationString: formatDuration(track.duration),
			source: "deezer",
			requestedBy
		}));
	}

	throw new Error("Unsupported Deezer media type.");
}

/**
 * High-level resolver for URLs from various music sources.
 */
export async function resolveUrl(url: string, requestedBy: string): Promise<Track[]> {
	// 0. Check for direct audio URL first
	const isAudioUrl = /\.(mp3|ogg|wav|aac|flac|m4a|webm|opus)(?:\?|$)/i.test(url);
	if (isAudioUrl) {
		console.log(`[Resolver] Resolving Direct Audio URL: ${url}`);
		const filename = url.split("/").pop()?.split("?")[0] || "Direct Audio";
		return [{
			id: `direct_audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
			title: decodeURIComponent(filename),
			artist: "Direct Link",
			url: url,
			thumbnailUrl: "",
			duration: 0,
			durationString: "Live/Unknown",
			source: "direct" as const,
			requestedBy
		}];
	}

	// 1. Check Deezer first
	if (url.includes("deezer.com") || url.includes("deezer.page.link")) {
		console.log(`[Resolver] Resolving Deezer URL: ${url}`);
		return resolveDeezer(url, requestedBy);
	}

	// 2. Check Spotify
	const spType = play.sp_validate(url);
	if (spType !== false) {
		console.log(`[Resolver] Resolving Spotify URL: ${url}`);
		const tracks = await spotifyHelper.resolveUrl(url);
		return tracks.map(track => ({
			id: track.id,
			title: track.title,
			artist: track.artist,
			url: track.url,
			thumbnailUrl: track.thumbnailUrl,
			duration: track.duration,
			durationString: formatDuration(track.duration),
			source: "spotify" as const,
			requestedBy
		}));
	}

	// 3. Check SoundCloud
	if (url.includes("soundcloud.com")) {
		console.log(`[Resolver] Resolving SoundCloud URL: ${url}`);
		await authorizeSoundCloud();
	}
	const soType = await play.so_validate(url);
	if (soType !== false) {
		const data = await play.soundcloud(url);
		if (soType === "track") {
			const trackData = data as unknown as ResolvableSoundCloudTrack;
			const secs = trackData.durationInSec || 0;
			return [{
				id: `soundcloud_track_${trackData.id}_${Date.now()}`,
				title: trackData.name,
				artist: trackData.user?.name || "Unknown Artist",
				url: trackData.permalink || url,
				thumbnailUrl: trackData.thumbnail || "",
				duration: secs,
				durationString: formatDuration(secs),
				source: "soundcloud",
				requestedBy
			}];
		}
		else {
			// SoundCloud Playlist
			const listData = data as unknown as ResolvableSoundCloudPlaylist;
			const tracks = await listData.all_tracks();
			return tracks.map(track => {
				const secs = track.durationInSec || 0;
				return {
					id: `soundcloud_track_${track.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
					title: track.name,
					artist: track.user?.name || "Unknown Artist",
					url: track.permalink || url,
					thumbnailUrl: track.thumbnail || listData.thumbnail || "",
					duration: secs,
					durationString: formatDuration(secs),
					source: "soundcloud",
					requestedBy
				};
			});
		}
	}

	// 4. Check YouTube (includes YouTube Music)
	const ytType = play.yt_validate(url);
	if (ytType !== false) {
		console.log(`[Resolver] Resolving YouTube URL: ${url}`);
		if (ytType === "video") {
			const videoInfo = await play.video_info(url);
			const video = videoInfo.video_details;
			return [{
				id: `youtube_track_${video.id}_${Date.now()}`,
				title: video.title || "Unknown Title",
				artist: video.channel?.name || "Unknown Channel",
				url: video.url,
				thumbnailUrl: video.thumbnails[0]?.url || "",
				duration: video.durationInSec,
				durationString: formatDuration(video.durationInSec),
				source: "youtube",
				requestedBy
			}];
		}
		else if (ytType === "playlist") {
			const playlistInfo = await play.playlist_info(url, { incomplete: true });
			const videos = await playlistInfo.all_videos();
			return videos.map(video => ({
				id: `youtube_track_${video.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
				title: video.title || "Unknown Title",
				artist: video.channel?.name || "Unknown Channel",
				url: video.url,
				thumbnailUrl: video.thumbnails[0]?.url || "",
				duration: video.durationInSec,
				durationString: formatDuration(video.durationInSec),
				source: "youtube" as const,
				requestedBy
			}));
		}
	}

	throw new Error("Unsupported link. The URL is not recognized as YouTube, Spotify, SoundCloud, or Deezer.");
}

/**
 * Searches YouTube (via yt-search) for queries and returns the top results.
 */
export async function searchTracks(query: string, limit = 5): Promise<Omit<Track, "requestedBy">[]> {
	console.log(`[Resolver] Searching YouTube (via yt-search) for: "${query}"`);
	const result = await yts(query);
	const videos = result.videos.slice(0, limit);
	return videos.map(video => ({
		id: `youtube_track_${video.videoId}_${Date.now()}`,
		title: video.title || "Unknown Title",
		artist: video.author?.name || "Unknown Channel",
		url: video.url,
		thumbnailUrl: video.thumbnail || "",
		duration: video.seconds,
		durationString: formatDuration(video.seconds),
		source: "youtube" as const
	}));
}

let soundcloudAuthorized = false;
async function authorizeSoundCloud() {
	if (soundcloudAuthorized) return;
	try {
		console.log("[Resolver] Authorizing SoundCloud client...");
		const clientID = await play.getFreeClientID();
		await play.setToken({
			soundcloud: {
				client_id: clientID
			}
		});
		soundcloudAuthorized = true;
		console.log("[Resolver] SoundCloud client authorized successfully.");
	}
	catch (err: unknown) {
		const error = err as Error;
		console.error("[Resolver] Failed to authorize SoundCloud client:", error.message);
		throw new Error(`SoundCloud authorization failed: ${error.message}`);
	}
}

/**
 * Returns a playable audio stream and input type for @discordjs/voice.
 * If the track is Spotify or Deezer, it searches SoundCloud first to lazy-resolve the audio stream.
 */
/**
 * Fetch a raw HTTP/HTTPS audio stream from a direct URL.
 */
function streamDirectUrl(url: string): Promise<Readable> {
	return new Promise((resolve, reject) => {
		const protocol = url.startsWith("https") ? https : http;
		protocol.get(url, (response) => {
			if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
				// Follow single redirect
				streamDirectUrl(response.headers.location).then(resolve).catch(reject);
				return;
			}
			if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
				reject(new Error(`Direct URL returned HTTP ${response.statusCode}`));
				return;
			}
			resolve(response as unknown as Readable);
		}).on("error", reject);
	});
}

export async function getAudioStream(track: Track): Promise<{ stream: Readable; type: string }> {
	let targetUrl = track.url;
	console.log(`[Resolver] Getting audio stream for track: "${track.title}" by ${track.artist} (Source: ${track.source})`);

	// --- 1. Direct audio URL (raw HTTP/HTTPS stream) ---
	if (track.source === "direct") {
		console.log(`[Resolver] Streaming direct audio URL: ${targetUrl}`);
		const stream = await streamDirectUrl(targetUrl);
		return { stream, type: "arbitrary" };
	}

	const hasYoutubeCookie = !!process.env.YOUTUBE_COOKIE;

	// --- 2. YouTube with Cookie Bypass ---
	// Try to stream YouTube directly using the cookie configured in .env.
	// play-dl may still fail with "Invalid URL" if YouTube's bot detection blocks it —
	// in that case we fall through to the SoundCloud search path below.
	if (track.source === "youtube" && hasYoutubeCookie) {
		console.log(`[Resolver] Attempting YouTube direct stream via cookie bypass: ${targetUrl}`);
		try {
			const stream = await play.stream(targetUrl, {
				discordPlayerCompatibility: true
			});
			console.log(`[Resolver] YouTube stream successful (type: ${stream.type})`);
			return {
				stream: stream.stream,
				type: stream.type
			};
		}
		catch (err: unknown) {
			const error = err as Error;
			console.warn(`[Resolver] YouTube direct stream failed (${error.message}). Falling back to SoundCloud search...`);
			// Fall through — do NOT re-throw. The SoundCloud path below will handle it.
		}
	}

	// --- 3. SoundCloud path ---
	// Covers: SoundCloud tracks, Spotify/Deezer (lazy-resolved via search),
	// YouTube without cookie, and YouTube where the cookie bypass failed above.
	const shouldSearchSoundCloud =
		track.source === "spotify" ||
		track.source === "deezer" ||
		track.source === "youtube"; // YouTube always falls through here if cookie bypass didn't return early

	await authorizeSoundCloud();

	// Lazy-resolve a SoundCloud URL for non-SoundCloud sources
	if (shouldSearchSoundCloud) {
		const searchString = `${track.title} ${track.artist}`;
		console.log(`[Resolver] Searching SoundCloud for matching audio: "${searchString}"`);
		const searchResults = await play.search(searchString, {
			limit: 1,
			source: { soundcloud: "tracks" }
		});
		const scTrack = searchResults[0];
		if (!scTrack || !scTrack.url) {
			const errMsg = `Could not find a matching SoundCloud audio stream for track: "${track.title}" by ${track.artist}`;
			console.error(`[Resolver] ${errMsg}`);
			throw new Error(errMsg);
		}
		targetUrl = scTrack.url;
		console.log(`[Resolver] Matched SoundCloud track: "${scTrack.name}" - ${targetUrl}`);

		// Update track metadata with SoundCloud info
		track.title = scTrack.name;
		track.artist = scTrack.user?.name || "Unknown Artist";
		track.thumbnailUrl = scTrack.thumbnail || "";
		track.duration = scTrack.durationInSec || 0;
		track.durationString = formatDuration(scTrack.durationInSec || 0);
		if (scTrack.permalink) {
			track.url = scTrack.permalink;
		}
	}

	// Stream from SoundCloud (or the resolved SoundCloud URL)
	console.log(`[Resolver] Streaming from SoundCloud: ${targetUrl}`);
	try {
		const stream = await play.stream(targetUrl, {
			discordPlayerCompatibility: true
		});
		return {
			stream: stream.stream,
			type: stream.type
		};
	}
	catch (streamErr) {
		console.warn(`[Resolver] SoundCloud stream failed for "${track.title}" (geoblocked/restricted). Searching for alternatives...`);
		const searchString = `${track.title} ${track.artist}`;
		const searchResults = await play.search(searchString, {
			limit: 3,
			source: { soundcloud: "tracks" }
		});

		for (const altTrack of searchResults) {
			if (altTrack.url && altTrack.url !== targetUrl) {
				try {
					console.log(`[Resolver] Trying alternative SoundCloud track: "${altTrack.name}" - ${altTrack.url}`);
					const stream = await play.stream(altTrack.url, {
						discordPlayerCompatibility: true
					});

					// Update metadata with the working alternative
					track.title = altTrack.name;
					track.artist = altTrack.user?.name || "Unknown Artist";
					track.thumbnailUrl = altTrack.thumbnail || "";
					track.duration = altTrack.durationInSec || 0;
					track.durationString = formatDuration(altTrack.durationInSec || 0);
					if (altTrack.permalink) {
						track.url = altTrack.permalink;
					}

					return {
						stream: stream.stream,
						type: stream.type
					};
				}
				catch (altErr: unknown) {
					const altError = altErr as Error;
					console.warn(`[Resolver] Alternative also failed: ${altError.message}`);
				}
			}
		}

		// All alternatives exhausted — rethrow the original error
		throw streamErr;
	}
}
