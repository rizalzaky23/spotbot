import { spawn, ChildProcess } from 'node:child_process';
import { Duplex, PassThrough, Readable } from 'node:stream';
import ffmpegStatic from 'ffmpeg-static';
import { AUDIO_CONSTANTS } from '../config/env.js';

export class FFmpegResampler {
  private static resolvedFfmpegPath: string | null = null;

  /**
   * Resolves the path to the ffmpeg executable.
   * Priority: FFMPEG_PATH env var > ffmpeg-static > system 'ffmpeg'.
   */
  public static getFfmpegBinary(): string {
    if (this.resolvedFfmpegPath) {
      return this.resolvedFfmpegPath;
    }

    if (process.env.FFMPEG_PATH) {
      this.resolvedFfmpegPath = process.env.FFMPEG_PATH;
      return this.resolvedFfmpegPath;
    }

    if (ffmpegStatic) {
      this.resolvedFfmpegPath = ffmpegStatic;
      process.env.FFMPEG_PATH = ffmpegStatic;
      return this.resolvedFfmpegPath;
    }

    this.resolvedFfmpegPath = 'ffmpeg';
    return this.resolvedFfmpegPath;
  }

  /**
   * Creates an FFmpeg resampling pipeline stream:
   * 44.1kHz 16-bit Stereo PCM (from Librespot) -> 48kHz 16-bit Stereo PCM (for Discord).
   * Tuned for minimum latency and zero buffering delay.
   */
  public static createResampleStream(inputStream: Readable): {
    outputStream: Readable;
    childProcess: ChildProcess;
    destroy: () => void;
  } {
    const ffmpegPath = this.getFfmpegBinary();
    const args = [
      '-loglevel',
      'warning',
      '-probesize',
      '32',
      '-analyzeduration',
      '0',
      '-fflags',
      'nobuffer',
      '-flags',
      'low_delay',
      '-f',
      's16le',
      '-ar',
      String(AUDIO_CONSTANTS.LIBRESPOT_SAMPLE_RATE),
      '-ac',
      String(AUDIO_CONSTANTS.LIBRESPOT_CHANNELS),
      '-i',
      'pipe:0',
      '-f',
      's16le',
      '-ar',
      String(AUDIO_CONSTANTS.DISCORD_SAMPLE_RATE),
      '-ac',
      String(AUDIO_CONSTANTS.DISCORD_CHANNELS),
      'pipe:1',
    ];

    const child = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Handle FFmpeg stderr for diagnostics
    child.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString('utf-8').trim();
      if (msg) {
        console.debug(`[FFmpeg] ${msg}`);
      }
    });

    const outputPassThrough = new PassThrough({
      highWaterMark: 1024 * 32, // ~32KB buffer (enough for ~170ms of 48kHz audio)
    });

    // Pipe input into FFmpeg's stdin
    if (child.stdin) {
      inputStream.pipe(child.stdin);
    }

    // Pipe FFmpeg's stdout into our output PassThrough
    if (child.stdout) {
      child.stdout.pipe(outputPassThrough);
    }

    const cleanup = () => {
      try {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      } catch {
        // Ignore
      }
      if (!outputPassThrough.destroyed) {
        outputPassThrough.destroy();
      }
    };

    child.on('error', (err) => {
      console.error('[FFmpegResampler] FFmpeg process error:', err);
      cleanup();
    });

    child.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[FFmpegResampler] FFmpeg exited with code ${code}`);
      }
      cleanup();
    });

    return {
      outputStream: outputPassThrough,
      childProcess: child,
      destroy: cleanup,
    };
  }

  /**
   * Resamples an arbitrary audio stream (from yt-dlp, webm, opus, mp3, etc.)
   * into Discord standard 48kHz 16-bit Stereo PCM.
   */
  public static createArbitraryResampleStream(inputStream: Readable): {
    outputStream: Readable;
    childProcess: ChildProcess;
    destroy: () => void;
  } {
    const ffmpegPath = this.getFfmpegBinary();
    const args = [
      '-loglevel',
      'warning',
      '-i',
      'pipe:0',
      '-f',
      's16le',
      '-ar',
      String(AUDIO_CONSTANTS.DISCORD_SAMPLE_RATE),
      '-ac',
      String(AUDIO_CONSTANTS.DISCORD_CHANNELS),
      'pipe:1',
    ];

    const child = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString('utf-8').trim();
      if (msg) console.debug(`[FFmpeg:arbitrary] ${msg}`);
    });

    const outputPassThrough = new PassThrough({
      highWaterMark: 1024 * 64,
    });

    if (child.stdin) {
      inputStream.pipe(child.stdin);
    }
    if (child.stdout) {
      child.stdout.pipe(outputPassThrough);
    }

    const cleanup = () => {
      try {
        if (!child.killed) child.kill('SIGKILL');
      } catch {
        // Ignore
      }
      if (!outputPassThrough.destroyed) outputPassThrough.destroy();
    };

    child.on('error', (err) => {
      console.error('[FFmpegResampler:arbitrary] FFmpeg error:', err);
      cleanup();
    });

    child.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[FFmpegResampler:arbitrary] FFmpeg exited with code ${code}`);
      }
      cleanup();
    });

    return {
      outputStream: outputPassThrough,
      childProcess: child,
      destroy: cleanup,
    };
  }
}
