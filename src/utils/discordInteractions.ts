import { ButtonInteraction, MessageComponentInteraction, MessageFlags, type CommandInteraction, type ContainerBuilder, type DiscordAPIError, type GuildMember, type InteractionEditReplyOptions, type InteractionReplyOptions, type Message, type MessagePayload } from "discord.js";
import { SimpleContainerBuilder, type CustomContainerBuilder } from "./CustomContainerBuilder";
import { EmoteString } from "./emotes";

/**
 * Replies to an interaction, handling deferred or already replied states.
 *
 * @param interaction - The interaction to reply to.
 * @param options - The reply options.
 * @returns The reply message or undefined if an error occurs.
 */
export async function replyInteraction(interaction: CommandInteraction | ButtonInteraction | MessageComponentInteraction, options: string | MessagePayload | InteractionReplyOptions | InteractionEditReplyOptions) {
	try {
		if (interaction instanceof ButtonInteraction) {
			if (interaction.replied || interaction.deferred) {
				return await interaction.followUp(options as InteractionReplyOptions);
			}
			return await interaction.reply(options as InteractionReplyOptions);
		}
		if (interaction.replied || interaction.deferred) {
			return await interaction.editReply(options as InteractionEditReplyOptions);
		}
		if (interaction instanceof MessageComponentInteraction) {
			return await interaction.update(options as InteractionEditReplyOptions);
		}

		return await interaction.reply(options as InteractionReplyOptions);
	}
	catch (err) {
		const error = err as DiscordAPIError;
		console.debug(error);

		const context = "commandName" in interaction ? `/${interaction.commandName}` : ("customId" in interaction ? `Component: ${interaction.customId}` : "Unknown Context");

		// Handle specific Discord errors gracefully (Console only)
		if (error.code === 10_008) {
			console.warn(`[CONSOLE] Interaction reply failed: Deleted Message (Code 10008) [${context}] for user ${interaction.user.displayName} (Id: ${interaction.user.id}) in server ${interaction.guild?.name} (Id: ${interaction.guild?.id}).`);
			return;
		}

		if (error.code === 10_062) {
			console.warn(`[CONSOLE] Interaction reply failed: Unknown Interaction (Code 10062) [${context}] for user ${interaction.user.displayName} (Id: ${interaction.user.id}) in server ${interaction.guild?.name} (Id: ${interaction.guild?.id}).`);
			return;
		}

		if (error.code === 50_027) {
			console.warn(`[CONSOLE] Interaction reply failed: Token Expired (Code 50027) [${context}] for user ${interaction.user.displayName} (Id: ${interaction.user.id}) in server ${interaction.guild?.name} (Id: ${interaction.guild?.id}).`);
			return;
		}

		if (error.name === "AbortError") {
			console.warn(`[CONSOLE] Interaction reply timed out (AbortError) [${context}] for user ${interaction.user.displayName} (Id: ${interaction.user.id}) in server ${interaction.guild?.name} (Id: ${interaction.guild?.id}). This is usually a temporary Discord API or network issue.`);
			return;
		}

		console.warn(`Something went wrong with replying interaction of user ${interaction.user.displayName} (Id: ${interaction.user.id}) [${context}] in server ${interaction.guild?.name} (Id: ${interaction.guild?.id}). Error: ${error.message}`);
	}
}

/**
 * Replies to an interaction with a custom container (UI).
 *
 * @param interaction - The interaction to reply to.
 * @param container - The container builder with components.
 * @param ephemeral - Whether the reply should be ephemeral (default: false).
 * @returns The reply message.
 */
export async function replyWithContainer(interaction: CommandInteraction | ButtonInteraction | MessageComponentInteraction, container: CustomContainerBuilder | ContainerBuilder, ephemeral = false) {
	return await replyInteraction(interaction, {
		components: [container],
		flags: ephemeral ?
			[MessageFlags.IsComponentsV2, MessageFlags.Ephemeral, MessageFlags.SuppressNotifications] :
			[MessageFlags.IsComponentsV2, MessageFlags.SuppressNotifications],
	});
}

/**
 * Defers the reply to an interaction if it hasn't been deferred already.
 *
 * @param interaction - The interaction to defer.
 */
