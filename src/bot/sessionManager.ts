import {
  entersState,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { VoiceBasedChannel } from 'discord.js';
import { LibrespotManager } from '../librespot/librespotManager.js';
import { AudioBridge } from '../audio/audioBridge.js';
import { config } from '../config/env.js';
import { QueueManager } from './queueManager.js';

export interface GuildSession {
  guildId: string;
  channelId: string;
  channelName: string;
  connection: VoiceConnection;
  librespot: LibrespotManager | null;
  audioBridge: AudioBridge;
  mode: 'spotify' | 'queue';
  emptyTimeout: NodeJS.Timeout | null;
  startedAt: Date;
}

export class SessionManager {
  private static instance: SessionManager;
  private sessions = new Map<string, GuildSession>();

  private constructor() {
    // Process exit handlers to ensure all child processes are killed cleanly
    const shutdown = async (signal: string) => {
      console.log(`[SessionManager] Received ${signal}. Cleaning up all sessions...`);
      await this.destroyAll();
      process.exit(0);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public getSession(guildId: string): GuildSession | undefined {
    return this.sessions.get(guildId);
  }

  public hasSession(guildId: string): boolean {
    return this.sessions.has(guildId);
  }

  public getAllSessions(): GuildSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Helper to set up voice connection event listeners.
   */
  private setupConnectionListeners(connection: VoiceConnection, guildId: string): void {
    connection.on('stateChange', (oldState, newState) => {
      console.log(`[VoiceConnection:${guildId}] ${oldState.status} -> ${newState.status}`);
    });

    connection.on('error', (err) => {
      console.error(`[VoiceConnection:${guildId}] error:`, err);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        console.log(
          `[SessionManager] Voice connection disconnected permanently for guild ${guildId}`
        );
        await this.destroySession(guildId);
      }
    });
  }

  /**
   * Creates or switches to a Spotify Connect session in a Discord voice channel.
   */
  public async createSession(channel: VoiceBasedChannel): Promise<GuildSession> {
    const guildId = channel.guild.id;
    let session = this.sessions.get(guildId);

    if (session) {
      // If switching from queue mode, stop queue
      QueueManager.getInstance().destroyQueue(guildId);
      session.audioBridge.stopPlayback();

      // If previous Librespot was active, stop it
      if (session.librespot) {
        await session.librespot.stop().catch(() => {});
        session.librespot = null;
      }

      // If user is in a different voice channel, move connection
      if (session.channelId !== channel.id) {
        session.connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: false,
        });
        session.channelId = channel.id;
        session.channelName = channel.name;
        await entersState(session.connection, VoiceConnectionStatus.Ready, 15_000);
      }
    } else {
      console.log(`[SessionManager] Joining voice channel: "${channel.name}" (${channel.id})`);
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      this.setupConnectionListeners(connection, guildId);

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
        console.log(`[SessionManager] Voice connection ready for guild ${guildId}`);
      } catch (err) {
        connection.destroy();
        throw new Error(`Failed to establish voice connection: ${err}`);
      }

      const audioBridge = new AudioBridge(connection);

      session = {
        guildId,
        channelId: channel.id,
        channelName: channel.name,
        connection,
        librespot: null,
        audioBridge,
        mode: 'spotify',
        emptyTimeout: null,
        startedAt: new Date(),
      };
      this.sessions.set(guildId, session);
    }

    // Initialize & start Librespot
    const deviceName = `${config.LIBRESPOT_DEVICE_NAME_PREFIX} - ${channel.guild.name.slice(0, 20)}`;
    const librespot = new LibrespotManager({
      guildId,
      deviceName,
      bitrate: config.LIBRESPOT_BITRATE,
      initialVolume: config.LIBRESPOT_INITIAL_VOLUME,
    });

    librespot.on('volume', (vol) => {
      session?.audioBridge.setVolume(vol);
    });

    const pcmStream = await librespot.start();
    session.audioBridge.playPcmStream(pcmStream);

    librespot.on('exit', (code, signal) => {
      console.warn(
        `[SessionManager] Librespot process exited (code=${code}, signal=${signal}) for guild ${guildId}`
      );
      if (this.sessions.has(guildId) && session?.mode === 'spotify') {
        this.destroySession(guildId).catch((err) =>
          console.error('[SessionManager] Error during cleanup after exit:', err)
        );
      }
    });

    session.mode = 'spotify';
    session.librespot = librespot;
    return session;
  }

  /**
   * Retrieves an existing session or joins voice for a music queue (/play) session.
   */
  public async getOrCreateQueueSession(channel: VoiceBasedChannel): Promise<GuildSession> {
    const guildId = channel.guild.id;
    let session = this.sessions.get(guildId);

    if (session) {
      // If switching from Spotify Connect mode, stop Librespot
      if (session.mode === 'spotify' && session.librespot) {
        await session.librespot.stop().catch(() => {});
        session.librespot = null;
        session.audioBridge.stopPlayback();
      }
      session.mode = 'queue';

      // If user is in a different voice channel, move
      if (session.channelId !== channel.id) {
        session.connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: false,
        });
        session.channelId = channel.id;
        session.channelName = channel.name;
        await entersState(session.connection, VoiceConnectionStatus.Ready, 15_000);
      }

      return session;
    }

    console.log(`[SessionManager] Joining voice channel for Queue: "${channel.name}" (${channel.id})`);
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    this.setupConnectionListeners(connection, guildId);

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      console.log(`[SessionManager] Voice connection ready for guild ${guildId}`);
    } catch (err) {
      connection.destroy();
      throw new Error(`Failed to establish voice connection: ${err}`);
    }

    const audioBridge = new AudioBridge(connection);

    session = {
      guildId,
      channelId: channel.id,
      channelName: channel.name,
      connection,
      librespot: null,
      audioBridge,
      mode: 'queue',
      emptyTimeout: null,
      startedAt: new Date(),
    };

    this.sessions.set(guildId, session);
    return session;
  }

  /**
   * Destroys and cleans up a specific guild session.
   */
  public async destroySession(guildId: string): Promise<boolean> {
    const session = this.sessions.get(guildId);
    if (!session) return false;

    console.log(`[SessionManager] Destroying session for guild ${guildId}...`);

    if (session.emptyTimeout) {
      clearTimeout(session.emptyTimeout);
      session.emptyTimeout = null;
    }

    QueueManager.getInstance().destroyQueue(guildId);

    try {
      session.audioBridge.destroy();
    } catch (err) {
      console.warn('[SessionManager] Error destroying AudioBridge:', err);
    }

    if (session.librespot) {
      try {
        await session.librespot.stop();
      } catch (err) {
        console.warn('[SessionManager] Error stopping Librespot:', err);
      }
      session.librespot = null;
    }

    try {
      if (session.connection.state.status !== VoiceConnectionStatus.Destroyed) {
        session.connection.destroy();
      }
    } catch (err) {
      console.warn('[SessionManager] Error destroying voice connection:', err);
    }

    this.sessions.delete(guildId);
    console.log(`[SessionManager] Session destroyed for guild ${guildId}`);
    return true;
  }

  /**
   * Resets or cancels empty channel timeout for a guild.
   */
  public handleEmptyChannel(guildId: string, isEmpty: boolean): void {
    const session = this.sessions.get(guildId);
    if (!session) return;

    if (isEmpty) {
      if (!session.emptyTimeout && config.AUTO_DISCONNECT_EMPTY_TIMEOUT > 0) {
        console.log(
          `[SessionManager] Voice channel is empty. Scheduling auto-disconnect in ${config.AUTO_DISCONNECT_EMPTY_TIMEOUT}s`
        );
        session.emptyTimeout = setTimeout(async () => {
          console.log(`[SessionManager] Auto-disconnecting from empty channel in guild ${guildId}`);
          await this.destroySession(guildId);
        }, config.AUTO_DISCONNECT_EMPTY_TIMEOUT * 1000);
      }
    } else {
      if (session.emptyTimeout) {
        console.log(`[SessionManager] Users rejoined channel. Cancelling auto-disconnect timer.`);
        clearTimeout(session.emptyTimeout);
        session.emptyTimeout = null;
      }
    }
  }

  /**
   * Destroys all active sessions across all guilds.
   */
  public async destroyAll(): Promise<void> {
    const guildIds = Array.from(this.sessions.keys());
    for (const guildId of guildIds) {
      await this.destroySession(guildId);
    }
  }
}
