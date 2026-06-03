# Smart Room for Safe Deposit Box

<div align="center">

![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ecf8e?style=flat-square&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white)
![Arduino](https://img.shields.io/badge/Arduino-ESP8266-00979d?style=flat-square&logo=arduino&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

Sistem keamanan brankas cerdas berbasis IoT dengan autentikasi **RFID + Fingerprint**,
pemantauan real-time via **Web Dashboard**, dan integrasi kamera otomatis.

Dibangun sebagai proyek IoT Semester 4 — Teknologi Rekayasa Internet, Sekolah Vokasi UGM.

</div>

---

## Gambaran Sistem

```
Nasabah → [Scan RFID] → Pintu Buka
         → [Scan Fingerprint] → Brankas Buka
         → [Scan RFID] → Brankas Kunci + Pintu Buka

ESP8266 ←→ Supabase (REST API + Realtime)
              ↑↓
         React Dashboard
              ↑
         Kamera HP (WebRTC → Supabase Storage)
```

**Alur state firmware:**
`STANDBY → PINTU_MASUK → DI_DALAM → BRANKAS_BUKA → PINTU_KELUAR → STANDBY`

---

## Fitur

| Fitur | Keterangan |
|---|---|
| **Dual Auth** | RFID + Fingerprint wajib berurutan — tidak bisa dilewati |
| **Real-time Log** | Akses pintu & loker diperbarui otomatis via Supabase Realtime |
| **Alert Anomali** | Notifikasi instan saat akses di luar jam kerja atau kartu tidak dikenal |
| **Webcam Capture** | Foto otomatis saat ada event akses, di-upload ke Supabase Storage |
| **Enroll dari Web** | Daftarkan RFID & sidik jari nasabah langsung dari dashboard |
| **Serial Monitor** | Pantau log ESP8266 real-time dari browser via Web Serial API |
| **Manajemen Nasabah** | CRUD nasabah beserta alokasi loker |
| **Riwayat & Export** | Filter log berdasarkan tanggal/nama, export ke CSV |
| **State Restore** | Firmware mendeteksi kondisi terakhir saat reboot |
| **Dark / Light Mode** | Toggle tema, preferensi disimpan di localStorage |

---

## Tech Stack

### Web Dashboard
- **Frontend** — React 19, Vite 8, React Router v7
- **Styling** — Tailwind CSS v4, CSS Custom Properties
- **Backend** — Supabase (PostgreSQL, Realtime, Storage, Auth)
- **Font** — Plus Jakarta Sans, JetBrains Mono

### Firmware (ESP8266)
- **Board** — NodeMCU ESP8266 (ESP-12E)
- **Framework** — Arduino
- **Library** — MFRC522, Adafruit_Fingerprint, ArduinoJson, ESP8266HTTPClient
- **Auth** — HTTPS via BearSSL (tidak ada plain HTTP)

---

## Hardware

### Wiring Diagram

![Wiring Diagram](hardware/wiring/wiring_diagram_v2.svg)

### Komponen Utama

| Komponen | Spesifikasi | Fungsi |
|----------|-------------|--------|
| NodeMCU ESP8266 | ESP-12E | Mikrokontroler + WiFi |
| RFID MFRC522 | 13.56 MHz | Baca kartu nasabah |
| Fingerprint AS608 | Kapasitas 127 slot | Otentikasi biometrik |
| Servo SG90 | 180° | Aktuator pintu & brankas |
| Buzzer Aktif | 5V | Indikator audio |

Daftar lengkap komponen dan harga: [`hardware/wiring/BOM.md`](hardware/wiring/BOM.md)

### Cara Flash Firmware

Lihat panduan lengkap di [`hardware/firmware/README.md`](hardware/firmware/README.md).

```bash
# 1. Masuk ke folder firmware
cd hardware/firmware

# 2. Salin dan isi config
cp config.h.example config.h
# Edit config.h dengan WiFi SSID, password, dan Supabase key

# 3. Flash via Arduino IDE
# Board: NodeMCU 1.0 (ESP-12E), Baud: 74880
```

---

## Cara Menjalankan Dashboard

### Prerequisites
- Node.js ≥ 20
- Akun [Supabase](https://supabase.com) dengan project yang sudah dikonfigurasi

### 1. Clone & Install

```bash
git clone https://github.com/Thinnur/Web_Dashboard_Smart_Deposit_Box.git
cd Web_Dashboard_Smart_Deposit_Box
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
```

Edit `.env` dengan kredensial Supabase project kamu:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> Temukan kedua nilai ini di **Supabase Dashboard → Project Settings → API**.

### 3. Jalankan

```bash
npm run dev
```

Buka `http://localhost:5173`

---

## Struktur Database (Supabase)

```
nasabah          → data pemilik loker (nama, rfid_uid, fingerprint_id)
loker            → unit loker (nomor_loker, id_nasabah)
log_pintu        → log akses pintu (waktu_akses, tipe_akses, is_anomali, url_foto)
log_loker        → log akses loker (waktu_akses, status_akses, nomor_loker)
commands         → command queue dari dashboard ke IoT device (type, status, payload)
system_settings  → jam operasional (jam_buka, jam_tutup)

view_log_pintu   → view join log_pintu + nasabah
view_log_loker   → view join log_loker + nasabah + loker
```

Row Level Security (RLS) diaktifkan. Gunakan **anon key** — bukan service role key.

---

## Struktur Project

```
├── hardware/
│   ├── firmware/
│   │   ├── safebox_ESP8266_v5.ino   # Firmware utama
│   │   ├── config.h.example         # Template konfigurasi (salin → config.h)
│   │   └── README.md                # Panduan flash & library
│   └── wiring/
│       ├── wiring_diagram_v1.svg    # Diagram wiring awal
│       ├── wiring_diagram_v2.svg    # Diagram wiring revisi
│       └── BOM.md                   # Bill of Materials
├── src/
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── Sidebar.jsx
│   │   ├── DoorLogTable.jsx
│   │   ├── LockerLogTable.jsx
│   │   ├── CustomerManagement.jsx   # CRUD nasabah + enrollment sensor
│   │   ├── AccessHistory.jsx        # Filter, search, export CSV
│   │   ├── Settings.jsx
│   │   ├── SerialMonitor.jsx        # Web Serial API monitor
│   │   └── WebcamWidget.jsx
│   ├── context/
│   │   └── ThemeContext.jsx
│   ├── lib/
│   │   └── supabaseClient.js
│   ├── pages/
│   │   └── CameraPage.jsx           # Halaman kamera untuk HP
│   ├── App.jsx
│   └── index.css
├── .env.example
├── Dockerfile
└── README.md
```

---

## Scripts

```bash
npm run dev      # Development server
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
- Komunikasi ESP8266 ke Supabase menggunakan **HTTPS** (BearSSL)

---

## Lisensi

MIT — Proyek akademik Semester 4, Teknologi Rekayasa Internet, Sekolah Vokasi UGM.
