import { Events, type Client } from "discord.js";
import { Log } from "../../utils/log.js";

export default {
	name: Events.ClientReady,
	once: true,
	execute(client: Client) {
		Log.Info(`[Bot] Logged in as ${client.user?.tag}!`);
	}
};