export async function deferReply(interaction: CommandInteraction | ButtonInteraction | MessageComponentInteraction) {
	try {
		if (interaction.deferred) {
			return;
		}
		await interaction.deferReply();
	}
	catch (err) {
		const error = err as Error;
		if (error.name === "AbortError") {
			console.warn(`Deferring reply timed out (AbortError) for interaction ${interaction.id} of user ${interaction.user.displayName}.`);
			return;
		}
		console.warn(`Something went wrong with deferring interaction ${interaction.id} of user ${interaction.user.displayName} in server ${interaction.guild?.name} (Id: ${interaction.guild?.id}). Error: ${err}`);
	}
}

/**
 * Defers the update to an interaction if it hasn't been deferred already.
 *
 * @param interaction - The interaction to defer.
 */
export async function deferUpdate(interaction: ButtonInteraction | MessageComponentInteraction) {
	try {
		if (interaction.deferred) {
			return;
		}
		await interaction.deferUpdate();
	}
	catch (err) {
		const error = err as Error;
		if (error.name === "AbortError") {
			console.warn(`Deferring update timed out (AbortError) for interaction ${interaction.id} of user ${interaction.user.displayName}.`);
			return;
		}
		// logger.warn(`[CONSOLE] Something went wrong with deferring interaction ${interaction.id} of user ${interaction.user.displayName} in server ${interaction.guild?.name} (Id: ${interaction.guild?.id}). Error: ${err}`);
	}
}

/**
 * Validates the voice state of the caller and the bot.
 *
 * @param interaction - The command interaction.
 * @param requireBotConnected - Whether the bot must be connected to a voice channel.
 * @returns True if voice state is valid and action can proceed, false otherwise.
 */
export async function checkVoiceState(
	interaction: CommandInteraction,
	requireBotConnected = false
): Promise<boolean> {
	const member = interaction.member as GuildMember;

	if (!member.voice.channel) {
		const container = new SimpleContainerBuilder(`${EmoteString.Error} You must be in a voice channel to run this command.`);
		await replyWithContainer(interaction, container, true);
		return false;
	}

	const botVoiceChannel = interaction.guild?.members.me?.voice.channel;

	if (requireBotConnected && !botVoiceChannel) {
		const container = new SimpleContainerBuilder(`${EmoteString.Error} The bot is not currently connected to any voice channel.`);
		await replyWithContainer(interaction, container, true);
		return false;
	}

	if (botVoiceChannel && botVoiceChannel.id !== member.voice.channel.id) {
		const container = new SimpleContainerBuilder(`${EmoteString.Error} You must be in the same voice channel as the bot (<#${botVoiceChannel.id}>) to run this command.`);
		await replyWithContainer(interaction, container, true);
		return false;
	}

	return true;
}

/**
 * Replies to a message with a custom container (UI).
 *
 * @param message - The message to reply to.
 * @param container - The container builder with components.
 * @returns The reply message.
 */
export async function replyMessageWithContainer(message: Message, container: CustomContainerBuilder | ContainerBuilder) {
	return await message.reply({
		components: [container],
		flags: [MessageFlags.IsComponentsV2, MessageFlags.SuppressNotifications],
	});
}

/**
 * Validates the voice state of the caller and the bot for a message.
 *
 * @param message - The message object.
 * @param requireBotConnected - Whether the bot must be connected to a voice channel.
 * @returns True if voice state is valid and action can proceed, false otherwise.
 */
export async function checkVoiceStateForMessage(
	message: Message,
	requireBotConnected = false
): Promise<boolean> {
	const member = message.member!;

	if (!member.voice.channel) {
		const container = new SimpleContainerBuilder(`${EmoteString.Error} You must be in a voice channel to run this command.`);
		await replyMessageWithContainer(message, container);
		return false;
	}

	const botVoiceChannel = message.guild?.members.me?.voice.channel;

	if (requireBotConnected && !botVoiceChannel) {
		const container = new SimpleContainerBuilder(`${EmoteString.Error} The bot is not currently connected to any voice channel.`);
		await replyMessageWithContainer(message, container);
		return false;
	}

	if (botVoiceChannel && botVoiceChannel.id !== member.voice.channel.id) {
		const container = new SimpleContainerBuilder(`${EmoteString.Error} You must be in the same voice channel as the bot (<#${botVoiceChannel.id}>) to run this command.`);
		await replyMessageWithContainer(message, container);
		return false;
	}

	return true;
}