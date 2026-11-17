import yts from "yt-search";

type VideoSearchResult = yts.VideoSearchResult;
type Searcher = (query: string) => Promise<VideoSearchResult[]>;

interface SearchCacheEntry {
	expiresAt: number;
	videos: VideoSearchResult[];
}

interface VideoCacheEntry {
	expiresAt: number;
	video: VideoSearchResult;
}

const cacheTtlMs = 2 * 60 * 1000;
const maxCachedSearches = 100;
const maxCachedVideos = 1000;
const searchCache = new Map<string, SearchCacheEntry>();
const videoCache = new Map<string, VideoCacheEntry>();
const inFlightSearches = new Map<string, Promise<VideoSearchResult[]>>();
const runYouTubeSearch: Searcher = async query => (await yts(query)).videos;

// ponytail: process-local cache; use shared storage only if multi-instance misses matter.
function setBounded<K, V>(cache: Map<K, V>, key: K, value: V, maxEntries: number) {
	cache.delete(key);
	cache.set(key, value);

	if (cache.size > maxEntries) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
}

function normalizeQuery(query: string) {
	return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function searchYouTubeVideos(query: string, searcher: Searcher = runYouTubeSearch): Promise<VideoSearchResult[]> {
	const key = normalizeQuery(query);
	const cached = searchCache.get(key);

	if (cached && cached.expiresAt > Date.now()) return cached.videos;
	if (cached) searchCache.delete(key);

	const inFlight = inFlightSearches.get(key);
	if (inFlight) return inFlight;

	const search = searcher(query).then(videos => {
		const selectedVideos = videos.slice(0, 10);
		const expiresAt = Date.now() + cacheTtlMs;

		setBounded(searchCache, key, { expiresAt, videos: selectedVideos }, maxCachedSearches);
		for (const video of selectedVideos) {
			setBounded(videoCache, video.url, { expiresAt, video }, maxCachedVideos);
		}

		return selectedVideos;
	}).finally(() => {
		inFlightSearches.delete(key);
	});

	inFlightSearches.set(key, search);
	return search;
}

export function getCachedYouTubeVideo(url: string): VideoSearchResult | undefined {
	const cached = videoCache.get(url);
	if (!cached) return undefined;
	if (cached.expiresAt <= Date.now()) {
		videoCache.delete(url);
		return undefined;
	}

	return cached.video;
}
