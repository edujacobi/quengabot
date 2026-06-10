import { Events, ActivityType, type Client } from "discord.js";
import { Log } from "../../utils/log.js";

export default {
	name: Events.ClientReady,
	once: true,
	execute(client: Client) {
		Log.Success(`[Bot] Logged in as ${client.user?.tag}!`);

		client.user?.setActivity("on quengaral", {
			type: ActivityType.Streaming,
			url: "https://www.twitch.tv/quengaral"
		});
		Log.Info("[Bot] Activity status set to Streaming on quengaral.");
	}
};
