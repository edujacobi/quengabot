import { Events, type Interaction, type GuildMember, type GuildTextBasedChannel } from "discord.js";
import { SimpleContainerBuilder } from "../../utils/CustomContainerBuilder.js";
import { replyWithContainer } from "../../utils/discordInteractions.js";
import { EmoteString } from "../../utils/emotes.js";
import { Log } from "../../utils/log.js";

export default {
	name: Events.InteractionCreate,
	once: false,
	async execute(interaction: Interaction) {
		// 1. Slash commands router
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);
			if (!command) return;

			try {
				await command.execute(interaction);
			}
			catch (err: unknown) {
				Log.Error(`[Bot] Error executing command ${interaction.commandName}: ` + (err instanceof Error ? err.message : ""));
				const container = new SimpleContainerBuilder(`${EmoteString.Error} An error occurred executing this command: ${(err as Error).message}`);

				await replyWithContainer(interaction, container, true);
			}
		}

		// 2. Dropdown select menu handler (search result picker)
		if (interaction.isStringSelectMenu()) {
			if (interaction.customId === "play_search_select") {
				const member = interaction.member as GuildMember;
				const notInVoiceChannel = !member.voice.channel;

				if (notInVoiceChannel) {
					const container = new SimpleContainerBuilder(`${EmoteString.Warning} You must be in a voice channel to play music.`);
					await replyWithContainer(interaction, container, true);
					return;
				}

				const botVoiceChannel = interaction.guild?.members.me?.voice.channel;
				const notInSameVoiceChannel = botVoiceChannel && botVoiceChannel.id !== member.voice.channel.id;

				if (notInSameVoiceChannel) {
					const container = new SimpleContainerBuilder(`${EmoteString.Warning} You must be in the same voice channel as the bot to play music.`);
					await replyWithContainer(interaction, container, true);
					return;
				}

				const funMessages = [
					"I think I have that in my CD collection",
					"One moment while I dust off my turntable...",
					"Let me check my mixtapes...",
					"Hold on, I'm checking my vinyl collection...",
					"I'm flipping through my cassettes...",
					"My neighbor must have it on vinyl...",
					"Let me check my MP3 player...",
					"I'm checking my iPod...",
					"Maybe it's in my Walkman..."
				];
				const randomMessage = funMessages[Math.floor(Math.random() * funMessages.length)];

				const container = new SimpleContainerBuilder(`${EmoteString.Search} **${randomMessage}**`);
				await replyWithContainer(interaction, container);

				try {
					const selectedUrl = interaction.values[0];

					await interaction.client.distube.play(member.voice.channel, selectedUrl, {
						member,
						textChannel: interaction.channel as GuildTextBasedChannel,
					});

					const container = new SimpleContainerBuilder(`${EmoteString.Add} **Got it! Adding to queue...**`);
					await replyWithContainer(interaction, container);
				}
				catch (err: unknown) {
					const error = err as Error;
					Log.Error("[SelectMenu] Error playing selection: " + error.message);

					const container = new SimpleContainerBuilder(`${EmoteString.Error} **Error:** ${error.message}`);
					await replyWithContainer(interaction, container, true);
				}
			}
		}
	}
};
