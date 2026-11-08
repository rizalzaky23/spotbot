# SpotBot 🎵 — Spotify Connect & Smart AI Music Player for Discord

> **SpotBot** adalah bot Discord serbaguna dengan arsitektur **Dual-Mode**:
> 1. 🟢 **Spotify Connect Receiver**: Kontrol audio langsung dari aplikasi Spotify resmi (Desktop/HP/Web) dengan streaming PCM real-time ke Voice Channel.
> 2. 🎶 **Free Music Player & AI Harmonious Autoplay**: Putar lagu dari link YouTube/Spotify atau pencarian judul melalui perintah `/play`, dilengkapi algoritma cerdas yang **otomatis melanjutkan ke lagu berikutnya yang selaras** (irama, genre, dan suasana yang harmonis) tanpa henti.

---

## ✨ Fitur Utama

- **Dual-Mode Playback**:
  - **Mode Spotify Connect**: Ubah Discord Voice menjadi perangkat speaker Spotify Connect (`/connect`).
  - **Mode Music Player & Autoplay**: Putar lagu tanpa perlu akun Spotify Premium (`/play <judul/link>`).
- **Harmonious Autoplay (AI Radio Mix)**:
  - Saat lagu yang Anda putar habis, bot tidak akan berhenti atau meninggalkan room. Bot secara otomatis menganalisis video ID lagu tersebut dan menjalankan kurasi lagu radio mix YouTube (`list=RD<id>`) untuk memilih lagu berikutnya yang paling selaras secara genre, mood, dan tempo!
- **Discord Voice E2EE (DAVE Protocol Ready)**:
  - Mendukung standar keamanan Voice Discord terbaru (@snazzah/davey) sehingga anti-disconnect / close code 4017.
- **Resampling Audio Real-time**:
  - Pipa audio FFmpeg low-latency mengubah semua format audio secara langsung ke Discord 48kHz 16-bit Stereo PCM tanpa file temporary.
- **Slash Commands Lengkap**:
  - `/play`, `/skip`, `/queue`, `/pause`, `/resume`, `/stop`, `/autoplay`, `/connect`, `/disconnect`, `/status`.

---

## 🎮 Daftar Perintah (Slash Commands)

| Command | Parameter | Deskripsi |
|---|---|---|
| `/play` | `query` *(Wajib)* | Memutar musik dari link YouTube, Spotify track, atau pencarian judul lagu. Otomatis mengaktifkan Autoplay Lagu Selaras. |
| `/skip` | - | Melewati lagu yang sedang diputar ke antrean berikutnya atau memicu lagu selaras baru. |
| `/queue` | - | Menampilkan daftar antrean lagu dan status Autoplay. |
| `/pause` | - | Menjeda sementara pemutaran musik. |
| `/resume` | - | Melanjutkan kembali pemutaran musik yang dijeda. |
| `/stop` | - | Menghentikan pemutaran musik dan membersihkan seluruh antrean. |
| `/autoplay`| `status` *(Opsional)* | Mengaktifkan atau menonaktifkan fitur pemutaran otomatis lagu selaras (`true`/`false`). |
| `/connect` | - | Masuk ke voice channel dan mengaktifkan speaker Spotify Connect. |
| `/disconnect` | - | Memutuskan koneksi bot dari voice channel dan mematikan semua audio engine. |
| `/status` | - | Menampilkan informasi lengkap status bot, channel, lagu aktif, dan metrik audio. |

---

## 📋 Prasyarat (Requirements)

