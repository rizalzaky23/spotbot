import {
  EmbedBuilder,
  Message,
  MessageCreateOptions,
  MessagePayload,
  TextBasedChannel,
} from 'discord.js';
import { StreamExtractor, TrackInfo } from '../audio/streamExtractor.js';
import { SessionManager } from './sessionManager.js';

export interface GuildQueue {
  guildId: string;
  textChannel: TextBasedChannel;
  tracks: TrackInfo[];
  currentTrack: TrackInfo | null;
  playedHistory: Set<string>;
  isAutoplay: boolean;
  isPlaying: boolean;
  isHandlingEnd: boolean;
  streamDestroy: (() => void) | null;
}

export class QueueManager {
  private static instance: QueueManager;
  private queues = new Map<string, GuildQueue>();

  private constructor() {}

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  public getQueue(guildId: string): GuildQueue | undefined {
    return this.queues.get(guildId);
  }

  private async sendToChannel(
    textChannel: TextBasedChannel,
    options: string | MessagePayload | MessageCreateOptions
  ): Promise<Message | null> {
    if ('send' in textChannel && typeof (textChannel as any).send === 'function') {
      try {
        return (await (textChannel as any).send(options)) as Message;
      } catch (err: unknown) {
        console.warn('[QueueManager] Could not send message to channel:', err);
      }
    }
    return null;
  }

