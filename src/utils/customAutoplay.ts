import { Queue, Song, DisTubeError } from "distube";
import type { GuildMember } from "discord.js";
import yts from "yt-search";
import { Log } from "./log.js";
import { type CustomYtDlpPlugin } from "./CustomYtDlpPlugin.js";
import { SimpleContainerBuilder } from "./CustomContainerBuilder.js";
import { sendMessageInTextChannel } from "./discordInteractions.js";

export interface ExtendedQueue extends Queue {
	lastSongStart?: number;
	manualSkip?: boolean;
	consecutiveInstantEnds?: number;
	_autoplayHistory?: Set<string>;
}

interface RecommendationCandidate {
	artist: string;
	title: string;
	source: "lastfm" | "deezer" | "youtube";
	matchScore?: number;
}

export function setupCustomAutoplay(customYtDlpPlugin: CustomYtDlpPlugin) {
	const originalAddRelatedSong = Queue.prototype._addRelatedSong;

	Queue.prototype._addRelatedSong = async function addRelatedSong(this: Queue, song?: Song): Promise<Song> {
		const queue = this as ExtendedQueue;

		try {
			const current = song || queue.songs[0] || queue.previousSongs[queue.previousSongs.length - 1];
			if (!current) {
				throw new DisTubeError("NO_RELATED");
			}

			// Safety loop guard: detect if songs are ending instantly
			const lastStart = queue.lastSongStart || 0;
			const isManualSkip = queue.manualSkip || false;
			const timeSinceLastStart = Date.now() - lastStart;

			if (lastStart > 0 && !isManualSkip && timeSinceLastStart < 4000) {
				queue.consecutiveInstantEnds = (queue.consecutiveInstantEnds || 0) + 1;
				Log.Warning(`[Autoplay] Song ended instantly (${timeSinceLastStart}ms). Consecutive instant ends: ${queue.consecutiveInstantEnds}`);
			}
			else {
				queue.consecutiveInstantEnds = 0;
			}

			// Reset manual skip flag for the next song
			queue.manualSkip = false;

			if ((queue.consecutiveInstantEnds || 0) >= 3) {
				Log.Error(`[Autoplay] Infinite autoplay loop detected in guild ${queue.id}. Stopping queue.`);
				const container = new SimpleContainerBuilder(
					`❌ **Playback Error:** Multiple songs ended instantly. Stopping playback to protect server resources.`
				);
				await sendMessageInTextChannel(queue.textChannel!, container);
				await queue.stop();
				throw new Error("LOOP_DETECTED");
			}

			// Initialize autoplay history set if needed
			if (!queue._autoplayHistory) {
				queue._autoplayHistory = new Set<string>();
			}

			// ── 1. Gather Seeds (Up to last 5 songs from queue / history) ────────────────
			const seedSongs = getSeedSongs(queue, current);
			Log.Info(`[Autoplay] Gathering recommendations using ${seedSongs.length} seed song(s)...`);

			// ── 2. Build Exclusion Sets (Previous, Current Queue & Autoplay History) ───
			const exclusionKeys = new Set<string>();
			const exclusionIds = new Set<string>();

			for (const s of queue.previousSongs) {
				if (s.id) exclusionIds.add(s.id);
				const { artist, track } = extractArtistAndTitle(s.name || "", s.uploader?.name);
				exclusionKeys.add(makeTrackKey(artist, track));
				exclusionKeys.add(normalizeString(s.name || ""));
			}

			for (const s of queue.songs) {
				if (s.id) exclusionIds.add(s.id);
				const { artist, track } = extractArtistAndTitle(s.name || "", s.uploader?.name);
				exclusionKeys.add(makeTrackKey(artist, track));
				exclusionKeys.add(normalizeString(s.name || ""));
			}

			for (const entry of queue._autoplayHistory) {
				exclusionKeys.add(entry);
				exclusionIds.add(entry);
			}

			// ── 3. Fetch Recommendations from APIs (Last.fm & Deezer) ─────────────────
			const lastFmKey = process.env.LASTFM_API_KEY;
			const candidatePool: RecommendationCandidate[] = [];

			// Query recommendations for each seed song
			for (const seed of seedSongs) {
				const { artist, track } = extractArtistAndTitle(seed.name || "", seed.uploader?.name);
				if (!artist) continue;

				const seedPromises: Promise<RecommendationCandidate[]>[] = [];

				if (lastFmKey) {
					seedPromises.push(fetchLastFmRecommendations(artist, track, lastFmKey));
				}

				// Deezer API is public and provides high-quality artist radio recommendations
				seedPromises.push(fetchDeezerRecommendations(artist));

				const settled = await Promise.allSettled(seedPromises);
				for (const res of settled) {
					if (res.status === "fulfilled" && res.value.length > 0) {
						candidatePool.push(...res.value);
					}
				}
			}

			// ── 4. Filter Candidates (Anti-Loop & Anti-Duplicate) ─────────────────────
			const seenCandidates = new Set<string>();
			const filteredCandidates: RecommendationCandidate[] = [];

			for (const candidate of candidatePool) {
				const key = makeTrackKey(candidate.artist, candidate.title);
				const normTitle = normalizeString(candidate.title);

				if (seenCandidates.has(key)) continue;
				seenCandidates.add(key);

				if (exclusionKeys.has(key) || exclusionKeys.has(normTitle)) {
					continue;
				}

				// Avoid recommending tracks with titles identical to any seed song
				const matchesSeed = seedSongs.some(seed => {
					const { track } = extractArtistAndTitle(seed.name || "", seed.uploader?.name);
					const seedNorm = normalizeString(track);
					return seedNorm === normTitle || (normTitle.length > 5 && (seedNorm.includes(normTitle) || normTitle.includes(seedNorm)));
				});

				if (matchesSeed) continue;

				filteredCandidates.push(candidate);
			}

			Log.Info(`[Autoplay] Found ${candidatePool.length} raw candidates, ${filteredCandidates.length} eligible after anti-loop filtering.`);

			// ── 5. Select Best Candidate & Resolve via YouTube ─────────────────────────
			let selectedSong: Song | null = null;

			// Try candidates in small random batches from top candidates to prevent predictable loops
			const candidatesToTry = [...filteredCandidates];

			while (candidatesToTry.length > 0 && !selectedSong) {
				// Pick randomly among top 6 available candidates
				const batchSize = Math.min(6, candidatesToTry.length);
				const pickIdx = Math.floor(Math.random() * batchSize);
				const candidate = candidatesToTry.splice(pickIdx, 1)[0];

				const resolved = await resolveCandidateToYouTube(candidate, exclusionIds, exclusionKeys, customYtDlpPlugin, this.clientMember);
				if (resolved) {
					selectedSong = resolved;
					Log.Info(`[Autoplay] Selected recommendation: "${candidate.artist} - ${candidate.title}" via ${candidate.source} -> "${resolved.name}" (${resolved.formattedDuration})`);

					// Register into session history
					queue._autoplayHistory.add(resolved.id!);
					queue._autoplayHistory.add(makeTrackKey(candidate.artist, candidate.title));
					queue._autoplayHistory.add(normalizeString(resolved.name || ""));
					queue._autoplayHistory.add(normalizeString(candidate.title));
				}
			}

			// ── 6. Fallback: Smart YouTube Mix Search (if APIs yielded no valid video) ──
			if (!selectedSong) {
				Log.Warning(`[Autoplay] APIs returned no playable candidate. Using smart YouTube fallback...`);
				const latestSeed = seedSongs[seedSongs.length - 1];
				const { artist } = extractArtistAndTitle(latestSeed.name || "", latestSeed.uploader?.name);

				selectedSong = await fallbackYouTubeRecommendation(artist, exclusionIds, exclusionKeys, customYtDlpPlugin, this.clientMember);
			}

			if (!selectedSong) {
				Log.Warning(`[Autoplay] Custom autoplay could not resolve a novel song. Falling back to default DisTube addRelatedSong.`);
				return await originalAddRelatedSong.call(this, song);
			}

			selectedSong.metadata = current.metadata;
			selectedSong.member = this.clientMember;

			queue.addToQueue(selectedSong);
			return selectedSong;
		}
		catch (error) {
			if (error instanceof Error && error.message === "LOOP_DETECTED") {
				throw error;
			}
			Log.Error("[Autoplay] Custom autoplay error: " + (error instanceof Error ? error.message : String(error)));
			return await originalAddRelatedSong.call(this, song);
		}
	};
}

