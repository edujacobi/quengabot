import { SlashCommandBuilder, type Attachment, type ChatInputCommandInteraction, type Message } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { type Command } from "../types.js";
import { CommandContext } from "../utils/commandContext.js";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder.js";
import { EmoteString } from "../utils/emotes.js";
import { Log } from "../utils/log.js";

export const setcookieCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("setcookie")
		.setDescription("Update YouTube cookies for the bot (Owner only)")
		.addAttachmentOption(option => option
			.setName("file")
			.setDescription("The exported cookies file (.txt or .cookie)")
			.setRequired(false)
		)
		.addStringOption(option => option
			.setName("text")
			.setDescription("The raw cookie content")
			.setRequired(false)
		),

	async execute(interaction) {
		const ctx = new CommandContext(interaction);
		const ownerId = process.env.OWNER_ID || "332228051871989761";
		if (interaction.user.id !== ownerId) {
			const container = new SimpleContainerBuilder(`${EmoteString.Error} **You do not have permission to use this command.**`);
			await ctx.reply(container, true);
			return;
		}

		const attachment = interaction.options.getAttachment("file");
		const text = interaction.options.getString("text");

		await handleUpdate(ctx, attachment, text, true);
	},

	async executePrefix(message, args) {
		const ctx = new CommandContext(message);
		const ownerId = process.env.OWNER_ID || "332228051871989761";
		if (message.author.id !== ownerId) {
			const container = new SimpleContainerBuilder(`${EmoteString.Error} **You do not have permission to use this command.**`);
			await ctx.reply(container);
			return;
		}

		// Try to delete the user's message immediately to protect cookie secrets
		try {
			if (message.deletable) {
				await message.delete();
			}
		}
		catch (err) {
			Log.Warning("[SetCookie] Failed to delete user message: " + (err instanceof Error ? err.message : ""));
		}

		const attachment = message.attachments.first() || null;
		const text = args ? args.join(" ") : null;

		await handleUpdate(ctx, attachment, text, false);
	}
};

function normalizeNetscapeCookies(content: string): string {
	const lines = content.split(/\r?\n/);
	const normalizedLines = lines.map(line => {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			return line;
		}
		const parts = trimmed.split(/\s+/);
		if (parts.length >= 7) {
			const domain = parts[0];
			const isHttpOnly = parts[1];
			const path = parts[2];
			const isSecure = parts[3];
			const expiry = parts[4];
			const name = parts[5];
			const value = parts.slice(6).join(" ");
			return `${domain}\t${isHttpOnly}\t${path}\t${isSecure}\t${expiry}\t${name}\t${value}`;
		}
		return line;
	});
	return normalizedLines.join("\n");
}

async function handleUpdate(ctx: CommandContext, attachment: Attachment | null, text: string | null, isEphemeral: boolean) {
	let cookieContent = "";

	try {
		if (attachment) {
			const response = await fetch(attachment.url);
			if (!response.ok) {
				throw new Error(`Failed to download attachment: ${response.statusText}`);
			}
			cookieContent = await response.text();
		}
		else if (text) {
			cookieContent = text.trim();
		}
		else {
			const container = new SimpleContainerBuilder(`${EmoteString.Error} **Please provide either a file attachment or raw text.**`);
			await ctx.reply(container, isEphemeral);
			return;
		}

		if (!cookieContent || cookieContent.length < 10) {
			throw new Error("Cookie content is empty or too short.");
		}

		const cookieFile = process.env.YTDLP_COOKIES_FILE || "Jacobi.cookie";
		const cookieDir = path.dirname(cookieFile);
		if (!fs.existsSync(cookieDir)) {
			fs.mkdirSync(cookieDir, { recursive: true });
		}
		
		const normalizedContent = normalizeNetscapeCookies(cookieContent);
		fs.writeFileSync(cookieFile, normalizedContent, "utf8");

		const userTag = ctx.isInteraction
			? (ctx.source as ChatInputCommandInteraction).user.tag
			: (ctx.source as Message).author.tag;

		Log.Info(`[SetCookie] YouTube cookies updated successfully by ${userTag}. Saved to ${cookieFile}`);

		const container = new SimpleContainerBuilder(`✅ **YouTube cookies updated successfully!**`);
		await ctx.reply(container, isEphemeral);
	}
	catch (err) {
		const msg = err instanceof Error ? err.message : "Unknown error";
		Log.Error(`[SetCookie] Failed to update cookies: ${msg}`);
		const container = new SimpleContainerBuilder(`${EmoteString.Error} **Failed to update cookies:** ${msg}`);
		await ctx.reply(container, isEphemeral);
	}
}

export default setcookieCommand;