1. **Discord Bot Token & Client ID**:
   - Dapatkan dari [Discord Developer Portal](https://discord.com/developers/applications).
   - Pastikan **Privileged Gateway Intents** (Guild Voice States & Message Content jika diperlukan) aktif.
2. **Server / VPS / Komputer**:
   - Linux (Ubuntu, Debian, CasaOS), macOS, atau Windows.
   - **Docker & Docker Compose** (Sangat disarankan).
3. **Akun Spotify (Opsional)**:
   - Diperlukan akun **Spotify Premium** HANYA jika ingin menggunakan fitur Spotify Connect (`/connect`).
   - Fitur `/play` dengan Autoplay Lagu Selaras **100% GRATIS** tanpa perlu Spotify Premium.

---

## 🚀 Panduan Instalasi & Menjalankan Bot

### Opsi 1: Menggunakan Docker Compose (Direkomendasikan untuk Server/VPS)

Docker adalah cara termudah dan paling stabil karena seluruh dependensi audio native (`librespot`, `ffmpeg`, `yt-dlp`, `opus`) sudah terpasang otomatis.

#### 1. Clone Repository
```bash
git clone https://github.com/rizalzaky23/spotbot.git
cd spotbot
```

#### 2. Buat File Konfigurasi `.env`
Salin template konfigurasi `.env.example`:
```bash
cp .env.example .env
```
Edit file `.env` (misalnya menggunakan `nano .env`):
```env
# Kredensial Discord Bot (Wajib)
DISCORD_TOKEN=MTE5...rahasia_token_anda
DISCORD_CLIENT_ID=1567213039973830746

# Optional: Isi ID Server untuk registrasi slash command instan saat testing
DISCORD_GUILD_ID=1312757262976024628

# Pengaturan Audio & Perangkat
LIBRESPOT_DEVICE_NAME_PREFIX=SpotBot Speaker
LIBRESPOT_BITRATE=160
LIBRESPOT_INITIAL_VOLUME=100
AUTO_DISCONNECT_EMPTY_TIMEOUT=60
```

#### 3. Build & Jalankan Container
```bash
docker compose up -d --build
```

#### 4. Cek Status & Log Bot
```bash
docker compose logs -f spotbot
```
Jika log menampilkan `[Bot] Logged in as SpotBot#...` dan `Successfully registered slash commands`, bot Anda sudah online dan siap digunakan di Discord!

---

### Opsi 2: Instalasi Manual (Local Development)

Jika ingin menjalankan bot langsung di komputer lokal (macOS / Linux) tanpa Docker:

#### 1. Pasang Dependensi Sistem
- **macOS**:
  ```bash
  brew install ffmpeg yt-dlp librespot node@22
  ```
- **Ubuntu / Debian**:
  ```bash
  sudo apt update
  sudo apt install -y ffmpeg python3 build-essential
  # Pasang yt-dlp
  sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  sudo chmod a+rx /usr/local/bin/yt-dlp
  ```

#### 2. Install Node Dependencies
```bash
npm install
```

#### 3. Jalankan Bot
- **Mode Development** (Auto-restart jika ada perubahan kodingan):
  ```bash
  npm run dev
  ```
- **Mode Production**:
  ```bash
  npm run build
  npm start
  ```

---

## 🎵 Cara Penggunaan

### Menggunakan Free Player & Autoplay Selaras:
1. Masuk ke Voice Channel mana pun di server Discord Anda.
2. Ketik `/play query: Kahitna Cantik` (atau masukkan link YouTube / Spotify).
3. Bot akan masuk ke voice channel dan langsung memutar lagu tersebut.
4. Ketika lagu tersebut selesai, bot **secara otomatis mencarikan lagu berikutnya yang berirama dan bergenre selaras** (contoh: *Chrisye - Kisah Cintaku*, *Kahitna - Soulmate*, dll.) tanpa Anda perlu menambahkan lagu manual!

### Menggunakan Spotify Connect:
1. Masuk ke Voice Channel di Discord.
2. Jalankan perintah `/connect`.
3. Buka aplikasi Spotify di HP atau Laptop Anda.
4. Klik tombol **Connect to a device** (ikon speaker/monitor).
5. Pilih **"SpotBot Speaker - [Nama Server]"**.
6. Putar lagu apa saja di Spotify, dan suaranya langsung terhubung ke Discord Voice!

---

## 🛠️ Pemeliharaan & Update Kode

Untuk memperbarui bot di server ke versi terbaru dari GitHub:
```bash
cd /home/rizal/spotbot
git pull origin main
docker compose up -d --build
```

---

## 📄 Lisensi
Didistribusikan di bawah lisensi MIT.
Dibuat untuk komunitas penikmat musik dengan kualitas audio jernih dan pengalaman tanpa batas.
