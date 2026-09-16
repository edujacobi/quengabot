import { Events, type VoiceState } from "discord.js";
import { startInactivityTimer, cancelInactivityTimer } from "../../utils/inactivityManager.js";
import { Log } from "../../utils/log.js";

export default {
	name: Events.VoiceStateUpdate,
	once: false,
	async execute(oldState: VoiceState, newState: VoiceState) {
		const guild = newState.guild || oldState.guild;
		const botMember = guild.members.me;
		const botVoiceChannel = botMember?.voice.channel;

		if (!botVoiceChannel) return;

		const humanMembers = botVoiceChannel.members.filter(member => !member.user.bot);
		const queue = oldState.client.distube.getQueue(guild.id);

		if (humanMembers.size === 0) {
			Log.Info(`[VoiceStateUpdate] Voice channel "${botVoiceChannel.name}" in guild ${guild.id} is now empty of users.`);
			startInactivityTimer(oldState.client, guild.id, queue?.textChannel, "Voice channel empty");
		}
		else if (queue && queue.playing) {
			cancelInactivityTimer(guild.id, "Users present and queue playing");
		}
	}
};
