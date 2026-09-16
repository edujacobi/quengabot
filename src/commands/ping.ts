import { SlashCommandBuilder } from "discord.js";
import { type Command } from "../types.js";
import { CommandContext } from "../utils/commandContext";
import { SimpleContainerBuilder } from "../utils/CustomContainerBuilder";
import { EmoteString } from "../utils/emotes";


export const pingCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with Pong!"),

    async execute(interaction) {
        await handlePing(new CommandContext(interaction));
    },
    async executePrefix(message) {
        await handlePing(new CommandContext(message));
    }
};

async function handlePing(ctx: CommandContext) {
    const botPing = Math.round(ctx.client.ws.ping);
    const svPing = new Date().getTime();

    const container = new SimpleContainerBuilder(
        `${EmoteString.Info} **Pong!**`
    );

    await ctx.reply(container);

    const container2 = new SimpleContainerBuilder(
        `${EmoteString.Info} **Pong!** ${botPing}ms API. ${Math.round(new Date().getTime() - svPing)}ms Server.`
    );

    return ctx.reply(container2);
}

export default pingCommand;