import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required in .env'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required in .env'),
  DISCORD_GUILD_ID: z.string().optional(),

  LIBRESPOT_PATH: z.string().default('librespot'),
  LIBRESPOT_DEVICE_NAME_PREFIX: z.string().default('Discord Voice'),
  LIBRESPOT_BITRATE: z.enum(['96', '160', '320']).default('160'),
  LIBRESPOT_INITIAL_VOLUME: z.coerce.number().int().min(0).max(100).default(100),
  LIBRESPOT_CACHE_DIR: z.string().default('./cache/librespot'),

  SPOTIFY_USERNAME: z.string().optional(),
  SPOTIFY_PASSWORD: z.string().optional(),
  ENABLE_DISCOVERY: z
    .string()
    .optional()
    .transform((val) => (val ? val.toLowerCase() === 'true' : true)),

  AUTO_DISCONNECT_EMPTY_TIMEOUT: z.coerce.number().int().min(0).default(60),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof envSchema>;

let parsedConfig: Config;

try {
  parsedConfig = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const errorDetails = error.issues
      .map((issue) => ` - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.warn(`[Config Warning] Environment variables validation issue:\n${errorDetails}`);
  }
  // Provide safe fallback defaults for scaffolding/dev mode if token is missing
  parsedConfig = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    LIBRESPOT_PATH: process.env.LIBRESPOT_PATH || 'librespot',
    LIBRESPOT_DEVICE_NAME_PREFIX: process.env.LIBRESPOT_DEVICE_NAME_PREFIX || 'Discord Voice',
    LIBRESPOT_BITRATE: (process.env.LIBRESPOT_BITRATE as '96' | '160' | '320') || '160',
    LIBRESPOT_INITIAL_VOLUME: Number(process.env.LIBRESPOT_INITIAL_VOLUME) || 100,
    LIBRESPOT_CACHE_DIR: process.env.LIBRESPOT_CACHE_DIR || './cache/librespot',
    SPOTIFY_USERNAME: process.env.SPOTIFY_USERNAME,
    SPOTIFY_PASSWORD: process.env.SPOTIFY_PASSWORD,
    ENABLE_DISCOVERY: process.env.ENABLE_DISCOVERY !== 'false',
    AUTO_DISCONNECT_EMPTY_TIMEOUT: Number(process.env.AUTO_DISCONNECT_EMPTY_TIMEOUT) || 60,
    LOG_LEVEL: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
  };
}

// Resolve absolute path for cache directory
parsedConfig.LIBRESPOT_CACHE_DIR = path.resolve(process.cwd(), parsedConfig.LIBRESPOT_CACHE_DIR);

export const config = parsedConfig;

export const AUDIO_CONSTANTS = {
  // Librespot raw PCM parameters
  LIBRESPOT_SAMPLE_RATE: 44100,
  LIBRESPOT_CHANNELS: 2,
  LIBRESPOT_BIT_DEPTH: 16,

  // Discord target audio parameters
  DISCORD_SAMPLE_RATE: 48000,
  DISCORD_CHANNELS: 2,
  DISCORD_BIT_DEPTH: 16,
  DISCORD_FRAME_DURATION_MS: 20, // 20ms frames standard in Opus
} as const;
