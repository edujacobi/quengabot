import {
	type ChatInputCommandInteraction,
	Message,
	type GuildMember,
	type GuildTextBasedChannel,
	type Client
} from "discord.js";
import { type CustomContainerBuilder, type SimpleContainerBuilder } from "./CustomContainerBuilder.js";
import {
	checkVoiceState,
	checkVoiceStateForMessage,
	replyWithContainer,
	replyMessageWithContainer,
	deferReply,
	editMessageWithContainer
} from "./discordInteractions.js";

export class CommandContext {
	public readonly isInteraction: boolean;
	public readonly guildId: string;
	public readonly member: GuildMember;
	public readonly channel: GuildTextBasedChannel;
	public readonly client: Client;
	private replyMessage?: Message;

	constructor(public readonly source: ChatInputCommandInteraction | Message) {
		this.isInteraction = !(source instanceof Message);
		this.guildId = source.guildId!;
		this.member = source.member as GuildMember;
		this.channel = source.channel as GuildTextBasedChannel;
		this.client = source.client;
	}

	async checkVoice(requireBotConnected = false): Promise<boolean> {
		if (this.isInteraction) {
			return await checkVoiceState(this.source as ChatInputCommandInteraction, requireBotConnected);
		}
		else {
			return await checkVoiceStateForMessage(this.source as Message, requireBotConnected);
		}
	}

	async reply(container: CustomContainerBuilder | SimpleContainerBuilder, ephemeral = false) {
		if (this.isInteraction) {
			return await replyWithContainer(this.source as ChatInputCommandInteraction, container, ephemeral);
		}
		else {
			if (this.replyMessage) {
				return await editMessageWithContainer(this.replyMessage, container);
			}
			this.replyMessage = await replyMessageWithContainer(this.source as Message, container);
			return this.replyMessage;
		}
	}

	async defer(): Promise<void> {
		if (this.isInteraction) {
			await deferReply(this.source as ChatInputCommandInteraction);
		}
	}
}
