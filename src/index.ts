import { createBotClient } from './bot/client.js';
import { config } from './config/env.js';
import { SessionManager } from './bot/sessionManager.js';

async function bootstrap() {
  console.log('==================================================');
  console.log('   Spotify Connect Discord Bot - Starting Up      ');
  console.log('==================================================');
  console.log(`Node.js Version: ${process.version}`);
  console.log(`Bitrate: ${config.LIBRESPOT_BITRATE} kbps`);
  console.log(`Auto Disconnect Empty: ${config.AUTO_DISCONNECT_EMPTY_TIMEOUT}s`);
  console.log(`Librespot Binary: ${config.LIBRESPOT_PATH}`);

  if (!config.DISCORD_TOKEN) {
    console.error(
      '❌ ERROR: DISCORD_TOKEN is missing! Please provide a valid bot token in .env file.'
    );
    process.exit(1);
  }

  const client = createBotClient();

  const shutdown = async (signal: string) => {
    console.log(`\n[Main] Caught ${signal}. Commencing graceful shutdown...`);
    try {
      await SessionManager.getInstance().destroyAll();
      client.destroy();
      console.log('[Main] Shutdown completed cleanly.');
      process.exit(0);
    } catch (error) {
      console.error('[Main] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Main] Unhandled Promise Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('[Main] Uncaught Exception:', error);
  });

  try {
    console.log('[Main] Logging in to Discord...');
    await client.login(config.DISCORD_TOKEN);
  } catch (error) {
    console.error('[Main] Failed to login to Discord:', error);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('[Main] Fatal bootstrap failure:', err);
  process.exit(1);
});
