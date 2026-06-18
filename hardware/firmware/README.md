# Firmware ESP32 — Smart Room Safe Deposit Box

File aktif: `safebox_ESP32_v3_FAST.ino`
Board: **ESP32 Dev Module**

---

## Riwayat Versi

### v3 FAST (current) — `safebox_ESP32_v3_FAST.ino`

**Ganti RFID → OTP via 6 tombol fisik**
- RFID MFRC522 + seluruh kabel SPI dilepas total
- Akses masuk: nasabah input 4 digit OTP (dikirim dari dashboard), ditekan via 6 tombol
- Akses keluar: long press BTN1 (>2 detik), menggantikan scan RFID
- 3 LED status: Hijau (standby/OK), Kuning (proses), Merah (ditolak/alarm)

**Fast boot**
- Delay fingerprint boot: 1200ms → 300ms (AS608 boot <200ms)
- `fpSerial.setTimeout(400)` — potong timeout library dari 1000ms → 400ms
- Hapus fallback baud 9600 — hanya pakai 57600 (default pabrik AS608)
- Hapus delay fiktif setelah `fetchSettings`/`fetchNasabah`/`fetchLoker`/`restoreState` (~5.5 detik dihemat)

**Guard OTP dobel-cache**
- Command `OTP_UNLOCK` dengan `cmdId` yang sama di-skip jika sudah di-cache — agar partial input tombol user tidak di-reset saat poll 5 detik membaca command pending yang sama.
- OTP lama yang masih `pending` otomatis di-PATCH `error` saat digantikan OTP baru.

### v2

- `WiFiClientSecure` dijadikan singleton global (bukan `new` per-request).
  Root cause fix: heap fragmentation → `LoadProhibited` crash saat `fetchNasabah()`.
- `secureClient.stop()` dipanggil eksplisit setelah tiap request.
- `fpSerial.begin(baud, SERIAL_8N1, FP_RX, FP_TX)` pin eksplisit.

### v1 (ESP32 port dari ESP8266)

- Port dari `safebox_ESP8266_v5.ino`
- `SoftwareSerial` → `HardwareSerial2` (UART2)
- `BearSSL` → `WiFiClientSecure` bawaan ESP32
- `ESP8266WiFi` → `WiFi.h`
- `Servo.h` → `ESP32Servo.h`
- Buzzer dipindah ke GPIO 25 (hindari GPIO 3 = UART0 RX)

---

## Library Dependencies

```
WiFi.h              (built-in ESP32 core)
HTTPClient.h        (built-in ESP32 core)
WiFiClientSecure.h  (built-in ESP32 core)
ArduinoJson.h       >= v6
Adafruit_Fingerprint
ESP32Servo.h
time.h              (built-in)
```

Install via **Arduino Library Manager** atau tambahkan ke `platformio.ini`:

```ini
lib_deps =
    bblanchon/ArduinoJson@^6
    adafruit/Adafruit Fingerprint Sensor Library
    madhephaestus/ESP32Servo
```

---

## Konfigurasi (`config.h`)

Buat file `config.h` di folder yang sama dengan `.ino`. **Jangan commit file ini ke Git.**

```cpp
// config.h
#pragma once

#define CFG_WIFI_SSID       "NamaWiFiKamu"
#define CFG_WIFI_PASSWORD   "PasswordWiFi"
#define CFG_SUPABASE_URL    "https://xxxxxxxxxxxx.supabase.co"
#define CFG_SUPABASE_KEY    "eyJ..."   // anon key Supabase
#define CFG_NTP_SERVER      "pool.ntp.org"
#define CFG_GMT_OFFSET      25200      // WIB = UTC+7 = 7 × 3600
```

Salin dari template `config.example.h`, lalu tambahkan ke `.gitignore`:

```
hardware/firmware/config.h
```

---

## Pin Mapping

```
ESP32 Dev Module
═══════════════════════════════════════════════════════════════
Fingerprint AS608 (UART2 / HardwareSerial(2))
  AS608 TX  ──► GPIO 16  (FP_RX / Serial2 RX)
  AS608 RX  ◄── GPIO 17  (FP_TX / Serial2 TX)
  AS608 VCC ──  3.3V  (atau 5V sesuai modul)
  AS608 GND ──  GND

Servo
  Pintu     ──► GPIO 13
  Brankas   ──► GPIO  4

Buzzer (active buzzer, aktif HIGH)
  +         ──► GPIO 25   ← BUKAN GPIO 3 (konflik UART0 RX)

LED (masing-masing via resistor 220Ω ke GND)
  Hijau  (Standby / OK)     ──► GPIO 15
  Kuning (Processing)       ──► GPIO  2
  Merah  (Rejected / Alarm) ──► GPIO 26

Tombol OTP (6x, INPUT_PULLUP — aktif LOW saat ditekan)
  BTN1  (Digit 1 / Exit long-press) ──► GPIO  5
  BTN2  (Digit 2)                   ──► GPIO 33
  BTN3  (Digit 3)                   ──► GPIO 21
  BTN4  (Digit 4)                   ──► GPIO 22
  BTN5  (Digit 5)                   ──► GPIO 23
  BTN6  (Digit 6)                   ──► GPIO 32
═══════════════════════════════════════════════════════════════
```

