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

				const container = new SimpleContainerBuilder(`${EmoteString.Search} **Processing your request...**`);
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
