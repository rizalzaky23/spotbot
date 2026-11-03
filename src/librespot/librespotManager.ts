import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.js';

export interface LibrespotOptions {
  guildId: string;
  deviceName?: string;
  bitrate?: '96' | '160' | '320';
  initialVolume?: number;
  cacheDir?: string;
  username?: string;
  password?: string;
  enableDiscovery?: boolean;
}

export type PlaybackStatus = 'stopped' | 'starting' | 'ready' | 'playing' | 'paused' | 'error';

export interface TrackMetadata {
  title: string;
  artist?: string;
  durationMs?: number;
  loadedAt?: Date;
}

export class LibrespotManager extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  private pcmStream: Readable | null = null;
  private status: PlaybackStatus = 'stopped';
  private currentTrack: TrackMetadata | null = null;
  private volume: number = 100;
  private readonly options: LibrespotOptions;
  private pid: number | null = null;
  private startedAt: Date | null = null;

  constructor(options: LibrespotOptions) {
    super();
    this.options = {
      deviceName: `${config.LIBRESPOT_DEVICE_NAME_PREFIX} (${options.guildId})`,
      bitrate: config.LIBRESPOT_BITRATE,
      initialVolume: config.LIBRESPOT_INITIAL_VOLUME,
      cacheDir: path.join(config.LIBRESPOT_CACHE_DIR, options.guildId),
      username: config.SPOTIFY_USERNAME,
      password: config.SPOTIFY_PASSWORD,
      enableDiscovery: config.ENABLE_DISCOVERY,
      ...options,
    };
  }

  public getStatus(): PlaybackStatus {
    return this.status;
  }

  public getPid(): number | null {
    return this.pid;
  }

  public getStartedAt(): Date | null {
    return this.startedAt;
  }

  public getDeviceName(): string {
    return this.options.deviceName || 'Discord Voice Receiver';
  }

  public getCurrentTrack(): TrackMetadata | null {
    return this.currentTrack;
  }

  public getVolume(): number {
    return this.volume;
  }

  public getPcmStream(): Readable | null {
    return this.pcmStream;
  }

  public isRunning(): boolean {
    return this.childProcess !== null && !this.childProcess.killed;
  }

  /**
   * Spawns the Librespot process configured with raw PCM output.
   */
  public async start(): Promise<Readable> {
    if (this.childProcess) {
      throw new Error('Librespot is already running for this session.');
    }

    this.status = 'starting';
    this.emit('statusChange', this.status);

    let hasValidCache = false;
    if (this.options.cacheDir) {
      try {
        fs.mkdirSync(this.options.cacheDir, { recursive: true });
        hasValidCache = true;
      } catch (err) {
        console.warn(`[LibrespotManager] Failed to create cache dir: ${err}`);
      }
    }

    const args: string[] = [
      '--name',
      this.getDeviceName(),
      '--backend',
      'pipe',
      '--device',
      '/dev/stdout',
      '--format',
      'S16',
      '--bitrate',
      this.options.bitrate || '160',
      '--initial-volume',
      String(this.options.initialVolume ?? 100),
      '--device-type',
      'speaker',
    ];

    if (hasValidCache && this.options.cacheDir) {
      args.push('--cache', this.options.cacheDir);
    }

    if (this.options.enableDiscovery === false) {
      args.push('--disable-discovery');
    }

    // Direct account credentials if specified
    if (this.options.username && this.options.password) {
      args.push('-u', this.options.username, '-p', this.options.password);
    }

    console.log(
      `[LibrespotManager] Spawning ${config.LIBRESPOT_PATH} with device name: "${this.getDeviceName()}"`
    );

    try {
      this.childProcess = spawn(config.LIBRESPOT_PATH, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.pid = this.childProcess.pid ?? null;
      this.startedAt = new Date();

      if (!this.childProcess.stdout) {
        throw new Error('Failed to acquire stdout pipe from Librespot process');
      }

      this.pcmStream = this.childProcess.stdout;

      // Handle stderr logs for state tracking & debug logging
      this.childProcess.stderr?.on('data', (chunk: Buffer) => {
        this.handleStderr(chunk.toString('utf-8'));
      });

      this.childProcess.on('error', (err) => {
        console.error(`[LibrespotManager] Process execution error:`, err);
        this.status = 'error';
        this.emit('error', err);
      });

      this.childProcess.on('close', (code, signal) => {
        console.log(
          `[LibrespotManager] Process closed with code: ${code}, signal: ${signal}`
        );
        this.cleanup();
        this.status = 'stopped';
        this.emit('statusChange', this.status);
        this.emit('exit', code, signal);
      });

      this.status = 'ready';
      this.emit('statusChange', this.status);
      this.emit('ready', {
        deviceName: this.getDeviceName(),
        pid: this.pid,
      });

      return this.pcmStream;
    } catch (error) {
      this.status = 'error';
      this.cleanup();
      throw error;
    }
  }

  /**
   * Parse stderr messages from Librespot to track playback events.
   */
  private handleStderr(text: string): void {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (config.LOG_LEVEL === 'debug' || /error|warn|fail/i.test(trimmed)) {
        console.log(`[librespot:${this.options.guildId}] ${trimmed}`);
      }

      // Detect track loading
      // e.g. Track "Track Name" (184000 ms) loaded
      const trackMatch = trimmed.match(/Track "(.*?)" \(([0-9]+) ms\) loaded/i);
      if (trackMatch) {
        this.currentTrack = {
          title: trackMatch[1],
          durationMs: parseInt(trackMatch[2], 10),
          loadedAt: new Date(),
        };
        this.status = 'playing';
        this.emit('track', this.currentTrack);
        this.emit('statusChange', this.status);
        console.log(
          `[LibrespotManager] Now playing: "${this.currentTrack.title}" (${this.currentTrack.durationMs}ms)`
        );
        continue;
      }

      // Alternative track format in some librespot versions: Loading track "..."
      const loadingMatch = trimmed.match(/Loading track "(.*?)"/i);
      if (loadingMatch && (!this.currentTrack || this.currentTrack.title !== loadingMatch[1])) {
        this.currentTrack = {
          title: loadingMatch[1],
          loadedAt: new Date(),
        };
        this.status = 'playing';
        this.emit('track', this.currentTrack);
        this.emit('statusChange', this.status);
        continue;
      }

      // Detect Playback Paused
      if (/pausing/i.test(trimmed) || /playback paused/i.test(trimmed)) {
        this.status = 'paused';
        this.emit('pause');
        this.emit('statusChange', this.status);
        continue;
      }

      // Detect Playback Resumed
      if (/resuming/i.test(trimmed) || /playback resumed/i.test(trimmed)) {
        this.status = 'playing';
        this.emit('play');
        this.emit('statusChange', this.status);
        continue;
      }

      // Detect Playback Stopped
      if (/stopping/i.test(trimmed) || /playback stopped/i.test(trimmed)) {
        this.status = 'ready';
        this.currentTrack = null;
        this.emit('stop');
        this.emit('statusChange', this.status);
        continue;
      }

      // Detect Volume changes
      const volMatch = trimmed.match(/volume (?:changed to |is )([0-9]+)/i);
      if (volMatch) {
        const rawVol = parseInt(volMatch[1], 10);
        // Normalize 0-65535 or 0-100 to 0-100
        this.volume = rawVol > 100 ? Math.round((rawVol / 65535) * 100) : rawVol;
        this.emit('volume', this.volume);
      }
    }
  }

  /**
   * Gracefully terminate the Librespot process.
   */
  public async stop(): Promise<void> {
    if (!this.childProcess) {
      this.status = 'stopped';
      return;
    }

    return new Promise((resolve) => {
      const proc = this.childProcess;
      if (!proc || proc.killed) {
        this.cleanup();
        resolve();
        return;
      }

      console.log(`[LibrespotManager] Gracefully shutting down PID ${proc.pid}...`);

      const forceKillTimer = setTimeout(() => {
        if (proc && !proc.killed) {
          console.warn(`[LibrespotManager] Force killing PID ${proc.pid} with SIGKILL`);
          try {
            proc.kill('SIGKILL');
          } catch {
            // Ignore if already dead
          }
        }
      }, 2000);

      proc.once('close', () => {
        clearTimeout(forceKillTimer);
        this.cleanup();
        resolve();
      });

      try {
        proc.kill('SIGTERM');
      } catch (err) {
        console.warn(`[LibrespotManager] Error sending SIGTERM: ${err}`);
        try {
          proc.kill('SIGKILL');
        } catch {
          // Ignore
        }
        clearTimeout(forceKillTimer);
        this.cleanup();
        resolve();
      }
    });
  }

  /**
   * Internal cleanup of streams and references.
   */
  private cleanup(): void {
    if (this.pcmStream && !this.pcmStream.destroyed) {
      this.pcmStream.destroy();
    }
    this.pcmStream = null;
    this.childProcess = null;
    this.pid = null;
    this.startedAt = null;
    this.currentTrack = null;
  }
}