> **ESP32-WROVER / modul dengan PSRAM:** GPIO 16/17 dipakai internal oleh PSRAM.
> Jika memakai board WROVER, pindahkan fingerprint ke UART lain (misal Serial1)
> dan sesuaikan pin agar tidak bentrok dengan LED/buzzer/servo.

---

## State Machine

```
                   ┌──────────────────────────────────────┐
                   ▼                                      │
┌──────────┐  OTP valid   ┌─────────────┐  5 detik  ┌──────────┐
│ STANDBY  │─────────────►│ PINTU_MASUK │──────────►│ DI_DALAM │
└──────────┘              └─────────────┘           └────┬──┬───┘
                                                  FP OK  │  │ Long press
                                                ┌────────┘  │ BTN1 (>2s)
                                      ┌─────────▼──────┐    │
                                      │ BRANKAS_BUKA   │    │
                                      └────────────────┘    │
                                    Long press BTN1 (>2s)   │
                                                │            │
                                     ┌──────────▼──────┐    │
STANDBY ◄──────── 5 detik ───────────│  PINTU_KELUAR   │◄───┘
                                     └─────────────────┘

Dari state manapun → ALARM (OTP gagal 3× / FP gagal 3× / FP milik nasabah lain)
ALARM non-blocking: maks 1 jam atau di-interrupt RESET_ALARM dari dashboard
```

| State | LED | Deskripsi |
|-------|-----|-----------|
| `STANDBY` | Hijau | Tunggu input 4 digit OTP via tombol |
| `PINTU_MASUK` | Hijau | Pintu terbuka, tunggu nasabah masuk (5 detik) |
| `DI_DALAM` | Hijau | Siap scan fingerprint untuk buka brankas |
| `BRANKAS_BUKA` | Hijau | Brankas terbuka; long press BTN1 untuk keluar |
| `PINTU_KELUAR` | Hijau | Pintu terbuka untuk keluar (5 detik) |
| `ALARM` | Merah blink | Pelanggaran keamanan; buzzer aktif |

---

## Tabel Command Supabase

Command dibaca dari tabel `commands` (polling setiap 5 detik, filter `status=pending`).

| `type` | Arah | Payload yang Dibutuhkan | Perilaku Firmware |
|--------|------|-------------------------|-------------------|
| `OTP_UNLOCK` | Dashboard → ESP32 | `nasabah_id`, `otp_code`, `expires_at` (ISO8601 UTC) | Cache OTP ke RAM; tunggu input tombol di state STANDBY |
| `ENROLL_FP` | Dashboard → ESP32 | `nasabah_id`, `fingerprint_id` (1–127) | Jalankan `handleEnrollFP()` 3-fase; PATCH `nasabah.fingerprint_id` |
| `LOCK_ALL` | Dashboard → ESP32 | — | Kunci semua aktuator, paksa ke STANDBY |
| `RESET_ALARM` | Dashboard → ESP32 | — | Matikan buzzer, reset fail counter, ke STANDBY |
| `UNLOCK_DOOR` | Dashboard → ESP32 | — | Buka pintu paksa (override) |
| `REFRESH_CACHE` | Dashboard → ESP32 | — | Re-fetch nasabah, loker, settings dari Supabase |
| `CAPTURE_PHOTO` | ESP32 → Kamera | `log_pintu_id` | Trigger kamera HP; command ini di-skip saat polling |

> `commands.id` adalah `BIGINT` — selalu treat sebagai `number` di JavaScript.

---

## Alur Input OTP

1. Dashboard teller klik "Akses OTP" → generate OTP 4 digit via CSPRNG → INSERT ke `commands`:
   ```json
   {
     "type": "OTP_UNLOCK",
     "status": "pending",
     "payload": {
       "nasabah_id": "uuid-nasabah",
       "otp_code":   "3152",
       "expires_at": "2025-06-18T10:05:00Z"
     }
   }
   ```
2. ESP32 poll tiap **5 detik** → cache ke `struct PendingOtp` di RAM.
3. Nasabah tekan BTN1–BTN6. Tiap tombol = digit 1–6. Buffer di-reset jika tidak ada input selama **10 detik**.
4. Setelah 4 digit → `evaluateOtpInput()`:
   - **Cocok** → buka pintu, PATCH command `done`, state → `PINTU_MASUK`
   - **Tidak cocok** → `failOTP++`; jika ≥ 3 → `triggerAlarm()`
   - **Kadaluwarsa** (epoch > `expires_at`) → PATCH command `error`
   - **Di luar jam kerja** → PATCH `error`, akses ditolak

---

## Alur Fingerprint (Buka Brankas)

State `DI_DALAM`:

