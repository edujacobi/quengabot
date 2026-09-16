import { type Client, type GuildTextBasedChannel } from "discord.js";
import { SimpleContainerBuilder } from "./CustomContainerBuilder.js";
import { sendMessageInTextChannel } from "./discordInteractions.js";
import { EmoteString } from "./emotes.js";
import { Log } from "./log.js";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const inactivityTimers = new Map<string, NodeJS.Timeout>();

/**
 * Starts a 5-minute inactivity countdown for the specified guild.
 * If no music is played within this window, the bot will leave the voice channel and free resources.
 */
export function startInactivityTimer(
	client: Client,
	guildId: string,
	textChannel?: GuildTextBasedChannel,
	reason = "Queue finished"
): void {
	cancelInactivityTimer(guildId, "Resetting existing timer");

	Log.Info(`[Inactivity] Started 5-minute inactivity timer for guild ${guildId} (Reason: ${reason}).`);

	const timer = setTimeout(async () => {
		inactivityTimers.delete(guildId);
		Log.Info(`[Inactivity] 5 minutes elapsed in guild ${guildId}. Checking if bot should disconnect...`);

		const guild = client.guilds.cache.get(guildId);
		const botMember = guild?.members.me;
		const botVoiceChannel = botMember?.voice.channel;

		if (!botVoiceChannel) {
			Log.Info(`[Inactivity] Bot is already not in a voice channel in guild ${guildId}.`);
			return;
		}

		const queue = client.distube.getQueue(guildId);
		if (queue && queue.playing) {
			Log.Info(`[Inactivity] Music is currently playing in guild ${guildId}. Aborting auto-leave.`);
			return;
		}

		if (queue) {
			try {
				await queue.stop();
			}
			catch (err) {
				Log.Error(`[Inactivity] Failed to stop queue in guild ${guildId}: ` + (err instanceof Error ? err.message : ""));
			}
		}

		// Clear voice channel status
		try {
			await client.rest.put(`/channels/${botVoiceChannel.id}/voice-status`, {
				body: { status: "" }
			});
		}
		catch (err: unknown) {
			Log.Error(`[Inactivity] Failed to clear voice channel status in guild ${guildId}: ` + (err instanceof Error ? err.message : ""));
		}

		// Disconnect from voice channel
		try {
			client.distube.voices.leave(guildId);
		}
		catch (err: unknown) {
			Log.Error(`[Inactivity] Error leaving voice channel with DisTube in guild ${guildId}: ` + (err instanceof Error ? err.message : ""));
		}

		if (botMember?.voice.channel) {
			try {
				await botMember.voice.disconnect();
			}
			catch (err: unknown) {
				Log.Error(`[Inactivity] Error disconnecting from voice channel in guild ${guildId}: ` + (err instanceof Error ? err.message : ""));
			}
		}

		Log.Info(`[Inactivity] Successfully left voice channel in guild ${guildId} due to 5 minutes of inactivity.`);

		if (textChannel) {
			const container = new SimpleContainerBuilder(
				`${EmoteString.Megaphone} **Left the voice channel due to 5 minutes of inactivity.**`
			);
			await sendMessageInTextChannel(textChannel, container);
		}
	}, INACTIVITY_TIMEOUT_MS);

	inactivityTimers.set(guildId, timer);
}

/**
 * Cancels any active inactivity countdown for the specified guild.
 */
export function cancelInactivityTimer(guildId: string, reason = "Activity detected"): void {
	const timer = inactivityTimers.get(guildId);
	if (timer) {
		clearTimeout(timer);
		inactivityTimers.delete(guildId);
		Log.Info(`[Inactivity] Cancelled inactivity timer for guild ${guildId} (Reason: ${reason}).`);
	}
}

/**
 * Checks if an inactivity timer is currently active for the guild.
 */
export function hasInactivityTimer(guildId: string): boolean {
	return inactivityTimers.has(guildId);
}
