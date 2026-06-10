import pino from "pino";

export const logger = pino({
	transport: {
		target: "pino-pretty",
		options: {
			colorize: true,
		},
	},
	formatters: {
		level: (label) => {
			return {
				level: label,
			};
		},
	},
});

export enum LogType {
	Info,
	Warning,
	Error,
	Success
}

export class Log {
	Message: string;
	Type: LogType;

	constructor(type: LogType, message: string) {
		this.Type = type;
		this.Message = message;

		switch (this.Type) {
		case LogType.Info:
			logger.info(`\x1b[34m${message}\x1b[0m`);
			break;

		case LogType.Warning:
			logger.warn(`\x1b[33m${message}\x1b[0m`);
			break;

		case LogType.Error:
			logger.error(`\x1b[31m${message}\x1b[0m`);
			break;

		case LogType.Success:
			logger.info(`\x1b[32m${message}\x1b[0m`);
			break;
		}
	}

	static Info(message: string) {
		return new Log(LogType.Info, message);
	}

	static Warning(message: string) {
		return new Log(LogType.Warning, message);
	}

	static Error(message: string) {
		return new Log(LogType.Error, message);
	}

	static Success(message: string) {
		return new Log(LogType.Success, message);
	}
}
