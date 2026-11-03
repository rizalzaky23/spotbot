import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  PlayerSubscription,
  StreamType,
  VoiceConnection,
} from '@discordjs/voice';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { FFmpegResampler } from './ffmpegResampler.js';

export class AudioBridge extends EventEmitter {
  private player: AudioPlayer;
  private currentResource: AudioResource | null = null;
  private resampleCleanup: (() => void) | null = null;
  private subscription: PlayerSubscription | null = null;
  private volume: number = 1.0; // 0.0 to 1.0 (corresponds to 0% to 100%)

  constructor(private readonly connection: VoiceConnection) {
    super();

    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
        maxMissedFrames: 250, // Tolerate jitter buffer
      },
    });

    this.subscription = this.connection.subscribe(this.player) ?? null;
    this.setupPlayerListeners();
  }

  private setupPlayerListeners(): void {
    this.player.on('stateChange', (oldState, newState) => {
      console.log(
        `[AudioBridge] Player state changed from ${oldState.status} to ${newState.status}`
      );
      this.emit('stateChange', { oldState: oldState.status, newState: newState.status });
    });

    this.player.on('error', (error) => {
      console.error('[AudioBridge] AudioPlayer encountered error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Pipes raw PCM stream from Librespot through FFmpeg resampler
   * and starts playback on Discord voice channel.
   */
  public playPcmStream(rawPcmStream: Readable): void {
    this.stopPlayback();

    const { outputStream, destroy } = FFmpegResampler.createResampleStream(rawPcmStream);
    this.resampleCleanup = destroy;

    this.currentResource = createAudioResource(outputStream, {
      inputType: StreamType.Raw,
      inlineVolume: true,
    });

    // Apply current volume
    if (this.currentResource.volume) {
      this.currentResource.volume.setVolume(this.volume);
    }

    this.player.play(this.currentResource);
    console.log('[AudioBridge] Piped audio stream into Discord AudioPlayer.');
  }

  /**
   * Sets player volume (0 to 100).
   */
  public setVolume(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    this.volume = clamped / 100;
    if (this.currentResource?.volume) {
      this.currentResource.volume.setVolume(this.volume);
      console.log(`[AudioBridge] Adjusted playback volume to ${clamped}%`);
    }
  }

  public getVolume(): number {
    return Math.round(this.volume * 100);
  }

  public getPlayerStatus(): AudioPlayerStatus {
    return this.player.state.status;
  }

  /**
   * Stops the active audio resource and cleans up resampler.
   */
  public stopPlayback(): void {
    if (this.resampleCleanup) {
      try {
        this.resampleCleanup();
      } catch {
        // Ignore
      }
      this.resampleCleanup = null;
    }

    if (this.player.state.status !== AudioPlayerStatus.Idle) {
      this.player.stop(true);
    }

    this.currentResource = null;
  }

  /**
   * Completely destroys the audio bridge and unsubscribes from voice connection.
   */
  public destroy(): void {
    this.stopPlayback();
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.player.stop(true);
    this.removeAllListeners();
    console.log('[AudioBridge] AudioBridge destroyed.');
  }
}
