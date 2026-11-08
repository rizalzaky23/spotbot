import { spawn, ChildProcess } from 'node:child_process';
import { Readable, PassThrough } from 'node:stream';
import yts from 'yt-search';

export interface TrackInfo {
  title: string;
  url: string;
  videoId: string;
  thumbnail: string;
  duration: string;
  durationSec: number;
  author: string;
  requestedBy?: string;
  isAutoplay?: boolean;
}

export class StreamExtractor {
  /**
   * Resolves a search query, YouTube URL, or Spotify URL into playable TrackInfo.
   */
  public static async resolveTrack(query: string, requestedBy?: string): Promise<TrackInfo | null> {
    const trimmed = query.trim();

    // 1. Handle Spotify Track URLs
    if (trimmed.includes('spotify.com/track/')) {
      try {
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(trimmed)}`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
          const data = (await response.json()) as { title?: string; thumbnail_url?: string };
          if (data.title) {
            console.log(`[StreamExtractor] Resolved Spotify track to title: "${data.title}"`);
            const searchRes = await yts(`${data.title} audio`);
            if (searchRes.videos.length > 0) {
              const video = searchRes.videos[0];
              return {
                title: data.title,
                url: video.url,
                videoId: video.videoId,
                thumbnail: data.thumbnail_url || video.thumbnail || '',
                duration: video.timestamp,
                durationSec: video.seconds,
                author: video.author.name,
                requestedBy,
              };
            }
          }
        }
      } catch (err) {
        console.warn('[StreamExtractor] Spotify oEmbed resolution failed:', err);
      }
    }

    // 2. Handle direct YouTube Video ID or URL
    const ytIdMatch = trimmed.match(/(?:youtu\.be\/|watch\?v=|\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (ytIdMatch) {
      try {
        const videoId = ytIdMatch[1];
        const video = await yts({ videoId });
        if (video) {
          return {
            title: video.title,
            url: video.url,
            videoId: video.videoId,
            thumbnail: video.thumbnail,
            duration: video.timestamp,
            durationSec: video.seconds,
            author: video.author.name,
            requestedBy,
          };
        }
      } catch (err) {
        console.warn(`[StreamExtractor] Failed to fetch direct video by ID: ${err}`);
      }
    }

    // 3. Fallback to general YouTube Search
    try {
      const searchRes = await yts(trimmed);
      if (searchRes.videos.length > 0) {
        const video = searchRes.videos[0];
        return {
          title: video.title,
          url: video.url,
          videoId: video.videoId,
          thumbnail: video.thumbnail || '',
          duration: video.timestamp,
          durationSec: video.seconds,
          author: video.author.name,
          requestedBy,
        };
      }
    } catch (err) {
      console.error('[StreamExtractor] YouTube search failed:', err);
    }

    return null;
  }

  /**
   * Spawns yt-dlp to stream audio bytes directly from the target URL.
   */
  public static getAudioStream(url: string): {
    stream: Readable;
    child: ChildProcess;
    destroy: () => void;
  } {
    const args = [
      '-f',
      'ba/b', // Best audio or best
      '--no-playlist',
      '--quiet',
      '--no-warnings',
      '-o',
      '-',
      url,
    ];

    const child = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const passThrough = new PassThrough({ highWaterMark: 1024 * 64 });

    if (child.stdout) {
      child.stdout.pipe(passThrough);
    }

    child.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString('utf-8').trim();
      if (msg) console.debug(`[yt-dlp:stderr] ${msg}`);
    });

    const cleanup = () => {
      try {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      } catch {
        // Ignore
      }
      if (!passThrough.destroyed) {
        passThrough.destroy();
      }
    };

    child.on('error', (err) => {
      console.error('[StreamExtractor] yt-dlp process error:', err);
      cleanup();
    });

    return {
      stream: passThrough,
      child,
      destroy: cleanup,
    };
  }

  /**
   * Queries YouTube's algorithmic Radio Mix (list=RD<videoId>) to find the next
   * harmonious song that matches the style, mood, and genre of the current track.
   */
  public static async getHarmoniousNextTrack(
    currentVideoId: string,
    playedHistory: Set<string>
  ): Promise<TrackInfo | null> {
    return new Promise((resolve) => {
      const mixUrl = `https://www.youtube.com/watch?v=${currentVideoId}&list=RD${currentVideoId}`;
      const args = [
        '--flat-playlist',
        '--dump-single-json',
        '--playlist-items',
        '1:12',
        mixUrl,
      ];

      const child = spawn('yt-dlp', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdoutData = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutData += chunk.toString('utf-8');
      });

      child.on('close', async (code) => {
        if (code !== 0 || !stdoutData.trim()) {
          console.warn('[StreamExtractor] Failed to fetch RD mix. Falling back to related search.');
          return resolve(null);
        }

        try {
          const parsed = JSON.parse(stdoutData) as {
            entries?: Array<{ id?: string; title?: string; duration?: number; url?: string }>;
          };

          const entries = parsed.entries || [];
          for (const entry of entries) {
            if (!entry.id || playedHistory.has(entry.id) || entry.id === currentVideoId) {
              continue;
            }

            // Found a harmonious next song from the Radio Mix
            const videoUrl = entry.url || `https://www.youtube.com/watch?v=${entry.id}`;
            const videoInfo = await yts({ videoId: entry.id }).catch(() => null);

            return resolve({
              title: videoInfo?.title || entry.title || 'Unknown Title',
              url: videoUrl,
              videoId: entry.id,
              thumbnail:
                videoInfo?.thumbnail || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
              duration: videoInfo?.timestamp || (entry.duration ? `${Math.floor(entry.duration / 60)}:${entry.duration % 60}` : 'Unknown'),
              durationSec: videoInfo?.seconds || entry.duration || 0,
              author: videoInfo?.author.name || 'Various Artists',
              isAutoplay: true,
            });
          }
        } catch (err) {
          console.error('[StreamExtractor] Error parsing RD mix data:', err);
        }

        resolve(null);
      });

      child.on('error', (err) => {
        console.error('[StreamExtractor] Error running yt-dlp mix:', err);
        resolve(null);
      });
    });
  }
}
