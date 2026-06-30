# Smart Room for Safe Deposit Box

<div align="center">

![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ecf8e?style=flat-square&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white)
![Arduino](https://img.shields.io/badge/Arduino-ESP32-00979d?style=flat-square&logo=arduino&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

Sistem keamanan ruang brankas berbasis IoT dengan autentikasi **OTP via tombol fisik + Fingerprint**,
pemantauan real-time via **Web Dashboard**, dan integrasi kamera otomatis.

Dibangun sebagai proyek IoT Semester 4 — Teknologi Rekayasa Internet, Sekolah Vokasi UGM.

**Live:** [safevault.akzara.id](https://safevault.akzara.id)

</div>

---

## Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard Web                        │
│         React 19 + Vite + Tailwind v4 + Router v7       │
│                 safevault.akzara.id                     │
└──────────────────────┬──────────────────────────────────┘
                       │  REST / Realtime
┌──────────────────────▼──────────────────────────────────┐
│                     Supabase                            │
│         PostgreSQL + Realtime + Storage                 │
│  Tables: nasabah, loker, log_pintu, log_loker,          │
│          commands, system_settings                      │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTPS polling (setiap 5 detik)
┌──────────────────────▼──────────────────────────────────┐
│                   ESP32 Firmware                        │
│            safebox_ESP32_v3_FAST.ino                    │
│   State machine 6 state: STANDBY → PINTU_MASUK →        │
│   DI_DALAM → BRANKAS_BUKA → PINTU_KELUAR → ALARM        │
└──────────┬──────────────────────────┬───────────────────┘
           │ UART2                    │ GPIO
  ┌────────▼────────┐       ┌─────────▼──────────────────┐
  │ Fingerprint     │       │ 6x Tombol OTP │ 2x Servo   │
  │ AS608           │       │ 3x LED Status │ Buzzer     │
  └─────────────────┘       └────────────────────────────┘
```

---

## Fitur

| Fitur | Keterangan |
|---|---|
| **Dual Auth** | OTP 4 digit via tombol fisik + Fingerprint wajib berurutan |
| **OTP per Nasabah** | Dashboard teller generate OTP CSPRNG per klik, berlaku 5 menit |
| **Real-time Log** | Akses pintu & loker diperbarui otomatis via Supabase Realtime |
| **Alert Anomali** | Notifikasi saat akses di luar jam kerja atau OTP/FP orang lain |
| **Webcam Capture** | Foto otomatis saat event akses masuk, upload ke Supabase Storage |
| **Enroll Fingerprint** | Daftarkan sidik jari nasabah langsung dari dashboard |
| **Serial Monitor** | Pantau log ESP32 real-time dari browser via Web Serial API |
| **Manajemen Nasabah** | CRUD nasabah beserta alokasi loker |
| **Riwayat & Export** | Filter log berdasarkan tanggal/nama, export ke CSV |
| **State Restore** | Firmware deteksi kondisi terakhir saat reboot |
| **Dark / Light Mode** | Toggle tema, preferensi disimpan di localStorage |

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Frontend** | React 19, Vite 8, Tailwind v4, React Router v7 |
| **Backend** | Supabase (PostgreSQL, Realtime, Storage) |
| **Firmware** | Arduino ESP32 (C++) |
| **Deployment** | K3s on Azure VPS, Traefik ingress |
| **Domain** | safevault.akzara.id |

---

## State Machine Firmware

```
                   ┌──────────────────────────────────────┐
                   ▼                                      │
┌──────────┐  OTP valid   ┌─────────────┐  5 detik  ┌──────────┐
│ STANDBY  │─────────────►│ PINTU_MASUK │──────────►│ DI_DALAM │
└──────────┘              └─────────────┘           └───┬──┬───┘
     ▲                                           FP OK  │  │ Long press
     │                                         ┌────────┘  │ BTN1 (>2s)
     │                               ┌─────────▼──────┐    │
     │                               │ BRANKAS_BUKA   │    │
     │                               └────────────────┘    │
     │                             Long press BTN1 (>2s)   │
     │                                         │           │
     │                              ┌──────────▼──────┐    │
     └──────────── 5 detik ─────────│  PINTU_KELUAR   │◄───┘
                                    └─────────────────┘

Dari state manapun → ALARM (OTP gagal 3x / FP gagal 3x / FP orang lain)
ALARM non-blocking: maks 1 jam atau di-interrupt RESET_ALARM dari dashboard
```

| State | Deskripsi | LED |
|-------|-----------|-----|
| `STANDBY` | Tunggu input 4 digit OTP via tombol | Hijau |
| `PINTU_MASUK` | Pintu terbuka, tunggu nasabah masuk (5 detik) | Hijau |
| `DI_DALAM` | Nasabah di dalam, siap scan fingerprint | Hijau |
| `BRANKAS_BUKA` | Brankas terbuka, tunggu selesai | Hijau |
| `PINTU_KELUAR` | Pintu terbuka untuk keluar (5 detik) | Hijau |
| `ALARM` | Pelanggaran keamanan, blink merah + buzzer | Merah blink |

---

## Hardware

### Komponen

| Komponen | Spesifikasi |
|----------|-------------|
| Mikrokontroler | ESP32 Dev Module |
| Fingerprint | Adafruit AS608 (UART) |
| Aktuator Pintu | Servo SG90 |
| Aktuator Brankas | Servo SG90 |
| Input OTP | 6× Push Button (INPUT_PULLUP) |
| Indikator | 3× LED (Hijau/Kuning/Merah) + resistor 220Ω |
| Audio | Active Buzzer |

### Wiring ESP32

| Perangkat | Pin Perangkat | GPIO ESP32 |
|-----------|--------------|------------|
| **Fingerprint AS608** | TX | GPIO 16 (Serial2 RX) |
| | RX | GPIO 17 (Serial2 TX) |
| | VCC | 3.3V |
| | GND | GND |
| **Servo Pintu** | Signal | GPIO 13 |
| **Servo Brankas** | Signal | GPIO 4 |
| **Buzzer** (active, aktif HIGH) | + | GPIO 25 |
| **LED Hijau** (Standby / OK) | + | GPIO 15 |
| **LED Kuning** (Processing) | + | GPIO 2 |
| **LED Merah** (Rejected / Alarm) | + | GPIO 26 |
| **BTN1** (Digit 1 / Exit long-press) | – | GPIO 5 |
| **BTN2** (Digit 2) | – | GPIO 33 |
| **BTN3** (Digit 3) | – | GPIO 21 |
| **BTN4** (Digit 4) | – | GPIO 22 |
| **BTN5** (Digit 5) | – | GPIO 23 |
| **BTN6** (Digit 6) | – | GPIO 32 |

> **Catatan:**
> - Semua LED dipasang via resistor 220Ω ke GND.
> - Semua tombol menggunakan `INPUT_PULLUP` — aktif LOW saat ditekan.
> - Jangan gunakan GPIO 3 untuk buzzer — konflik dengan UART0 RX.
> - ESP32-WROVER/PSRAM: GPIO 16/17 bisa bentrok dengan PSRAM. Pindah ke UART lain jika perlu.

---

## Database Supabase

### Tabel Utama

| Tabel | Kegunaan |
|-------|----------|
| `nasabah` | Data nasabah: `id`, `nama`, `fingerprint_id` |
| `loker` | Data loker: `id`, `id_nasabah`, `nomor_loker` |
| `log_pintu` | Log akses pintu: `tipe_akses`, `is_anomali`, `id_nasabah`, `waktu_akses` |
| `log_loker` | Log akses brankas: `status_akses`, `id_nasabah`, `id_loker` |
| `commands` | Antrian perintah ESP32 ↔ dashboard |
| `system_settings` | Konfigurasi: `jam_buka`, `jam_tutup` |

> `commands.id` adalah `BIGINT` — treat sebagai `number` di JS, jangan dibandingkan sebagai string.

### Tipe Command (`commands.type`)

| Command | Arah | Payload | Deskripsi |
|---------|------|---------|-----------|
| `OTP_UNLOCK` | Dashboard → ESP32 | `nasabah_id`, `otp_code`, `expires_at` | Kirim OTP untuk membuka pintu |
| `ENROLL_FP` | Dashboard → ESP32 | `nasabah_id`, `fingerprint_id` | Daftarkan sidik jari baru |
| `LOCK_ALL` | Dashboard → ESP32 | — | Kunci semua, paksa ke STANDBY |
| `RESET_ALARM` | Dashboard → ESP32 | — | Matikan alarm |
| `UNLOCK_DOOR` | Dashboard → ESP32 | — | Buka pintu secara manual |
| `REFRESH_CACHE` | Dashboard → ESP32 | — | Reload cache nasabah/loker |
| `CAPTURE_PHOTO` | ESP32 → Kamera | `log_pintu_id` | Trigger foto saat akses masuk |

---

## Quick Start

### 1. Clone & Setup Frontend

```bash
git clone https://github.com/Thinnur/Web_Dashboard_Smart_Deposit_Box.git
cd Web_Dashboard_Smart_Deposit_Box
npm install
cp .env.example .env
# Edit .env dengan kredensial Supabase
npm run dev
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. Upload Firmware ESP32

1. Install library di Arduino IDE / PlatformIO:
   - `Adafruit_Fingerprint`
   - `ESP32Servo`
   - `ArduinoJson` >= v6
2. Buat file `hardware/firmware/config.h` dari template `config.example.h`
3. Buka dan upload `hardware/firmware/safebox_ESP32_v3_FAST.ino`

Detail lengkap: [`hardware/firmware/README.md`](hardware/firmware/README.md)

### 3. Deployment (K3s)

```bash
kubectl apply -f k8s/
```

---

## Struktur Project

```
├── hardware/
│   ├── firmware/
│   │   ├── safebox_ESP32_v3_FAST.ino  # Firmware aktif (ESP32, OTP + Fingerprint)
│   │   ├── safebox_ESP8266_v5.ino     # Versi lama ESP8266 (tidak dipakai)
│   │   ├── config.example.h           # Template konfigurasi (salin → config.h)
│   │   └── README.md                  # Panduan wiring, flash, & library
│   └── wiring/
│       ├── wiring_diagram_v1.svg
│       ├── wiring_diagram_v2.svg
│       └── BOM.md
├── src/
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── Sidebar.jsx
│   │   ├── DoorLogTable.jsx
│   │   ├── LockerLogTable.jsx
│   │   ├── CustomerManagement.jsx   # CRUD nasabah + OTP dialog + enroll FP
│   │   ├── OTPDialog.jsx            # Dialog OTP per nasabah (countdown 5 menit)
│   │   ├── AccessHistory.jsx        # Filter, search, export CSV
│   │   ├── Settings.jsx
│   │   ├── SerialMonitor.jsx        # Web Serial API monitor
│   │   └── WebcamWidget.jsx
│   ├── lib/
│   │   ├── supabaseClient.js
│   │   └── generateOTP.js           # CSPRNG OTP, requestOTPAccess, cancelOTPAccess
│   ├── App.jsx
│   └── index.css
├── .env.example
├── Dockerfile
└── README.md
```

---

## Scripts

```bash
npm run dev      # Development server (http://localhost:5173)
npm run build    # Production build
npm run preview  # Preview build hasil
npm run lint     # ESLint check
```

---

## Keamanan

- Kredensial web disimpan di `.env` — tidak di-commit ke repository
- Kredensial firmware disimpan di `config.h` — tidak di-commit ke repository
- Menggunakan **anon key** Supabase, bukan service role key
- RLS aktif di semua tabel sensitif
- Komunikasi ESP32 ke Supabase menggunakan **HTTPS** (WiFiClientSecure)
- OTP di-generate via CSPRNG (Web Crypto API) dengan rejection sampling

---

## Tim

| Nama | Peran |
|------|-------|
| Fathin | Full-Stack Developer & Firmware Engineer |
| Putri | Technical Writer & Prototype Developer |
| Kalya | Technical Writer (Project Report) |
| Maria | Hardware Engineer & Prototype Developer |

**Program Studi:** Teknologi Rekayasa Internet — Sekolah Vokasi UGM

---

## Lisensi

MIT — Proyek akademik Semester 4, Teknologi Rekayasa Internet, Sekolah Vokasi UGM.
