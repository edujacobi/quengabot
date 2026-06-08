import { GuildPlayer } from "./GuildPlayer.js";

let playerInstance: GuildPlayer | null = null;

/**
 * Returns the GuildPlayer instance, initializing it if it doesn't exist.
 * Moved to a standalone module to prevent circular dependency issues between index.ts and commands.
 */
export function getPlayer(guildId: string): GuildPlayer {
	if (!playerInstance) {
		playerInstance = new GuildPlayer(guildId);
	}
	return playerInstance;
}
