import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { CustomContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { ImageUrls } from "../utils/imageUrls.js";
import { CommandContext } from "../utils/commandContext.js";

export const nowplayingCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("nowplaying")
		.setDescription("Show details of the song currently playing"),

	aliases: ["np"],

	async execute(interaction) {
		await handleNowplaying(new CommandContext(interaction));
	},

	async executePrefix(message) {
		await handleNowplaying(new CommandContext(message));
	}
};

async function handleNowplaying(ctx: CommandContext) {
	const queue = ctx.client.distube.getQueue(ctx.guildId);
	const current = queue?.songs[0] ?? null;

	const container = new CustomContainerBuilder();

	if (!current) {
		container.addTexts([`${EmoteString.Info} **Nothing is currently playing.**`]);
		await ctx.reply(container);
		return;
	}

	container
		.addTexts([`### ${EmoteString.NowPlaying} Now Playing`])
		.addLargeSeparator()
		.addSectionComponents(section => section
			.addTexts([
				`## [${current.name}](${current.url})`,
				`${current.uploader?.name || "Unknown"}`,
				`-# \`${current.formattedDuration || "?"}\``,
			])
			.setThumbnailAccessory(thumb => thumb
				.setURL(current.thumbnail || ImageUrls.NoThumbnail)
			)
		)
		.addFooter({
			text: `requested by <@${current.user?.id || "Unknown"}>`,
		});

	await ctx.reply(container);
}

export default nowplayingCommand;