// ── Seed Extractor ─────────────────────────────────────────────────────────────

function getSeedSongs(queue: ExtendedQueue, currentSong?: Song): Song[] {
	const allSongs = [...queue.previousSongs, ...queue.songs];
	if (currentSong && !allSongs.some(s => s.id === currentSong.id)) {
		allSongs.push(currentSong);
	}
	return allSongs.slice(-5);
}

// ── Track Parser & Normalizer ──────────────────────────────────────────────────

export function extractArtistAndTitle(songTitle: string, uploaderName?: string): { artist: string; track: string } {
	const rawTitle = (songTitle || "").trim();
	let artist = (uploaderName || "")
		.replace(/\s*-\s*Topic/i, "")
		.replace(/\s*VEVO/i, "")
		.replace(/\s*Official/i, "")
		.replace(/\s*Music/i, "")
		.trim();

	let track = rawTitle;

	// Check if title has "Artist - Track" format
	const separatorMatch = rawTitle.match(/^(.*?)\s*[-–—]\s*(.*)$/);
	if (separatorMatch) {
		const possibleArtist = separatorMatch[1].trim();
		const possibleTrack = separatorMatch[2].trim();
		if (possibleArtist.length > 0 && possibleArtist.length < 50 && possibleTrack.length > 0) {
			artist = possibleArtist;
			track = possibleTrack;
		}
	}

	// Clean out video/audio noise from track name
	track = track.replace(/\s*[([][^()[\]]*(official|oficial|music\s*video|lyric|audio|live|ao\s*vivo|hd|hq|4k|visualizer|remaster|clipe|clip|video|vídeo|fallon)[^()[\]]*[)\]]/gi, "");
	track = track.replace(/[-–—|:•\n]/g, " ").replace(/\s+/g, " ").trim();

	return { artist, track };
}