  public getOrCreateQueue(guildId: string, textChannel: TextBasedChannel): GuildQueue {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = {
        guildId,
        textChannel,
        tracks: [],
        currentTrack: null,
        playedHistory: new Set<string>(),
        isAutoplay: true, // Harmonious Autoplay ON by default
        isPlaying: false,
        isHandlingEnd: false,
        streamDestroy: null,
      };
      this.queues.set(guildId, queue);
    } else {
      queue.textChannel = textChannel;
    }
    return queue;
  }

  public setupBridgeListener(guildId: string): void {
    const session = SessionManager.getInstance().getSession(guildId);
    if (!session) return;

    // Ensure we only have one active trackEnd listener
    session.audioBridge.removeAllListeners('trackEnd');
    session.audioBridge.on('trackEnd', async () => {
      if (session.mode === 'queue') {
        await this.handleTrackEnd(guildId);
      }
    });
  }

  /**
   * Adds a track to the queue and starts playback if idle.
   */
  public async addTrack(
    guildId: string,
    track: TrackInfo,
    textChannel: TextBasedChannel
  ): Promise<{ position: number; isPlayingNow: boolean }> {
    const queue = this.getOrCreateQueue(guildId, textChannel);
    this.setupBridgeListener(guildId);

    if (!queue.isPlaying || !queue.currentTrack) {
      await this.startPlayingTrack(guildId, track, false);
      return { position: 1, isPlayingNow: true };
    } else {
      queue.tracks.push(track);
      return { position: queue.tracks.length, isPlayingNow: false };
    }
  }

  /**
   * Starts playing a track via yt-dlp & FFmpeg resampler.
   */
  public async startPlayingTrack(
    guildId: string,
    track: TrackInfo,
    isAutoplay = false
  ): Promise<boolean> {
    const session = SessionManager.getInstance().getSession(guildId);
    const queue = this.queues.get(guildId);
    if (!session || !queue) return false;

    // Clean up previous stream
    if (queue.streamDestroy) {
      try {
        queue.streamDestroy();
      } catch {
        // Ignore
      }
      queue.streamDestroy = null;
    }

    queue.currentTrack = track;
    queue.isPlaying = true;

    if (track.videoId) {
      queue.playedHistory.add(track.videoId);
      // Keep played history bounded to 80 items
      if (queue.playedHistory.size > 80) {
        const first = queue.playedHistory.values().next().value;
        if (first) queue.playedHistory.delete(first);
      }
    }

    try {
      console.log(
        `[QueueManager] Starting playback for: "${track.title}" (${track.url}) [Autoplay: ${isAutoplay}]`
      );
      const { stream, destroy } = StreamExtractor.getAudioStream(track.url);
      queue.streamDestroy = destroy;

      session.audioBridge.playArbitraryStream(stream, destroy);

      // Announcement Embed
      const embed = new EmbedBuilder()
        .setColor(isAutoplay ? 0x9b59b6 : 0x1db954)
        .setTitle(isAutoplay ? '✨ Autoplay (Lagu Selaras)' : '🎶 Sedang Memutar')
        .setDescription(`[**${track.title}**](${track.url})`)
        .addFields(
          {
            name: '👤 Artis / Channel',
            value: track.author || 'Tidak diketahui',
            inline: true,
          },
          {
            name: '⏱️ Durasi',
            value: track.duration || 'Live / Unknown',
            inline: true,
          },
          {
            name: '🎧 Diminta oleh',
            value: isAutoplay ? '🤖 Radio AI (Otomatis Selaras)' : track.requestedBy || 'User',
            inline: true,
          }
        );

      if (track.thumbnail) {
        embed.setThumbnail(track.thumbnail);
      }

      embed.setFooter({
        text: queue.isAutoplay
          ? '✨ Autoplay Selaras: Aktif (Lagu berikutnya akan dipilih otomatis)'
          : '⚪ Autoplay: Nonaktif',
      });

      await this.sendToChannel(queue.textChannel, { embeds: [embed] });

      return true;
    } catch (err) {
      console.error(`[QueueManager] Error playing track "${track.title}":`, err);
      await this.handleTrackEnd(guildId);
      return false;
    }
  }

  /**
   * Called when a track finishes playing naturally or is skipped.
   */
  public async handleTrackEnd(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    const session = SessionManager.getInstance().getSession(guildId);
    if (!queue || !session || session.mode !== 'queue') return;

    if (queue.isHandlingEnd) return;
    queue.isHandlingEnd = true;

    try {
      if (queue.streamDestroy) {
        try {
          queue.streamDestroy();
        } catch {
          // Ignore
        }
        queue.streamDestroy = null;
      }

      // 1. Check if there are user-queued tracks
      if (queue.tracks.length > 0) {
        const nextTrack = queue.tracks.shift()!;
        await this.startPlayingTrack(guildId, nextTrack, false);
        return;
      }

      // 2. Queue is empty: Trigger Harmonious Autoplay
      if (queue.isAutoplay && queue.currentTrack?.videoId) {
        const lastTrack = queue.currentTrack;
        console.log(
          `[QueueManager] Queue empty in guild ${guildId}. Fetching harmonious next track based on "${lastTrack.title}" (${lastTrack.videoId})...`
        );

        const loadingMsg = await this.sendToChannel(queue.textChannel, {
          embeds: [
            new EmbedBuilder()
              .setColor(0x3498db)
              .setDescription(
                `🔍 **Mencari lagu berikutnya yang selaras dengan "${lastTrack.title}"...**`
              ),
          ],
        });

        const nextHarmoniousTrack = await StreamExtractor.getHarmoniousNextTrack(
          lastTrack.videoId,
          queue.playedHistory
        );

        if (loadingMsg) {
          loadingMsg.delete().catch(() => null);
        }

        if (nextHarmoniousTrack) {
          console.log(
            `[QueueManager] Autoplay found harmonious track: "${nextHarmoniousTrack.title}"`
          );
          await this.startPlayingTrack(guildId, nextHarmoniousTrack, true);
          return;
        }

        // Fallback: search YouTube for artist's other hits
        try {
          const fallbackQuery = `${lastTrack.author} top hits`;
          const fallbackTrack = await StreamExtractor.resolveTrack(fallbackQuery);
          if (fallbackTrack && !queue.playedHistory.has(fallbackTrack.videoId)) {
            fallbackTrack.isAutoplay = true;
            await this.startPlayingTrack(guildId, fallbackTrack, true);
            return;
          }
        } catch {
          // Ignore
        }
      }

      // 3. No more tracks and no autoplay match
      queue.isPlaying = false;
      queue.currentTrack = null;

      const finishedEmbed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle('🏁 Antrean Musik Selesai')
        .setDescription(
          'Tidak ada lagu lagi yang diputar. Gunakan `/play <judul/link>` untuk memutar lagu baru!'
        );

      await this.sendToChannel(queue.textChannel, { embeds: [finishedEmbed] });
    } finally {
      queue.isHandlingEnd = false;
    }
  }

  /**
   * Skips the current track.
   */
  public async skip(guildId: string): Promise<TrackInfo | null> {
    const queue = this.queues.get(guildId);
    const session = SessionManager.getInstance().getSession(guildId);
    if (!queue || !session || !queue.currentTrack) return null;

    const skipped = queue.currentTrack;
    console.log(`[QueueManager] Skipping track: "${skipped.title}"`);

    session.audioBridge.stopPlayback();
    // In case trackEnd does not fire because player was already stopped:
    setTimeout(async () => {
      if (queue.isPlaying && queue.currentTrack?.videoId === skipped.videoId) {
        await this.handleTrackEnd(guildId);
      }
    }, 200);

    return skipped;
  }

  public pause(guildId: string): boolean {
    const session = SessionManager.getInstance().getSession(guildId);
    if (!session) return false;
    return session.audioBridge.pause();
  }

  public resume(guildId: string): boolean {
    const session = SessionManager.getInstance().getSession(guildId);
    if (!session) return false;
    return session.audioBridge.resume();
  }

  public stop(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    const session = SessionManager.getInstance().getSession(guildId);
    if (!queue && !session) return false;

    if (queue) {
      if (queue.streamDestroy) {
        try {
          queue.streamDestroy();
        } catch {
          // Ignore
        }
        queue.streamDestroy = null;
      }
      queue.tracks = [];
      queue.currentTrack = null;
      queue.isPlaying = false;
    }

    if (session) {
      session.audioBridge.stopPlayback();
    }

    return true;
  }

  public setAutoplay(guildId: string, enabled: boolean): boolean {
    const queue = this.queues.get(guildId);
    if (!queue) return false;
    queue.isAutoplay = enabled;
    return true;
  }

  public destroyQueue(guildId: string): void {
    const queue = this.queues.get(guildId);
    if (queue) {
      if (queue.streamDestroy) {
        try {
          queue.streamDestroy();
        } catch {
          // Ignore
        }
        queue.streamDestroy = null;
      }
      queue.tracks = [];
      queue.currentTrack = null;
      queue.isPlaying = false;
      this.queues.delete(guildId);
    }
  }
}
