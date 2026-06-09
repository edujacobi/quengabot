import {
	type AudioPlayer,
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	type DiscordGatewayAdapterCreator,
	entersState,
	joinVoiceChannel,
	type StreamType,
	type VoiceConnection,
	VoiceConnectionDisconnectReason,
	VoiceConnectionStatus
} from "@discordjs/voice";
import { MessageFlags, type TextBasedChannel, type VoiceBasedChannel } from "discord.js";
import { type Track } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { getAudioStream } from "./resolver.js";

export class GuildPlayer {
	public readonly GuildId: string;
	private Queue: Track[] = [];
	private Current: Track | null = null;
	private Connection: VoiceConnection | null = null;
	private readonly Player: AudioPlayer;
	private TextChannel: TextBasedChannel | null = null;
	private DisconnectTimeout: NodeJS.Timeout | null = null;
	private IsProcessingQueue = false;

	constructor(guildId: string) {
		this.GuildId = guildId;

		// Create the audio player
		this.Player = createAudioPlayer();

		// Listen to player state changes
		this.Player.on(AudioPlayerStatus.Idle, () => {
			this.Current = null;
			this.PlayNext();
		});

		this.Player.on("error", (error) => {
			console.error(`[GuildPlayer] Audio Player Error:`, error);

			this.SendInChannel(`${EmoteString.Error} **Error playing "${this.Current?.title || "song"}":** ${error.message}`);

			this.Current = null;
			this.PlayNext();
		});
	}

	/**
	 * Get the current track list in the queue.
	 */
	public GetQueue(): Track[] {
		return [...this.Queue];
	}

	/**
	 * Get the currently playing track.
	 */
	public GetCurrentTrack(): Track | null {
		return this.Current;
	}

	/**
	 * Set the text channel for bot notifications.
	 */
	public SetTextChannel(channel: TextBasedChannel) {
		this.TextChannel = channel;
	}

	/**
	 * Connect to a voice channel.
	 */
	public Connect(voiceChannel: VoiceBasedChannel) {
		this.ClearDisconnectTimeout();

		const connection = joinVoiceChannel({
			channelId: voiceChannel.id,
			guildId: this.GuildId,
			adapterCreator: voiceChannel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
		});

		this.Connection = connection;
		connection.subscribe(this.Player);

		// Monitor connection states
		connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
			try {
				if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
					/*
						If the WebSocket closed with 4014, this means the bot was moved or kicked.
						Wait 500ms to see if we reconnect, otherwise destroy connection.
					*/
					try {
						await entersState(connection, VoiceConnectionStatus.Connecting, 500);
					}
					catch {
						this.Leave();
					}
				}
				else if (connection.rejoinAttempts < 5) {
					/*
						If the disconnect was accidental, try to reconnect.
					*/
					await new Promise((resolve) => setTimeout(resolve, 5_000));
					connection.rejoin();
				}
				else {
					this.Leave();
				}
			}
			catch (err) {
				console.error("[GuildPlayer] Error handling disconnect:", err);
				this.Leave();
			}
		});

		connection.on(VoiceConnectionStatus.Destroyed, () => {
			this.Connection = null;
			this.Queue = [];
			this.Current = null;
			this.Player.stop(true);
			this.ClearDisconnectTimeout();
		});
	}

	/**
	 * Add a track or a list of tracks to the queue.
	 */
	public async Add(tracks: Track | Track[]) {
		this.ClearDisconnectTimeout();

		if (Array.isArray(tracks)) {
			this.Queue.push(...tracks);
		}
		else {
			this.Queue.push(tracks);
		}

		// Play if not playing anything
		if (!this.Current && this.Player.state.status === AudioPlayerStatus.Idle) {
			await this.PlayNext();
		}
	}

	/**
	 * Plays the next song in the queue.
	 */
	private async PlayNext() {
		if (this.IsProcessingQueue) return;
		this.IsProcessingQueue = true;

		try {
			if (this.Queue.length === 0) {
				this.Current = null;
				this.StartDisconnectTimeout();
				this.IsProcessingQueue = false;
				return;
			}

			this.ClearDisconnectTimeout();

			// Retrieve the next track
			const nextTrack = this.Queue.shift();
			if (!nextTrack) {
				this.IsProcessingQueue = false;
				return;
			}

			this.Current = nextTrack;

			// Lazy resolve the audio stream
			const { stream, type } = await getAudioStream(nextTrack);
			const resource = createAudioResource(stream, { inputType: type as StreamType });

			this.SendInChannel(`${EmoteString.NowPlaying} **Now playing:** **[${nextTrack.title}](${nextTrack.url})** by ${nextTrack.artist}\n-# requested by <@${nextTrack.requestedBy}>`);

			this.Player.play(resource);
		}
		catch (err: unknown) {
			const error = err as Error;
			console.error("[GuildPlayer] Error in playNext:", error);

			this.SendInChannel(`${EmoteString.Error} **Failed to play track:** ${error.message}`);

			this.Current = null;
			this.IsProcessingQueue = false;
			// Skip to next track
			this.PlayNext();
			return;
		}

		this.IsProcessingQueue = false;
	}

	/**
	 * Pause the audio player.
	 */
	public Pause(): boolean {
		if (this.Player.state.status === AudioPlayerStatus.Playing) {
			return this.Player.pause();
		}
		return false;
	}

	/**
	 * Resume the audio player.
	 */
	public Resume(): boolean {
		if (this.Player.state.status === AudioPlayerStatus.Paused) {
			return this.Player.unpause();
		}
		return false;
	}

	/**
	 * Get the current status of the audio player.
	 */
	public GetStatus(): AudioPlayerStatus {
		return this.Player.state.status;
	}

	/**
	 * Skip the current song.
	 */
	public Skip(): boolean {
		if (this.Current || this.Player.state.status !== AudioPlayerStatus.Idle) {
			// Stopping the player triggers the 'Idle' state listener which calls playNext()
			this.Player.stop(true);
			return true;
		}
		return false;
	}

	/**
	 * Remove a track from the queue by its index.
	 */
	public Remove(index: number): Track | null {
		if (index < 0 || index >= this.Queue.length) {
			return null;
		}
		const removed = this.Queue.splice(index, 1);
		return removed[0] || null;
	}

	/**
	 * Stop playback, disconnect, and clear resources.
	 */
	public Leave() {
		this.Queue = [];
		this.Current = null;
		this.Player.stop(true);
		this.ClearDisconnectTimeout();

		if (this.Connection) {
			try {
				this.Connection.destroy();
			}
			catch (err) {
				console.error("[GuildPlayer] Error destroying connection:", err);
			}
			this.Connection = null;
		}
	}

	/**
	 * Start 5-minute inactivity timeout.
	 */
	private StartDisconnectTimeout() {
		this.ClearDisconnectTimeout();
		this.DisconnectTimeout = setTimeout(() => {
			this.SendInChannel(`${EmoteString.Heart} **Leaving voice channel due to inactivity.**`);
			this.Leave();
		}, 5 * 60 * 1_000); // 5 minutes
	}

	/**
	 * Cancel the inactivity timeout.
	 */
	private ClearDisconnectTimeout() {
		if (this.DisconnectTimeout) {
			clearTimeout(this.DisconnectTimeout);
			this.DisconnectTimeout = null;
		}
	}

	private SendInChannel(message: string) {
		if (!this.TextChannel || !("send" in this.TextChannel)) return;

		const container = new SimpleContainerBuilder(message);

		try {
			this.TextChannel.send({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		}
		catch (err) {
			console.error("[GuildPlayer] Error sending message:", err);
		}
	}
}
