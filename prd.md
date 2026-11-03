# Product Requirement Document (PRD)
## Project Name: Spotify Connect Discord Bot

---

## 1. Ringkasan Eksekutif (Executive Summary)

### 1.1 Latar Belakang
Pemutar musik Discord konvensional mewajibkan pengguna mengetik perintah teks (misal: `m!p <link/judul>`) di saluran teks Discord. Alur ini kurang ramah pengguna (*friction*) dan memutus aliran percakapan. Proyek ini bertujuan untuk menciptakan integrasi *seamless* di mana bot Discord berlaku sebagai **Spotify Connect Receiver**, memungkinkan pengguna mengontrol musik secara langsung dari aplikasi resmi Spotify (Mobile/Desktop/Web) ke *Voice Channel* Discord.

### 1.2 Tujuan Proyek
- Menghadirkan *User Experience* pemutaran musik di Discord yang natural melalui kontrol pemutar Spotify native.
- Membangun arsitektur penanganan *audio streaming* berlatensi rendah dari *stream* PCM Spotify ke codec Opus Discord.
- Menyediakan fondasi yang dapat dikembangkan untuk *multi-room* (banyak *voice channel* secara bersamaan).

---

## 2. Target Pengguna & Use Case

### 2.1 Target Pengguna
- Pengguna Discord yang memiliki akun **Spotify Premium**.
- Komunitas Discord yang menginginkan cara pemutaran musik bersama tanpa gangguan perintah teks (*bot commands*).

### 2.2 Utilitas Utama (Use Case Scenario)
1. **User Connection**: Pengguna masuk ke *Voice Channel* Discord dan menjalankan perintah awal (misal `/connect`).
2. **Device Selection**: Pengguna membuka aplikasi Spotify di smartphone atau PC. Di daftar perangkat pemutar (Spotify Connect), muncul perangkat baru bernama `"Discord Voice - [Nama Server]"`.
3. **Playback Control**: Pengguna memilih lagu dan menekan tombol play. Suara lagu terdengar jernih di *Voice Channel* Discord.
4. **Interactive Controls**: Fitur play, pause, skip, scrub (geser durasi), dan pengatur *volume* di aplikasi Spotify langsung berdampak pada audio di Discord secara *real-time*.

---

## 3. Arsitektur Teknis & Alur Data

```
[ Aplikasi Spotify (HP/PC) ]
             │
             │ (Spotify Connect Protocol / Encrypted Stream)
             ▼
[ Backend Bot / Librespot Instance ]
             │
             │ (Raw Audio Output: PCM 44.1kHz/48kHz)
             ▼
[ Audio Pipeline (FFmpeg Encoder) ]
             │
             │ (Encoded Audio: Opus Frame)
             ▼
[ Discord Voice Gateway (UDP Stream) ] ──> [ Discord Voice Channel ]
```

### 3.1 Komponen Utama
1. **Librespot Engine**: Bertindak sebagai *headless Spotify receiver* terbuka yang mendekripsi aliran audio Spotify.
2. **Audio Transcoder**: Memproses data PCM dari Librespot, menyesuaikan *sample rate* ke 48kHz stereo, dan mengodesinya ke format **Opus** menggunakan FFmpeg.
3. **Discord Voice Driver**: Mengirimkan *packet* Opus melalui socket UDP ke Voice Server Discord.
4. **Session & Auth Manager**: Mengelola autentikasi token Spotify OAuth2 pengguna dan pemetaan sesi ke *Voice Channel*.

---

## 4. Kebutuhan Fitur (Feature Requirements)

### 4.1 Fitur Fase 1 (MVP - Minimum Viable Product)
| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|---|
| **F-01** | Bot Voice Join/Leave | Bot dapat masuk dan keluar *Voice Channel* melalui perintah `/join` atau `/leave`. | High |
| **F-02** | Spotify Authentication | Pengguna menautkan akun Spotify Premium mereka via OAuth2 (`/login`). | High |
| **F-03** | Single-Instance Receiver | Menjalankan *instance* Librespot dinamis yang merepresentasikan perangkat Spotify Connect untuk sesi aktif tersebut. | High |
| **F-04** | Live PCM-to-Opus Streaming | Melakukan *transcoding* audio berlatensi rendah dari Librespot ke Discord Voice Connection. | High |
| **F-05** | Native Media Control Sync | Sinkronisasi aksi Play, Pause, Next, Previous, dan Seek dari aplikasi Spotify. | High |

### 4.2 Fitur Fase 2 (Pengembangan Lanjutan)
| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|---|
| **F-06** | Volume Synchronization | Slider volume di aplikasi Spotify secara proporsional mengubah volume pancaran audio bot. | Medium |
| **F-07** | Queue & Host Transfer | Memungkinkan perpindahan kendali pemutar (*Host*) antar pengguna Spotify Premium di channel yang sama. | Medium |
| **F-08** | Now Playing Rich Presence | Menampilkan *embed* lagu yang sedang diputar di saluran teks Discord beserta cover art dan judul. | Low |
| **F-09** | Multi-Guild Dynamic Scaling | Kemampuan memuat *child process/container* Librespot baru secara otomatis saat ada permintaan dari server lain. | Medium |

---

## 5. Kebutuhan Non-Fungsional (Non-Functional Requirements)

### 5.1 Performa & Latensi
- **Audio Latency**: Total latensi dari aksi di Spotify hingga terdengar di Discord tidak boleh melebihi **1.5 detik**.
- **Audio Quality**: Format output audio menggunakan standar Opus 48kHz Stereo dengan *bitrate* dinamis antara 96 kbps - 128 kbps.

### 5.2 Keamanan & Akses
- Token rahasia OAuth2 dan sesi Spotify harus tersimpan secara terenkripsi (AES-256) di database server.
- Penggunaan Librespot harus mematuhi batasan autentikasi resmi Spotify (memerlukan tipe akun Premium).

### 5.3 Skalabilitas
- Penggunaan memori (*RAM usage*) disimulasikan maksimal **~50-100 MB** per *instance* pemutar lagu aktif.

---

## 6. Tantangan Teknis & Solusi (Risks & Mitigations)

1. **Tantangan**: Network Discovery (mDNS/Zeroconf) Spotify Connect tidak bekerja secara otomatis di Cloud VPS.
   - **Solusi**: Menggunakan metode autentikasi `blob` / *OAuth Credentials* saat menginisialisasi Librespot, sehingga server mendaftarkan perangkat langsung ke akun pengguna via API Cloud, bukan jaringan lokal.
2. **Tantangan**: Penggunaan resource CPU tinggi akibat pemprosesan audio *real-time*.
   - **Solusi**: Memanfaatkan *native C/Rust binding* untuk transcoding Opus alih-alih proses eksternal FFmpeg yang berat jika memungkinkan.
3. **Tantangan**: Aturan Kebijakan Spotify (Terms of Service).
   - **Solusi**: Memastikan bot hanya digunakan untuk keperluan pribadi/komunitas kecil dan mensyaratkan setiap *host* menggunakan akun Premium valid sendiri.

---

## 7. Rencana Pelaksanaan (Roadmap)

- **Minggu 1**: Setup *Proof of Concept* (PoC) lokal menggunakan Librespot CLI + FFmpeg + Discord Library pilihan.
- **Minggu 2**: Integrasi alur OAuth2 Spotify dan manajemen sesi pengguna.
- **Minggu 3**: Optimasi latensi *pipeline* audio dan penguji coba penanganan kontrol pemutar (Play/Pause/Skip).
- **Minggu 4**: Pengujian multi-pengguna dan peluncuran MVP.