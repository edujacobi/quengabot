import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	type CommandInteraction,
	ComponentType,
	type ContainerBuilder,
	type InteractionResponse,
	type Message,
	type MessageComponentInteraction,
	SectionBuilder,
	StringSelectMenuBuilder,
} from "discord.js";
import type { CustomContainerBuilder } from "./CustomContainerBuilder.js";
import { replyWithContainer } from "./discordInteractions.js";

/**
 * Creates a button interaction collector for a message.
 *
 * @param interaction - The original interaction.
 * @param response - The message or interaction response to collect from.
 * @param options - Optional settings for the collector (idleTime and maxClicks).
 * @returns The collector or undefined if response is missing.
 */
export function createButtonCollector(
	interaction: CommandInteraction | ButtonInteraction | MessageComponentInteraction,
	response: Message | InteractionResponse | undefined,
	options?: {
		idleTime?: number;
		maxClicks?: number;
	}
) {
	if (!response) {
		return;
	}

	return response.createMessageComponentCollector({
		filter: (i: MessageComponentInteraction) => i.user.id === interaction.user.id,
		componentType: ComponentType.Button,
		idle: options?.idleTime ?? 60_000,
		max: options?.maxClicks,
	});
}

/**
 * Creates a string select menu interaction collector for a message.
 *
 * @param interaction - The original interaction.
 * @param response - The message or interaction response to collect from.
 * @param idleTime - The idle time in milliseconds before the collector stops (default: 60_000).
 * @returns The collector or undefined if response is missing.
 */
export function createStringSelectCollector(interaction: CommandInteraction | ButtonInteraction | MessageComponentInteraction, response: Message | InteractionResponse | undefined, idleTime = 60_000) {
	if (!response) {
		return;
	}

	return response.createMessageComponentCollector({
		filter: (i: MessageComponentInteraction) => i.user.id === interaction.user.id,
		componentType: ComponentType.StringSelect,
		idle: idleTime,
	});
}

/**
 * Disables all buttons and select menus in a container and updates the interaction.
 *
 * @param interaction - The interaction to update.
 * @param container - The container with components to disable.
 */
export async function disableButtons(interaction: CommandInteraction | ButtonInteraction, container: ContainerBuilder | CustomContainerBuilder) {
	try {
		for (const component of container.components) {
			if (component instanceof SectionBuilder) {
				if (!component.accessory) {
					continue;
				}
				if (component.accessory.data.type === ComponentType.Button) {
					component.accessory.data.disabled = true;
				}
			}
			if (component instanceof ActionRowBuilder) {
				if (component.components.length === 0) {
					continue;
				}
				for (const c of component.components) {
					if (c instanceof ButtonBuilder || c instanceof StringSelectMenuBuilder) {
						c.setDisabled(true);
					}
				}
			}
		}

		await replyWithContainer(interaction, container);
	}
	catch (err) {
		console.warn(`Something went wrong with disabling buttons from container of user ${interaction.user.displayName} in server ${interaction.guild?.name} (Id: ${interaction.guild?.id}). Error: ${err}`);
	}
}