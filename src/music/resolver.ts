import play, { 
	type SpotifyTrack, 
	type SpotifyPlaylist, 
	type SpotifyAlbum
} from "play-dl";
import { type Track } from "../types.js";
import { type Readable } from "stream";

// Setup Spotify tokens if provided in .env
if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
	play.setToken({
		spotify: {
			client_id: process.env.SPOTIFY_CLIENT_ID,
			client_secret: process.env.SPOTIFY_CLIENT_SECRET,
			refresh_token: "",
			market: "US"
		}
	}).catch((err: unknown) => {
		const error = err as Error;
		console.error("[Resolver] Failed to authorize Spotify Client Credentials in play-dl:", error.message);
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
  duration: number;
  url: string;
  thumbnail?: string;
  user?: {
    username?: string;
  };
}

interface ResolvableSoundCloudPlaylist {
  id: number;
  name: string;
  url: string;
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
	// 1. Check Deezer first
	if (url.includes("deezer.com") || url.includes("deezer.page.link")) {
		return resolveDeezer(url, requestedBy);
	}

	// 2. Check Spotify
	const spType = play.sp_validate(url);
	if (spType !== false) {
		if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
			throw new Error(
				"Spotify client credentials are not configured on the bot. " +
        "Please add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` to the `.env` file."
			);
		}
		const data = await play.spotify(url);
		if (spType === "track") {
			const trackData = data as SpotifyTrack;
			return [{
				id: `spotify_track_${trackData.id}_${Date.now()}`,
				title: trackData.name,
				artist: trackData.artists?.map(a => a.name).join(", ") || "Unknown Artist",
				url: url,
				thumbnailUrl: trackData.thumbnail?.url || "",
				duration: trackData.durationInSec || 0,
				durationString: formatDuration(trackData.durationInSec || 0),
				source: "spotify",
				requestedBy
			}];
		}
		else {
			// Playlist or Album
			const listData = data as SpotifyPlaylist | SpotifyAlbum;
			const tracks = await listData.all_tracks();
			return tracks.map(track => ({
				id: `spotify_track_${track.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
				title: track.name,
				artist: track.artists?.map(a => a.name).join(", ") || "Unknown Artist",
				url: track.url || url,
				thumbnailUrl: track.thumbnail?.url || listData.thumbnail?.url || "",
				duration: track.durationInSec || 0,
				durationString: formatDuration(track.durationInSec || 0),
				source: "spotify",
				requestedBy
			}));
		}
	}

	// 3. Check SoundCloud
	const soType = await play.so_validate(url);
	if (soType !== false) {
		const data = await play.soundcloud(url);
		if (soType === "track") {
			const trackData = data as unknown as ResolvableSoundCloudTrack;
			const secs = Math.round((trackData.duration || 0) / 1000);
			return [{
				id: `soundcloud_track_${trackData.id}_${Date.now()}`,
				title: trackData.name,
				artist: trackData.user?.username || "Unknown Artist",
				url: trackData.url,
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
				const secs = Math.round((track.duration || 0) / 1000);
				return {
					id: `soundcloud_track_${track.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
					title: track.name,
					artist: track.user?.username || "Unknown Artist",
					url: track.url,
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
				source: "youtube",
				requestedBy
			}));
		}
	}

	throw new Error("Unsupported link. The URL is not recognized as YouTube, Spotify, SoundCloud, or Deezer.");
}

/**
 * Searches YouTube for queries and returns the top results.
 */
export async function searchTracks(query: string, limit = 5): Promise<Omit<Track, "requestedBy">[]> {
	const searchResults = await play.search(query, { limit, source: { youtube: "video" } });
	return searchResults.map(video => ({
		id: `search_result_${video.id}_${Date.now()}`,
		title: video.title || "Unknown Title",
		artist: video.channel?.name || "Unknown Channel",
		url: video.url,
		thumbnailUrl: video.thumbnails[0]?.url || "",
		duration: video.durationInSec,
		durationString: formatDuration(video.durationInSec),
		source: "search" as const
	}));
}

/**
 * Returns a playable audio stream and input type for @discordjs/voice.
 * If the track is Spotify or Deezer, it searches YouTube first to lazy-resolve the audio stream.
 */
export async function getAudioStream(track: Track): Promise<{ stream: Readable; type: string }> {
	let targetUrl = track.url;

	// For platforms without direct streams (Spotify / Deezer / general search placeholders), search YouTube.
	if (track.source === "spotify" || track.source === "deezer") {
		const searchString = `${track.title} ${track.artist}`;
		const searchResults = await play.search(searchString, { limit: 1, source: { youtube: "video" } });
		if (searchResults.length === 0) {
			throw new Error(`Could not find a matching YouTube audio stream for track: "${track.title}" by ${track.artist}`);
		}
		targetUrl = searchResults[0].url;
	}

	// Get stream from YouTube/SoundCloud URL
	const stream = await play.stream(targetUrl, {
		discordPlayerCompatibility: true
	});

	return {
		stream: stream.stream,
		type: stream.type
	};
}
