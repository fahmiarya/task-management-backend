import process from "node:process";
import type { StringValue } from "ms";
import { z } from "zod/v4";

const zodConfigObject = {
	JWT_SECRET: z.string().min(32),

	JWT_EXPIRES_IN: z
		.string()
		.default("1d")
		.transform((value) => value as StringValue),

	DATABASE_URL: z.string(),

	NODE_ENV: z.string().default("development"),

	API_PORT: z
		.string()
		.default("3000")
		.transform((v) => Number.parseInt(v, 10)),

	SOCIAL_LOGIN_ENABLED: z.boolean().default(false),
	TRUSTED_ORIGINS: z.string().default("*"),
	CORS_ORIGIN: z.string().default("*"),
};

const configSchema = z.object(zodConfigObject);

const parsedConfig = configSchema.parse(process.env);

const appConfig = {
	...parsedConfig,

	TRUSTED_ORIGINS: parsedConfig.TRUSTED_ORIGINS.includes(",")
		? parsedConfig.TRUSTED_ORIGINS.split(",").map((origin) => origin.trim())
		: [parsedConfig.TRUSTED_ORIGINS],

	CORS_ORIGIN: parsedConfig.CORS_ORIGIN,
};

type Config = typeof appConfig;

export const config: Config = appConfig;
