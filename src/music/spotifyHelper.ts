import dotenv from "dotenv";
dotenv.config();

interface SpotifyTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
}

interface SpotifyArtist {
	name: string;
}

interface SpotifyImage {
	url: string;
}

interface SpotifyTrackObject {
	id: string;
	name: string;
	duration_ms: number;
	artists: SpotifyArtist[];
	album?: {
		name: string;
		images: SpotifyImage[];
	};
	external_urls: {
		spotify: string;
	};
}

interface SpotifySearchResponse {
	tracks: {
		items: SpotifyTrackObject[];
	};
}

interface SpotifyAlbumResponse {
	name: string;
	images: SpotifyImage[];
	tracks: {
		items: {
			id: string;
			name: string;
			duration_ms: number;
			artists: SpotifyArtist[];
			external_urls: {
				spotify: string;
			};
		}[];
		next: string | null;
	};
}

interface SpotifyPlaylistResponse {
	name: string;
	images: SpotifyImage[];
	tracks: {
		items: {
			track: SpotifyTrackObject | null;
		}[];
		next: string | null;
	};
}

export interface ResolvedTrack {
	id: string;
	title: string;
	artist: string;
	url: string;
	thumbnailUrl: string;
	duration: number; // in seconds
	source: "spotify";
}

class SpotifyHelper {
	private clientId: string | undefined;
	private clientSecret: string | undefined;
	private accessToken: string | null = null;
	private tokenExpiry: number = 0;

	constructor() {
		this.clientId = process.env.SPOTIFY_CLIENT_ID;
		this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
	}

	private async getAccessToken(): Promise<string> {
		if (this.accessToken && Date.now() < this.tokenExpiry) {
			return this.accessToken;
		}

		if (!this.clientId || !this.clientSecret) {
			throw new Error("Spotify credentials SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are not set in your environmental variables.");
		}

		const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
		const res = await fetch("https://accounts.spotify.com/api/token", {
			method: "POST",
			headers: {
				"Authorization": `Basic ${credentials}`,
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: "grant_type=client_credentials"
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Failed to authenticate with Spotify API: ${res.statusText} - ${text}`);
		}

		const data = await res.json() as SpotifyTokenResponse;
		this.accessToken = data.access_token;
		// Expire 1 minute early to be safe
		this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
		return this.accessToken;
	}

	private async spotifyFetch(url: string): Promise<any> {
		const token = await this.getAccessToken();
		const res = await fetch(url, {
			headers: {
				"Authorization": `Bearer ${token}`
			}
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Spotify API error calling ${url}: ${res.status} ${res.statusText} - ${text}`);
		}

		return res.json();
	}

	/**
	 * Search for tracks on Spotify.
	 */
	public async searchTracks(query: string, limit = 5): Promise<ResolvedTrack[]> {
		const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`;
		const data = await this.spotifyFetch(url) as SpotifySearchResponse;

		return data.tracks.items.map(item => this.mapTrack(item));
	}

	/**
	 * Resolve a Spotify URL (track, album, playlist).
	 */
	public async resolveUrl(url: string): Promise<ResolvedTrack[]> {
		// Regex matching: spotify.com/track/ID, spotify.com/album/ID, spotify.com/playlist/ID
		const match = url.match(/spotify\.com\/(?:\w+\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/);
		if (!match) {
			throw new Error("Invalid Spotify URL. Must contain track, album, or playlist ID.");
		}

		const type = match[1];
		const id = match[2];

		if (type === "track") {
			const data = await this.spotifyFetch(`https://api.spotify.com/v1/tracks/${id}`) as SpotifyTrackObject;
			return [this.mapTrack(data)];
		} else if (type === "album") {
			const albumData = await this.spotifyFetch(`https://api.spotify.com/v1/albums/${id}`) as SpotifyAlbumResponse;
			const coverUrl = albumData.images[0]?.url || "";
			const tracks: ResolvedTrack[] = [];

			// Handle pagination for album tracks if there are more than 50
			let nextUrl: string | null = `https://api.spotify.com/v1/albums/${id}/tracks?limit=50`;
			while (nextUrl) {
				const pageData = await this.spotifyFetch(nextUrl);
				const items = pageData.items as SpotifyAlbumResponse["tracks"]["items"];
				for (const item of items) {
					tracks.push({
						id: `spotify_track_${item.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
						title: item.name,
						artist: item.artists.map(a => a.name).join(", "),
						url: item.external_urls.spotify,
						thumbnailUrl: coverUrl,
						duration: Math.round(item.duration_ms / 1000),
						source: "spotify"
					});
				}
				nextUrl = pageData.next;
			}
			return tracks;
		} else if (type === "playlist") {
			const playlistData = await this.spotifyFetch(`https://api.spotify.com/v1/playlists/${id}`) as SpotifyPlaylistResponse;
			const playlistCover = playlistData.images[0]?.url || "";
			const tracks: ResolvedTrack[] = [];

			let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`;
			while (nextUrl) {
				const pageData = await this.spotifyFetch(nextUrl);
				const items = pageData.items as SpotifyPlaylistResponse["tracks"]["items"];
				for (const item of items) {
					if (item.track) {
						const coverUrl = item.track.album?.images[0]?.url || playlistCover;
						tracks.push(this.mapTrack(item.track, coverUrl));
					}
				}
				nextUrl = pageData.next;
			}
			return tracks;
		}

		throw new Error("Unsupported Spotify media type.");
	}

	private mapTrack(item: SpotifyTrackObject, customCover?: string): ResolvedTrack {
		return {
			id: `spotify_track_${item.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
			title: item.name,
			artist: item.artists.map(a => a.name).join(", "),
			url: item.external_urls.spotify,
			thumbnailUrl: customCover || item.album?.images[0]?.url || "",
			duration: Math.round(item.duration_ms / 1000),
			source: "spotify"
		};
	}
}

export const spotifyHelper = new SpotifyHelper();
