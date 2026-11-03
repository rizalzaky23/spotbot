# Spotify Connect Discord Bot (SpotBot) 🎵

> A production-ready Discord Bot acting as an open **Spotify Connect receiver**. Control playback directly from the official Spotify app (Desktop, Mobile, Web) and stream high-quality audio in real-time to your Discord Voice Channel with ultra-low latency.

---

## 🏛️ Architecture & Data Pipeline

```
[ Spotify App (Mobile/Desktop/Web) ]
                │
                │ (Spotify Connect Protocol / Encrypted Stream)
                ▼
[ Librespot Process Manager (Headless Receiver) ]
                │
                │ (Raw PCM Stream: 44.1kHz, 16-bit, Stereo)
                ▼
[ FFmpeg Audio Resampler ]
                │
                │ (Resampled PCM: 48kHz, 16-bit, Stereo)
                ▼
[ Discord Voice Gateway (@discordjs/voice Opus Transcoder) ]
                │
                │ (Opus Frames over UDP socket)
                ▼
[ Discord Voice Channel ]
```

---

## ✨ Features

- **Native Spotify UX**: No clunky text commands like `!play <url>`. Control play, pause, resume, seek, and volume directly from your Spotify app.
- **Ultra Low-Latency Streaming**: Raw PCM audio is piped directly from `librespot` through a real-time FFmpeg resampler to Discord Voice Opus packets without intermediate file buffering.
- **Dynamic Device Naming**: Each voice session automatically registers a unique device on Spotify Connect (e.g., `Discord Voice - [Server Name]`).
- **Slash Commands**: Modern Discord Interactions (`/connect`, `/disconnect`, `/status`).
- **Volume & Track Sync**: Stderr event parsing listens to track metadata, playback status, and volume changes.
- **Auto-Disconnect**: Automatically leaves the channel and shuts down audio processes if the channel remains empty.
- **Production Containerization**: Multi-stage Dockerfile compiling `librespot` from Rust source and bundling runtime dependencies.

---

## 📋 Requirements

1. **Spotify Premium**: Spotify Connect protocol strictly requires an active Spotify Premium account.
2. **Discord Bot Token**: Create an application and bot at [Discord Developer Portal](https://discord.com/developers/applications).
3. **Environment**:
   - **Docker & Docker Compose** (Recommended), OR
   - **Node.js 18+** with `librespot` installed locally.

---

## 🚀 Quick Start (Docker)

Docker is the easiest way to deploy SpotBot with all native audio tools (`librespot`, `ffmpeg`, `opus`) pre-configured.

### 1. Clone Repository & Setup Environment

```bash
git clone https://github.com/rizalzaky23/spotbot.git
cd spotbot
cp .env.example .env
```

Edit `.env` and fill in your Discord credentials:
```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
```

### 2. Run with Docker Compose

```bash
docker compose up -d --build
```

Check the logs:
```bash
docker compose logs -f spotbot
```

> **Note on Network Discovery**:
> `docker-compose.yml` uses `network_mode: host` so your phone or desktop Spotify client on the same local Wi-Fi / LAN can discover the bot via mDNS/Zeroconf.
> If deploying on a **Cloud VPS** where LAN discovery is unavailable, provide `SPOTIFY_USERNAME` and `SPOTIFY_PASSWORD` in `.env` to log in directly to Spotify's cloud servers!

---

## 💻 Local Development Setup

If running directly on macOS or Linux without Docker:

### 1. Install Librespot

- **macOS (Homebrew)**:
  ```bash
  brew install librespot
  ```
- **Ubuntu / Debian**:
  ```bash
  sudo apt-get update
  sudo apt-get install build-essential libasound2-dev pkg-config
  cargo install librespot --no-default-features --features "pipe-backend with-libmdns"
  ```
- **Arch Linux**:
  ```bash
  sudo pacman -S librespot
  ```

### 2. Install Project Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure `LIBRESPOT_PATH` points to your `librespot` executable (or defaults to `librespot` if it is in your `PATH`).

### 4. Build & Run

- **Development mode** (hot-reload with `tsx`):
  ```bash
  npm run dev
  ```
- **Production build**:
  ```bash
  npm run build
  npm start
  ```

---

## 🎮 Discord Slash Commands

| Command | Description |
|---|---|
| `/connect` | Joins your voice channel and boots up the Spotify Connect receiver. |
| `/disconnect` | Stops playback, kills the `librespot` child process, and leaves voice. |
| `/status` | Displays active playback status, current track name, bitrate, and volume. |

---

## 🎧 How to Listen to Spotify on Discord

1. Join any voice channel in your Discord server.
2. Run `/connect` in any text channel.
3. Open the **Spotify app** on your Phone, Desktop, or Web.
4. Click the **Connect to a device** button (speaker/monitor icon at the bottom right).
5. Select **"Discord Voice - [Server Name]"**.
6. Play any song, playlist, or podcast — audio will instantly stream into Discord!

---

## 📂 Project Structure

```
├── src/
│   ├── audio/
│   │   ├── audioBridge.ts       # Bridge between PCM stream and Discord AudioPlayer
│   │   └── ffmpegResampler.ts   # Low-latency 44.1kHz -> 48kHz PCM resampler
│   ├── bot/
│   │   ├── client.ts            # Discord client initialization
│   │   ├── commands/            # Slash commands (/connect, /disconnect, /status)
│   │   ├── events/              # Event listeners (ready, interaction, voiceState)
│   │   └── sessionManager.ts    # Per-guild voice & Librespot session lifecycle
│   ├── config/
│   │   └── env.ts               # Zod-validated environment config & audio constants
│   ├── librespot/
│   │   └── librespotManager.ts  # Controlled child process manager for Librespot CLI
│   └── index.ts                 # Main bootstrap entry point
├── Dockerfile                   # Multi-stage production container
├── docker-compose.yml           # Compose specification with host networking
├── .env.example                 # Environment configuration template
├── tsconfig.json                # TypeScript compiler configuration
└── package.json                 # Project dependencies & scripts
```

---

## 🛠️ Configuration Options (`.env`)

| Variable | Default | Description |
|---|---|---|
| `DISCORD_TOKEN` | *Required* | Discord Bot Token |
| `DISCORD_CLIENT_ID` | *Required* | Application ID for registering Slash Commands |
| `DISCORD_GUILD_ID` | *Optional* | Target Guild ID for instant command registration during dev |
| `LIBRESPOT_PATH` | `librespot` | Path to `librespot` binary |
| `LIBRESPOT_DEVICE_NAME_PREFIX` | `Discord Voice` | Prefix name displayed in the Spotify Connect menu |
| `LIBRESPOT_BITRATE` | `160` | Audio stream quality (`96`, `160`, or `320` kbps) |
| `LIBRESPOT_INITIAL_VOLUME` | `100` | Initial volume level (0-100) |
| `LIBRESPOT_CACHE_DIR` | `./cache/librespot` | Directory to cache Spotify session tokens |
| `SPOTIFY_USERNAME` | *Optional* | Spotify username (for Cloud VPS headless login) |
| `SPOTIFY_PASSWORD` | *Optional* | Spotify password |
| `ENABLE_DISCOVERY` | `true` | Enable Zeroconf mDNS local network discovery |
| `AUTO_DISCONNECT_EMPTY_TIMEOUT`| `60` | Auto-disconnect delay in seconds when voice channel is empty |

---

## 📄 License

MIT License. Designed and maintained for private and community voice servers.
