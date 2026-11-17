import assert from "node:assert/strict";
import { test } from "node:test";
import { getCachedYouTubeVideo, searchYouTubeVideos } from "../build/utils/youtubeSearchCache.js";

test("coalesces concurrent searches and reuses their metadata briefly", async () => {
	let calls = 0;
	const video = {
		type: "video",
		videoId: "test-video",
		url: "https://www.youtube.com/watch?v=test-video",
		title: "Test song",
		description: "",
		image: "",
		thumbnail: undefined,
		seconds: 120,
		timestamp: "2:00",
		duration: {
			seconds: 120,
			timestamp: "2:00",
			toString() {
				return this.timestamp;
			},
		},
		ago: "",
		views: 0,
		author: {
			name: "Test artist",
			url: "https://www.youtube.com/@test",
		},
	};
	const searcher = async () => {
		calls += 1;
		await Promise.resolve();
		return [video];
	};

	const [first, concurrent] = await Promise.all([
		searchYouTubeVideos("Test song", searcher),
		searchYouTubeVideos(" test   song ", searcher),
	]);

	assert.deepEqual(first, [video]);
	assert.deepEqual(concurrent, [video]);
	assert.equal(getCachedYouTubeVideo(video.url), video);
	assert.deepEqual(await searchYouTubeVideos("TEST SONG", searcher), [video]);
	assert.equal(calls, 1);
});
