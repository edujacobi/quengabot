import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder
} from "discord.js";
import { getPlayer } from "../music/player.js";
import { type Command } from "../types.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { checkVoiceState, replyWithContainer } from "../utils/discordInteractions.js";
import { EmoteString } from "../utils/emotes.js";

export const nextCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("next")
		.setDescription("Skip the currently playing song"),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!await checkVoiceState(interaction, true)) return;

		const player = getPlayer(interaction.guildId!);

		const skipped = player.Skip();

		const container = new SimpleContainerBuilder(
			skipped ?
				`${EmoteString.Skip} **Skipped the current track.**` :
				`${EmoteString.Info} **Nothing is currently playing.**`
		);

		await replyWithContainer(interaction, container);
	}
};
export default nextCommand;