1. `scanFP()` dipanggil non-blocking tiap iterasi `loop()`. Return `-2` jika tidak ada jari.
2. Ada jari → LED Kuning → `fingerFastSearch()`.
3. Hasil:
   - `fpID > 0` dan cocok dengan `nasabahAktif` → LED Hijau, buka brankas → `BRANKAS_BUKA`
   - `fpID > 0` tapi milik nasabah lain → **ALARM** (deteksi substitusi)
   - `fpID == 0` (tidak terdaftar) → `failFP++`; jika ≥ 3 → **ALARM**
   - `fpID == -1` (kualitas gambar buruk) → abaikan, LED balik Hijau

---

## Alur Enroll Fingerprint

Command `ENROLL_FP` (payload: `nasabah_id`, `fingerprint_id` 1–127):

```
Fase 1 → Tempel jari  → AS608 capture → image2Tz(1)
           ↕ (progress update ke Supabase tiap fase)
Fase 2 → Angkat jari  → tunggu NOFINGER (maks 10 detik)
           ↕
Fase 3 → Tempel lagi  → AS608 capture → image2Tz(2)
           ↕
         createModel() → storeModel(fpTargetId)
           ↕
         PATCH nasabah.fingerprint_id → fetchNasabah() (refresh cache)
```

Timeout tiap fase scan: **30 detik**.
Validasi: `fingerprint_id` harus 1–127 (kapasitas sensor AS608).

---

## Alarm (Non-Blocking)

```
Versi lama: while(millis()-start < 3600000) { blink; }
            → loop() freeze 1 jam → RESET_ALARM dari web diabaikan

Sekarang:   triggerAlarm() → set state + catat waktu → return
            loopAlarm() dipanggil tiap iterasi loop()
            → blink via millis(), pollCommands() tetap aktif
            → RESET_ALARM bisa interrupt kapan saja
```

Reset dari dashboard: kirim command `RESET_ALARM` dengan `status: "pending"`.

---

## State Restore on Boot

`restoreState()` query `log_pintu` terakhir saat ESP32 boot/restart:

- `tipe_akses == "MASUK"` **dan** `is_anomali == false` → restore ke state `DI_DALAM`
- Selain itu → mulai dari `STANDBY`

---

## Konstanta Penting

| Konstanta | Nilai | Deskripsi |
|-----------|-------|-----------|
| `DURASI_PINTU_BUKA` | 5.000 ms | Lama pintu terbuka sebelum dikunci |
| `TIMEOUT_DI_DALAM` | 1.800.000 ms (30 menit) | Auto keluar jika terlalu lama |
| `MAX_FAIL_OTP` | 3 | Maks salah OTP sebelum alarm |
| `MAX_FAIL_FP` | 3 | Maks gagal FP sebelum alarm |
| `ENROLL_TIMEOUT_MS` | 30.000 ms | Timeout tiap fase enroll |
| `BTN_DEBOUNCE_MS` | 40 ms | Debounce tombol |
| `BTN_LONGPRESS_MS` | 2.000 ms | Durasi tahan BTN1 untuk keluar |
| `OTP_INPUT_TIMEOUT_MS` | 10.000 ms | Reset buffer OTP jika berhenti input |
| `POLL_INTERVAL` | 5.000 ms | Interval polling Supabase commands |
| `CACHE_REFRESH` | 300.000 ms (5 menit) | Interval refresh cache nasabah/loker |
| `ALARM_DURATION` | 3.600.000 ms (1 jam) | Durasi alarm maksimum |
| `HTTP_TIMEOUT` | 8.000 ms | Timeout per HTTP request |

---

## WiFiClientSecure Singleton

```cpp
// JANGAN lakukan ini (v1 bug — heap fragmentation → crash LoadProhibited):
WiFiClientSecure* c = new WiFiClientSecure();  // setiap request

// Lakukan ini (v2 fix — singleton global):
WiFiClientSecure secureClient;     // deklarasi global sekali

// setup():
secureClient.setInsecure();        // set sekali

// setiap request:
http.begin(secureClient, url);
// ...
http.end();
secureClient.stop();               // lepas TCP socket eksplisit
```

---

## Serial Monitor

Baud rate: **115200**

| Prefix | Keterangan |
|--------|-----------|
| `[WiFi]` | Status koneksi WiFi |
| `[NTP]` | Sinkronisasi waktu |
| `[SB]` | Request Supabase (GET/POST/PATCH) |
| `[DB]` | Cache nasabah/loker |
| `[OTP]` | Input dan validasi OTP |
| `[FP]` | Fingerprint sensor |
| `[BTN]` | Tombol ditekan |
| `[HW]` | Aktuator (servo/buzzer) |
| `[EXIT]` | Long press keluar |
| `[INSIDE]` | Timeout 30 menit |
| `[LOG]` | Logging ke Supabase |
| `[POLL]` | Command polling |
| `[ENROLL_FP]` | Proses enroll sidik jari |
| `[RESTORE]` | State restore on boot |
| `[ALARM]` | Alarm keamanan |
| `[CACHE]` | Cache refresh periodik |
| `[SECURITY]` | Deteksi substitusi nasabah |