export function normalizeString(str: string): string {
	return str
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
}

export function makeTrackKey(artist: string, track: string): string {
	return `${normalizeString(artist)}:${normalizeString(track)}`;
}

// ── Last.fm API Provider ───────────────────────────────────────────────────────

async function fetchLastFmRecommendations(artist: string, track: string, apiKey: string): Promise<RecommendationCandidate[]> {
	const candidates: RecommendationCandidate[] = [];

	try {
		// 1. Try track.getSimilar
		const trackUrl = `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${apiKey}&format=json&limit=10`;
		const trackRes = await fetch(trackUrl);

		if (trackRes.ok) {
			const data = await trackRes.json() as {
				similartracks?: {
					track?: Array<{ name: string; match?: string | number; artist?: { name: string } | string }>;
				};
			};

			let tracks = data.similartracks?.track;
			if (tracks && !Array.isArray(tracks)) {
				tracks = [tracks];
			}

			if (Array.isArray(tracks)) {
				for (const t of tracks) {
					const trackArtist = typeof t.artist === "string" ? t.artist : t.artist?.name || "";
					if (t.name && trackArtist) {
						candidates.push({
							artist: trackArtist,
							title: t.name,
							source: "lastfm",
							matchScore: typeof t.match === "number" ? t.match : parseFloat(t.match || "0"),
						});
					}
				}
			}
		}

		// 2. If track.getsimilar returned few tracks, enrich with artist.getsimilar
		if (candidates.length < 5) {
			const artistUrl = `https://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json&limit=5`;
			const artistRes = await fetch(artistUrl);

			if (artistRes.ok) {
				const data = await artistRes.json() as {
					similarartists?: {
						artist?: Array<{ name: string }>;
					};
				};

				let artists = data.similarartists?.artist;
				if (artists && !Array.isArray(artists)) {
					artists = [artists];
				}

				if (Array.isArray(artists)) {
					for (const simArtist of artists.slice(0, 3)) {
						if (!simArtist.name) continue;
						const topTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=${encodeURIComponent(simArtist.name)}&api_key=${apiKey}&format=json&limit=3`;
						const topRes = await fetch(topTracksUrl);
						if (topRes.ok) {
							const topData = await topRes.json() as {
								toptracks?: {
									track?: Array<{ name: string }>;
								};
							};
							let topTracks = topData.toptracks?.track;
							if (topTracks && !Array.isArray(topTracks)) topTracks = [topTracks];
							if (Array.isArray(topTracks)) {
								for (const tt of topTracks) {
									if (tt.name) {
										candidates.push({
											artist: simArtist.name,
											title: tt.name,
											source: "lastfm",
										});
									}
								}
							}
						}
					}
				}
			}
		}
	}
	catch (err) {
		Log.Warning("[Autoplay] Error querying Last.fm: " + (err instanceof Error ? err.message : String(err)));
	}

	return candidates;
}

// ── Deezer Public API Provider (No Auth Required) ──────────────────────────────

async function fetchDeezerRecommendations(artist: string): Promise<RecommendationCandidate[]> {
	const candidates: RecommendationCandidate[] = [];

	try {
		// 1. Search artist to get Deezer artist ID
		const searchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(artist)}&limit=1`;
		const searchRes = await fetch(searchUrl);
		if (!searchRes.ok) return candidates;

		const searchData = await searchRes.json() as {
			data?: Array<{ artist?: { id: number; name: string } }>;
		};

		const artistId = searchData.data?.[0]?.artist?.id;
		if (!artistId) return candidates;

		// 2. Fetch artist radio (25 tracks from this artist and musical peers)
		const radioUrl = `https://api.deezer.com/artist/${artistId}/radio`;
		const radioRes = await fetch(radioUrl);

		if (radioRes.ok) {
			const radioData = await radioRes.json() as {
				data?: Array<{ title: string; artist?: { name: string } }>;
			};

			if (Array.isArray(radioData.data)) {
				for (const item of radioData.data) {
					if (item.title && item.artist?.name) {
						candidates.push({
							artist: item.artist.name,
							title: item.title,
							source: "deezer",
						});
					}
				}
			}
		}

		// 3. If radio had no data, fallback to related artists + top tracks
		if (candidates.length === 0) {
			const relatedUrl = `https://api.deezer.com/artist/${artistId}/related?limit=5`;
			const relatedRes = await fetch(relatedUrl);

			if (relatedRes.ok) {
				const relatedData = await relatedRes.json() as {
					data?: Array<{ id: number; name: string }>;
				};

				if (Array.isArray(relatedData.data)) {
					for (const relArtist of relatedData.data.slice(0, 3)) {
						const topUrl = `https://api.deezer.com/artist/${relArtist.id}/top?limit=3`;
						const topRes = await fetch(topUrl);
						if (topRes.ok) {
							const topData = await topRes.json() as {
								data?: Array<{ title: string }>;
							};
							if (Array.isArray(topData.data)) {
								for (const topItem of topData.data) {
									if (topItem.title) {
										candidates.push({
											artist: relArtist.name,
											title: topItem.title,
											source: "deezer",
										});
									}
								}
							}
						}
					}
				}
			}
		}
	}
	catch (err) {
		Log.Warning("[Autoplay] Error querying Deezer: " + (err instanceof Error ? err.message : String(err)));
	}

	return candidates;
}

// ── YouTube Resolution ─────────────────────────────────────────────────────────

async function resolveCandidateToYouTube(
	candidate: RecommendationCandidate,
	exclusionIds: Set<string>,
	exclusionKeys: Set<string>,
	customYtDlpPlugin: CustomYtDlpPlugin,
	clientMember?: GuildMember
): Promise<Song | null> {
	try {
		const searchQuery = `${candidate.artist} - ${candidate.title}`;
		const results = await yts(searchQuery);

		if (!results || !results.videos || results.videos.length === 0) {
			return null;
		}

		// Find a video matching criteria
		const video = results.videos.find(v => {
			if (v.seconds < 60 || v.seconds > 900) return false; // Between 1m and 15m
			if (exclusionIds.has(v.videoId)) return false;

			const normVideoTitle = normalizeString(v.title);
			if (exclusionKeys.has(normVideoTitle)) return false;

			return true;
		});

		if (!video) return null;

		return new Song({
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
				url: video.author?.url,
			},
		}, { member: clientMember });
	}
	catch (err) {
		Log.Warning(`[Autoplay] Failed resolving candidate "${candidate.artist} - ${candidate.title}": ` + (err instanceof Error ? err.message : String(err)));
		return null;
	}
}

// ── Smart YouTube Mix Fallback ─────────────────────────────────────────────────

async function fallbackYouTubeRecommendation(
	artist: string,
	exclusionIds: Set<string>,
	exclusionKeys: Set<string>,
	customYtDlpPlugin: CustomYtDlpPlugin,
	clientMember?: GuildMember
): Promise<Song | null> {
	try {
		const searchQuery = `${artist} mix`;
		const results = await yts(searchQuery);

		if (!results || !results.videos || results.videos.length === 0) {
			return null;
		}

		const eligible = results.videos.filter(v => {
			if (v.seconds < 60 || v.seconds > 900) return false;
			if (exclusionIds.has(v.videoId)) return false;
			if (exclusionKeys.has(normalizeString(v.title))) return false;
			return true;
		});

		if (eligible.length === 0) return null;

		// Pick random from eligible to prevent deterministic loops
		const pick = eligible[Math.floor(Math.random() * Math.min(5, eligible.length))];

		return new Song({
			plugin: customYtDlpPlugin,
			source: "youtube",
			playFromSource: true,
			id: pick.videoId,
			name: pick.title,
			url: pick.url,
			thumbnail: pick.thumbnail,
			duration: pick.seconds,
			uploader: {
				name: pick.author?.name,
				url: pick.author?.url,
			},
		}, { member: clientMember });
	}
	catch {
		return null;
	}
}
