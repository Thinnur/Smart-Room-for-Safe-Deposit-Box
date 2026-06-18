/*
 * ============================================================
 *  SMART ROOM FOR SAFE DEPOSIT BOX — ESP32 v3
 *  Board: ESP32 Dev Module
 *
 *  Port dari ESP8266 v5. Perbedaan utama:
 *  ├─ SoftwareSerial    → Hardware Serial2 (GPIO 16/17)
 *  ├─ BearSSL           → WiFiClientSecure bawaan ESP32
 *  ├─ ESP8266WiFi       → WiFi.h
 *  ├─ Servo.h           → ESP32Servo.h
 *  └─ Buzzer dipindah ke GPIO 25 (hindari GPIO3 = UART0 RX)
 *
 *  Fix v2:
 *  ├─ WiFiClientSecure dijadikan singleton global (bukan new per-request)
 *  │   → mencegah heap fragmentation → LoadProhibited crash pada fetchNasabah()
 *  ├─ secureClient.stop() dipanggil eksplisit setelah tiap request
 *  └─ fpSerial.begin(baud, SERIAL_8N1, FP_RX, FP_TX) eksplisit
 *
 *  Fix v3 (fast-boot):
 *  ├─ Hapus fallback baud 9600 — hanya pakai 57600 (AS608 default)
 *  ├─ Delay boot FP: 1200ms → 300ms (AS608 boot <200ms)
 *  ├─ fpSerial.setTimeout(400) sebelum verifyPassword()
 *  │   → potong timeout library dari 1000ms → 400ms
 *  └─ Hapus delay fiktif setelah fetchSettings/fetchNasabah/fetchLoker/restoreState
 *      → hemat ~5.5 detik di setup (fungsi fetch sudah blocking)
 *
 *  v3 — Ganti RFID dengan OTP (6 push button):
 *  ├─ RFID MFRC522 dilepas total (modul + kabel SPI tidak dipakai lagi)
 *  ├─ Masuk ruangan: OTP 4 digit dari dashboard, ditekan via 6 tombol fisik
 *  ├─ Keluar ruangan: long press tombol BTN1 (>2 detik), gantikan scan RFID sendiri
 *  └─ 3 LED status (Hijau/Kuning/Merah) jadi indikator umum, bukan khusus RFID
 *     ├─ HIJAU  (GPIO 26) — Standby / akses OK
 *     ├─ KUNING (GPIO 27) — Memproses input/sidik jari
 *     └─ MERAH  (GPIO 14) — Ditolak / pelanggaran / alarm
 *
 *  ALUR STATE MACHINE:
 *  1. STANDBY     → LED Hijau. Tunggu 4 digit OTP via tombol → LED Kuning (proses)
 *                 → Valid   : LED Hijau, Pintu BUKA → PINTU_MASUK
 *                 → Invalid : LED Merah 2 det, balik Hijau
 *  2. PINTU_MASUK → 4 detik → Pintu KUNCI → DI_DALAM
 *  3. DI_DALAM    → FP standby (LED Hijau).
 *                 → FP scan → LED Kuning
 *                 → FP cocok: LED Hijau, Brankas BUKA → BRANKAS_BUKA
 *                 → FP gagal: LED Merah sebentar
 *                 → Long press BTN1 (>2 detik) → minta keluar → PINTU_KELUAR
 *  4. BRANKAS_BUKA→ Long press BTN1 (>2 detik) → Brankas KUNCI + Pintu BUKA
 *  5. PINTU_KELUAR→ 4 detik → Pintu KUNCI → LED Hijau → STANDBY
 *  6. ALARM       → LED Merah blink + buzzer 5 detik → balik state sebelumnya
 *
 *  Timeout: 30 menit di dalam → auto keluar
 *  State Restore on Reboot: query log_pintu terakhir
 *
 *  WIRING RINGKASAN:
 *  Tombol OTP   → BTN1..BTN6: GPIO 5, 33, 21, 22, 23, 32 (INPUT_PULLUP, aktif LOW)
 *  Fingerprint  → TX→GPIO16 (Serial2 RX)  RX←GPIO17 (Serial2 TX)
 *  Servo Pintu  → GPIO 13
 *  Servo Brankas→ GPIO 4
 *  Buzzer       → GPIO 25   (BUKAN GPIO3!)
 *  LED Hijau    → GPIO 26   (via resistor 220Ω ke GND)
 *  LED Kuning   → GPIO 27   (via resistor 220Ω ke GND)
 *  LED Merah    → GPIO 14   (via resistor 220Ω ke GND)
 * ============================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <ESP32Servo.h>
#include <time.h>

#include "config.h"

// ============================================================
//  PIN — ESP32
// ============================================================
// Tombol OTP (6x) — bebas dipakai karena bekas RFID SPI/SS sudah dilepas
#define BTN1   5
#define BTN2   33
#define BTN3   21
#define BTN4   22
#define BTN5   23
#define BTN6   32

// Fingerprint AS608 via UART2 eksplisit
// Koneksi: AS608 TX → GPIO 16  |  AS608 RX ← GPIO 17
#define FP_RX      16
#define FP_TX      17

// Aktuator
#define SERVO_PINTU    13
#define SERVO_BRANKAS  4

// Audio (hindari GPIO 3 = UART0 RX)
#define BUZZER     25

// LED indikator status (umum — standby/proses/ditolak)
#define LED_HIJAU  15   // Standby / akses OK
#define LED_KUNING 2   // Memproses
#define LED_MERAH  26   // Ditolak / alarm

const int BTN_PINS[6] = { BTN1, BTN2, BTN3, BTN4, BTN5, BTN6 };

// ============================================================
//  KONSTANTA OPERASIONAL
// ============================================================
#define DURASI_PINTU_BUKA  5000UL     // ms — berapa lama pintu tetap buka
#define TIMEOUT_DI_DALAM   1800000UL  // 30 menit — auto keluar jika terlalu lama
#define MAX_FAIL_OTP       3          // input OTP salah berturut   → ALARM
#define MAX_FAIL_FP        3          // scan FP gagal berturut     → ALARM
#define ENROLL_TIMEOUT_MS  30000UL    // 30 detik untuk enroll
#define BTN_DEBOUNCE_MS    40UL       // ms debounce tombol
#define BTN_LONGPRESS_MS   2000UL     // ms tahan BTN1 untuk keluar
#define OTP_INPUT_TIMEOUT_MS 10000UL  // ms — reset buffer jika berhenti menekan

#define WIFI_SSID       CFG_WIFI_SSID
#define WIFI_PASSWORD   CFG_WIFI_PASSWORD
#define SUPABASE_URL    CFG_SUPABASE_URL
#define SUPABASE_KEY    CFG_SUPABASE_KEY
#define NTP_SERVER      CFG_NTP_SERVER
#define GMT_OFFSET      CFG_GMT_OFFSET

#define HTTP_TIMEOUT   8000   // ms timeout per request
#define HTTP_DELAY     200    // ms jeda antar request
#define POLL_INTERVAL  5000UL // ms interval polling command
#define CACHE_REFRESH  300000UL // 5 menit refresh cache
#define ALARM_DURATION 3600000UL // 1 jam alarm

#define MAX_NASABAH  50
#define MAX_LOKER    50

// ============================================================
//  STRUCT
// ============================================================
struct Nasabah {
  String id;
  String nama;
  int    fingerprint_id;
};

struct Loker {
  String id;
  String id_nasabah;
  String nomor_loker;
};

// Cache OTP_UNLOCK yang sedang aktif (RAM only — single in-flight)
struct PendingOtp {
  bool   active         = false;
  String cmdId          = "";
  String nasabahId      = "";
  String otpCode        = "";
  long   expiresAtEpoch = 0;   // unix epoch UTC (detik)
};
PendingOtp otpCache;

// ============================================================
//  DATABASE RAM (cache)
// ============================================================
Nasabah db_nasabah[MAX_NASABAH];
Loker   db_loker[MAX_LOKER];
int     total_nasabah = 0;
int     total_loker   = 0;
int     cfgJamBuka    = 8;
int     cfgJamTutup   = 23;

// ============================================================
//  OBJEK HARDWARE
// ============================================================
// Gunakan instance UART2 eksplisit agar RX/TX fingerprint pasti memakai GPIO16/GPIO17.
// Jangan pakai &Serial2 langsung + finger.begin(), karena pada beberapa ESP32 core
// Serial2.begin(baud) tanpa pin bisa tidak mengarah ke pin yang kita wiring.
HardwareSerial       fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);
Servo                servoPintu, servoBrankas;

// ============================================================
//  STATE MACHINE
// ============================================================
enum State {
  STANDBY,
  PINTU_MASUK,
  DI_DALAM,
  BRANKAS_BUKA,
  PINTU_KELUAR,
  ALARM
};
State state = STANDBY;

Nasabah* nasabahAktif = nullptr;
int failOTP = 0;
int failFP  = 0;

unsigned long timerPintu   = 0;
unsigned long timerDalam   = 0;
unsigned long timerCache   = 0;
unsigned long timerPollCmd = 0;

// Alarm non-blocking — pakai alarmStartMs bukan timerAlarm
// (timerAlarm sudah dipakai esp32-hal-timer.h → compile error)
unsigned long alarmStartMs    = 0;
unsigned long alarmBlinkMs    = 0;
bool          alarmBuzzerOn   = false;

// [v2] Singleton global — mencegah heap fragmentation crash
WiFiClientSecure secureClient;

// ── Input tombol OTP (debounce + deteksi long-press) ──────────
bool buttonRawLast[6]    = { false, false, false, false, false, false };
bool buttonState[6]      = { false, false, false, false, false, false };
bool buttonJustPressed[6] = { false, false, false, false, false, false };
unsigned long buttonChangeTime[6] = { 0, 0, 0, 0, 0, 0 };
unsigned long buttonPressStart[6] = { 0, 0, 0, 0, 0, 0 };

String        inputBuffer   = "";   // buffer digit OTP yang sedang diketik (1-6 per tombol)
unsigned long lastInputTime = 0;

// ============================================================
//  LED INDIKATOR — helpers
// ============================================================
enum LEDStatus {
  LED_STANDBY_OK,    // Hijau   — idle / akses berhasil
  LED_PROCESSING,    // Kuning  — sedang memproses
  LED_REJECTED,      // Merah   — ditolak / pelanggaran
  LED_ALL_OFF        // semua mati
};

void setLED(LEDStatus s) {
  digitalWrite(LED_HIJAU,  s == LED_STANDBY_OK  ? HIGH : LOW);
  digitalWrite(LED_KUNING, s == LED_PROCESSING  ? HIGH : LOW);
  digitalWrite(LED_MERAH,  s == LED_REJECTED    ? HIGH : LOW);
}

// Blink blocking (dipakai saat enroll & alarm)
void blinkLED(LEDStatus s, int kali, int durasi_ms) {
  for (int i = 0; i < kali; i++) {
    setLED(s);
    delay(durasi_ms);
    setLED(LED_ALL_OFF);
    delay(durasi_ms / 2);
  }
}

// Merah 2 detik lalu balik hijau — shortcut untuk penolakan
void ledDenied() {
  setLED(LED_REJECTED);
  delay(2000);
  setLED(LED_STANDBY_OK);
}

// ============================================================
//  FORWARD DECLARATIONS
// ============================================================
void loopStandby();
void loopPintuMasuk();
void loopDiDalam();
void loopBrankasBuka();
void loopPintuKeluar();
void loopAlarm();
String sbGET(String endpoint, int maxRetry = 3);
bool   sbPOST(String endpoint, String body);
String sbPOSTGetBody(String endpoint, String body);
bool   sbPATCH(String endpoint, String body);
void   fetchSettings();
void   fetchNasabah();
void   fetchLoker();
void   restoreState();
void   logPintu(String idNasabah, String tipe, bool anomali);
String logPintuGetID(String idNasabah, String tipe, bool anomali);
void   logLoker(String idNasabah, String idLoker, String status);
void   triggerCameraCapture(String logPintuID);
void   pollCommands();
void   markCommandDone(String cmdID);
void   updateCmdProgress(String cmdID, String nasabahId, String msg, int fpId);
void   handleEnrollFP(String cmdID, String nasabahId, int fpTargetId);
Nasabah* cariNasabahByID(String id);
Nasabah* cariNasabahFP(int fpID);
Loker*   cariLoker(String idNasabah);
bool   isJamKerja();
void   bukaPintu();
void   tutupPintu();
void   bukaBrankas();
void   tutupBrankas();
void   triggerAlarm();
void   buzzerBeep(int d);
void   buzzerDenied();
void   buzzerAlert();
void   buzzerError();
int    scanFP();
void   connectWiFi();
const char* stateStr();
void   updateButtons();
void   evaluateOtpInput();
long   isoToEpoch(const String& iso);

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== SMART SAFE DEPOSIT BOX v1 (ESP32) ===");

  // ── LED & Buzzer ─────────────────────────────────────────
  pinMode(LED_HIJAU,  OUTPUT);
  pinMode(LED_KUNING, OUTPUT);
  pinMode(LED_MERAH,  OUTPUT);
  pinMode(BUZZER,     OUTPUT);
  setLED(LED_PROCESSING);    // Kuning selama inisialisasi
  digitalWrite(BUZZER, LOW);

  // ── Servo ────────────────────────────────────────────────
  servoPintu.attach(SERVO_PINTU);
  servoBrankas.attach(SERVO_BRANKAS);
  servoPintu.write(0);
  servoBrankas.write(0);
  delay(100);
  Serial.println("[HW] Servo OK");

  // ── Tombol OTP (6x, INPUT_PULLUP — aktif LOW saat ditekan) ──
  for (int i = 0; i < 6; i++) {
    pinMode(BTN_PINS[i], INPUT_PULLUP);
    buttonChangeTime[i] = millis();
  }
  Serial.println("[HW] Tombol OTP OK (GPIO 5,33,21,22,23,32)");

  // ── Fingerprint AS608 (UART2 eksplisit: RX=GPIO16, TX=GPIO17) ──
  // Koneksi silang:
  //   AS608 TX  → ESP32 GPIO16 / FP_RX
  //   AS608 RX  ← ESP32 GPIO17 / FP_TX
  //   VCC       → 3.3V atau 5V sesuai modul
  //   GND       → GND ESP32
  //
  // [v3-fast] Hanya 57600 — AS608 default dari pabrik.
  //   boot delay dipotong 1200→300ms, setTimeout 400ms (was 1000ms default library)
  Serial.println("[FP] Init UART2 fingerprint (RX=GPIO16, TX=GPIO17)...");
  fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  delay(300);               // AS608 boot <200ms; 300ms cukup aman
  fpSerial.setTimeout(400); // potong timeout verifyPassword: 1000ms → 400ms

  if (finger.verifyPassword()) {
    Serial.println("[FP] Sensor OK — kapasitas: " + String(finger.capacity));
  } else {
    Serial.println("[FP] ERROR! Sensor fingerprint tidak terdeteksi.");
    Serial.println("[FP] Cek wiring: AS608 TX→GPIO16, AS608 RX←GPIO17, VCC, dan GND.");
    Serial.println("[FP] Jika board ESP32-WROVER/PSRAM, GPIO16/17 bisa bentrok. Pindah pin UART.");
    setLED(LED_REJECTED);
    buzzerError();
    delay(2000);
    setLED(LED_PROCESSING);
  }

  // ── WiFi ─────────────────────────────────────────────────
  connectWiFi();
  secureClient.setInsecure();   // [v2] set sekali di sini, bukan per-request

  // ── NTP ──────────────────────────────────────────────────
  configTime(GMT_OFFSET, 0, NTP_SERVER);
  Serial.print("[NTP] Sync");
  time_t now = time(nullptr);
  int retry = 0;
  while (now < 1000000000 && retry++ < 15) {
    delay(1000);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println(now > 1000000000 ? " OK" : " GAGAL (lanjut tanpa waktu)");

  // ── Load data dari Supabase ───────────────────────────────
  // [v3-fast] Hapus delay(2500/2000/500) — fetch sudah blocking
  Serial.println("[SB] Loading settings...");
  fetchSettings();
  Serial.println("[SB] Loading nasabah...");
  fetchNasabah();
  Serial.println("[SB] Loading loker...");
  fetchLoker();

  // ── Restore state (deteksi nasabah masih di dalam) ────────
  Serial.println("[SB] Restoring state...");
  restoreState();

  timerCache   = millis();
  timerPollCmd = millis();

  // ── Ready ─────────────────────────────────────────────────
  setLED(LED_STANDBY_OK);
  buzzerBeep(100); delay(100); buzzerBeep(300);
  Serial.println("[SYSTEM] Ready! State: " + String(stateStr()) + "\n");
}

// ============================================================
//  MAIN LOOP
// ============================================================
void loop() {
  // Baca semua tombol (debounce + deteksi long-press) setiap iterasi
  updateButtons();

  // Cache refresh periodik
  if (millis() - timerCache > CACHE_REFRESH) {
    timerCache = millis();
    fetchSettings(); delay(1000);
    fetchNasabah();  delay(1000);
    fetchLoker();
    Serial.println("[CACHE] Refreshed");
  }

  // Command polling dari Supabase
  if (millis() - timerPollCmd > POLL_INTERVAL) {
    timerPollCmd = millis();
    pollCommands();
  }

  // State machine
  switch (state) {
    case STANDBY:      loopStandby();      break;
    case PINTU_MASUK:  loopPintuMasuk();   break;
    case DI_DALAM:     loopDiDalam();      break;
    case BRANKAS_BUKA: loopBrankasBuka();  break;
    case PINTU_KELUAR: loopPintuKeluar();  break;
    case ALARM:        loopAlarm();        break;  // non-blocking → pollCommands() tetap jalan
  }
}

// ============================================================
//  STATE: STANDBY
//  LED Hijau. Tunggu 4 digit OTP via 6 tombol fisik.
// ============================================================
void loopStandby() {
  // ── OTP kadaluwarsa di device (jaga-jaga browser teller ditutup
  //    sebelum timer JS-nya sempat cancel) ──────────────────────
  if (otpCache.active && otpCache.expiresAtEpoch > 0
      && time(nullptr) > otpCache.expiresAtEpoch) {
    Serial.println("[OTP] Kadaluwarsa di device → cmdId=" + otpCache.cmdId);
    sbPATCH("commands?id=eq." + otpCache.cmdId,
      "{\"status\":\"error\",\"payload\":{\"progress\":\"OTP kadaluwarsa (device).\"}}");
    otpCache = PendingOtp();
  }

  // ── Baca tombol yang baru ditekan (debounced) ─────────────────
  for (int i = 0; i < 6; i++) {
    if (!buttonJustPressed[i]) continue;

    buzzerBeep(40);   // feedback pendek per digit
    inputBuffer += String(i + 1);
    lastInputTime = millis();
    Serial.println("[BTN] Tombol " + String(i + 1) + " → buffer: " + inputBuffer);

    if (inputBuffer.length() >= 4) {
      evaluateOtpInput();
      inputBuffer = "";
    }
  }

  // ── Reset buffer jika berhenti menekan terlalu lama ───────────
  if (inputBuffer.length() > 0 && millis() - lastInputTime > OTP_INPUT_TIMEOUT_MS) {
    Serial.println("[BTN] Timeout input, buffer direset.");
    inputBuffer = "";
  }
}

// ============================================================
//  Cocokkan 4 digit di inputBuffer dengan OTP yang sedang di-cache
// ============================================================
void evaluateOtpInput() {
  if (!otpCache.active) {
    Serial.println("[OTP] Input ditolak: tidak ada OTP aktif.");
    buzzerDenied();
    ledDenied();
    return;
  }

  if (inputBuffer != otpCache.otpCode) {
    failOTP++;
    Serial.println("[OTP] SALAH! Fail " + String(failOTP) + "/" + String(MAX_FAIL_OTP));
    buzzerDenied();
    ledDenied();
    if (failOTP >= MAX_FAIL_OTP) {
      triggerAlarm();
      failOTP = 0;
    }
    return;
  }

  // ── OTP cocok ──────────────────────────────────────────────
  setLED(LED_PROCESSING);
  String   cmdId   = otpCache.cmdId;
  Nasabah* found   = cariNasabahByID(otpCache.nasabahId);
  bool     anomali = !isJamKerja();

  if (found == nullptr) {
    Serial.println("[OTP] Nasabah tidak ditemukan di cache: " + otpCache.nasabahId);
    sbPATCH("commands?id=eq." + cmdId,
      "{\"status\":\"error\",\"payload\":{\"progress\":\"Nasabah tidak ditemukan di cache device.\"}}");
    otpCache = PendingOtp();
    buzzerDenied();
    ledDenied();
    return;
  }

  if (anomali) {
    Serial.println("[OTP] " + found->nama + " — DI LUAR JAM KERJA!");
    logPintu(found->id, "MASUK", true);
    sbPATCH("commands?id=eq." + cmdId,
      "{\"status\":\"error\",\"payload\":{\"progress\":\"DITOLAK: di luar jam operasional.\"}}");
    otpCache = PendingOtp();
    buzzerAlert();
    ledDenied();
    return;
  }

  // ── Akses valid ──────────────────────────────────────────
  failOTP      = 0;
  nasabahAktif = found;
  Serial.println("[OTP] Akses OK: " + found->nama);

  String logID = logPintuGetID(found->id, "MASUK", false);
  if (logID != "") {
    delay(HTTP_DELAY);
    triggerCameraCapture(logID);
  }

  sbPATCH("commands?id=eq." + cmdId, "{\"status\":\"done\"}");
  otpCache = PendingOtp();

  setLED(LED_STANDBY_OK);  // → Hijau: akses diterima
  bukaPintu();
  state      = PINTU_MASUK;
  timerPintu = millis();
  Serial.println("[DOOR] Pintu terbuka "
    + String(DURASI_PINTU_BUKA / 1000) + " detik, silakan masuk...");
}

// ============================================================
//  STATE: PINTU MASUK
//  Tunggu 4 detik lalu kunci pintu.
// ============================================================
void loopPintuMasuk() {
  if (millis() - timerPintu >= DURASI_PINTU_BUKA) {
    tutupPintu();
    Serial.println("[DOOR] Pintu terkunci. Nasabah di dalam.");
    Serial.println("[FP] Tempelkan sidik jari untuk buka brankas...");
    state      = DI_DALAM;
    timerDalam = millis();
    failFP     = 0;
  }
}

// ============================================================
//  STATE: DI DALAM
//  LED Hijau saat idle. Scan FP untuk buka brankas.
//  Long press BTN1 (>2 detik) untuk minta keluar.
// ============================================================
void loopDiDalam() {
  // ── Timeout 30 menit → auto keluar ───────────────────────
  if (millis() - timerDalam > TIMEOUT_DI_DALAM) {
    Serial.println("[INSIDE] Timeout 30 menit! Auto keluar.");
    tutupBrankas();
    if (nasabahAktif) logPintu(nasabahAktif->id, "KELUAR", false);
    bukaPintu();
    state      = PINTU_KELUAR;
    timerPintu = millis();
    return;
  }

  // ── Long press BTN1 (>2 detik) — minta keluar ────────────────
  if (buttonState[0] && (millis() - buttonPressStart[0] > BTN_LONGPRESS_MS)) {
    Serial.println("[EXIT] Long press BTN1 — "
      + String(nasabahAktif ? nasabahAktif->nama : "?") + " minta keluar.");
    if (nasabahAktif) logPintu(nasabahAktif->id, "KELUAR", false);
    setLED(LED_STANDBY_OK);
    bukaPintu();
    state      = PINTU_KELUAR;
    timerPintu = millis();
    return;
  }

  // ── Scan Fingerprint ──────────────────────────────────────
  int fpID = scanFP();
  if (fpID == -2) return;   // Tidak ada jari — tidak ubah LED

  setLED(LED_PROCESSING);   // Ada jari — Kuning: proses

  Nasabah* n = cariNasabahFP(fpID);

  if (fpID > 0 && n != nullptr) {
    if (nasabahAktif && n->id == nasabahAktif->id) {
      // ── FP cocok & pemilik benar ────────────────────────
      failFP = 0;
      Serial.println("[FP] COCOK: " + n->nama + " (ID=" + String(fpID) + ")");
      Loker* l       = cariLoker(n->id);
      String lokerID = l ? l->id : "";
      String noLoker = l ? l->nomor_loker : "?";
      logLoker(n->id, lokerID, "BERHASIL");
      Serial.println("[FP] Loker: " + noLoker);
      setLED(LED_STANDBY_OK);  // → Hijau: berhasil
      bukaBrankas();
      state = BRANKAS_BUKA;

    } else {
      // ── FP valid tapi bukan pemilik loker yang masuk ────
      Serial.println("[SECURITY] ALARM! Sidik jari milik " + n->nama
        + " tapi yang masuk adalah " + (nasabahAktif ? nasabahAktif->nama : "?") + "!");
      logLoker(n->id, "", "GAGAL");
      triggerAlarm();
      failFP = 0;
    }

  } else if (fpID == 0) {
    // ── FP tidak dikenal ─────────────────────────────────
    failFP++;
    Serial.println("[FP] Tidak terdaftar! Fail "
      + String(failFP) + "/" + String(MAX_FAIL_FP));
    logLoker(nasabahAktif ? nasabahAktif->id : "", "", "GAGAL");
    buzzerDenied();
    setLED(LED_REJECTED);
    delay(1500);
    setLED(LED_STANDBY_OK);
    if (failFP >= MAX_FAIL_FP) {
      Serial.println("[FP] ALARM! Terlalu banyak percobaan.");
      triggerAlarm();
      failFP = 0;
    }
  } else {
    // fpID == -1: image conversion error
    setLED(LED_STANDBY_OK);
  }
}

// ============================================================
//  STATE: BRANKAS BUKA
//  Long press BTN1 (>2 detik) → brankas kunci + pintu buka.
// ============================================================
void loopBrankasBuka() {
  // ── Timeout ────────────────────────────────────────────
  if (millis() - timerDalam > TIMEOUT_DI_DALAM) {
    Serial.println("[INSIDE] Timeout 30 menit! Auto keluar.");
    tutupBrankas();
    if (nasabahAktif) logPintu(nasabahAktif->id, "KELUAR", false);
    bukaPintu();
    state      = PINTU_KELUAR;
    timerPintu = millis();
    return;
  }

  // ── Long press BTN1 (>2 detik) — keluar, brankas dikunci ─────
  if (buttonState[0] && (millis() - buttonPressStart[0] > BTN_LONGPRESS_MS)) {
    Serial.println("[EXIT] Long press BTN1 — "
      + String(nasabahAktif ? nasabahAktif->nama : "?") + " keluar, brankas dikunci.");
    tutupBrankas();
    delay(500);
    if (nasabahAktif) logPintu(nasabahAktif->id, "KELUAR", false);
    setLED(LED_STANDBY_OK);
    bukaPintu();
    state      = PINTU_KELUAR;
    timerPintu = millis();
    return;
  }

  // FP scan di state ini hanya informatif (brankas sudah buka)
  int fpID = scanFP();
  if (fpID > 0) {
    Nasabah* n = cariNasabahFP(fpID);
    if (n) Serial.println("[FP] Brankas sudah terbuka untuk " + n->nama);
  }
}

// ============================================================
//  STATE: PINTU KELUAR
//  Tunggu 4 detik, kunci pintu, reset ke STANDBY.
// ============================================================
void loopPintuKeluar() {
  if (millis() - timerPintu >= DURASI_PINTU_BUKA) {
    tutupPintu();
    Serial.println("[DOOR] Pintu terkunci. Sesi selesai.");
    nasabahAktif = nullptr;
    failFP       = 0;
    failOTP      = 0;
    setLED(LED_STANDBY_OK);
    state = STANDBY;
    buzzerBeep(300);
  }
}

// ============================================================
//  SUPABASE HTTP — WiFiClientSecure singleton (v2 fix)
//
//  [v1] new WiFiClientSecure per-request → heap fragmentation
//       → alokasi ke-2 (fetchNasabah) return nullptr
//       → crash LoadProhibited saat c->setInsecure() di nullptr
//
//  [v2] Satu objek global, di-stop() eksplisit setelah tiap request
//       agar TCP socket dilepas sebelum request berikutnya
// ============================================================

String sbGET(String endpoint, int maxRetry) {
  if (WiFi.status() != WL_CONNECTED) return "";
  for (int attempt = 1; attempt <= maxRetry; attempt++) {
    HTTPClient http;
    http.begin(secureClient, String(SUPABASE_URL) + "/rest/v1/" + endpoint);
    http.setTimeout(HTTP_TIMEOUT);
    http.addHeader("apikey",        SUPABASE_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
    http.addHeader("Connection",    "close");
    int code = http.GET();
    if (code == 200) {
      String resp = http.getString();
      http.end();
      secureClient.stop();   // lepas TCP socket eksplisit
      delay(HTTP_DELAY);
      return resp;
    }
    Serial.println("[SB] GET " + String(code) + " attempt " + String(attempt));
    http.end();
    secureClient.stop();
    if (attempt < maxRetry) delay(1500 * attempt);
  }
  Serial.println("[SB] GET GAGAL: " + endpoint.substring(0, 40));
  return "";
}

bool sbPOST(String endpoint, String body) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(secureClient, String(SUPABASE_URL) + "/rest/v1/" + endpoint);
  http.setTimeout(HTTP_TIMEOUT);
  http.addHeader("apikey",        SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("Prefer",        "return=minimal");
  http.addHeader("Connection",    "close");
  int code = http.POST(body);
  http.end();
  secureClient.stop();
  delay(HTTP_DELAY);
  if (code == 201) return true;
  Serial.println("[SB] POST " + String(code));
  return false;
}

String sbPOSTGetBody(String endpoint, String body) {
  if (WiFi.status() != WL_CONNECTED) return "";
  HTTPClient http;
  http.begin(secureClient, String(SUPABASE_URL) + "/rest/v1/" + endpoint);
  http.setTimeout(HTTP_TIMEOUT);
  http.addHeader("apikey",        SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("Prefer",        "return=representation");
  http.addHeader("Connection",    "close");
  int code = http.POST(body);
  String resp = "";
  if (code == 201) resp = http.getString();
  else Serial.println("[SB] POSTGetBody " + String(code));
  http.end();
  secureClient.stop();
  delay(HTTP_DELAY);
  return resp;
}

bool sbPATCH(String endpoint, String body) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(secureClient, String(SUPABASE_URL) + "/rest/v1/" + endpoint);
  http.setTimeout(HTTP_TIMEOUT);
  http.addHeader("apikey",        SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("Prefer",        "return=minimal");
  http.addHeader("Connection",    "close");
  int code = http.PATCH(body);
  http.end();
  secureClient.stop();
  delay(HTTP_DELAY);
  if (code == 204 || code == 200) return true;
  Serial.println("[SB] PATCH " + String(code));
  return false;
}

// ============================================================
//  FETCH DATA dari Supabase
// ============================================================
void fetchSettings() {
  String resp = sbGET("system_settings?id=eq.1&select=jam_buka,jam_tutup&limit=1");
  if (resp == "" || resp == "[]") return;
  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, resp)) return;
  JsonObject obj = doc[0].as<JsonObject>();
  if (obj.containsKey("jam_buka"))  cfgJamBuka  = String(obj["jam_buka"].as<String>()).substring(0, 2).toInt();
  if (obj.containsKey("jam_tutup")) cfgJamTutup = String(obj["jam_tutup"].as<String>()).substring(0, 2).toInt();
  Serial.println("[CFG] Jam operasional: " + String(cfgJamBuka) + ":00 – " + String(cfgJamTutup) + ":00");
}

void fetchNasabah() {
  String resp = sbGET("nasabah?select=id,nama,fingerprint_id&limit=" + String(MAX_NASABAH));
  if (resp == "" || resp == "[]") return;
  DynamicJsonDocument doc(4096);
  if (deserializeJson(doc, resp)) return;
  JsonArray arr = doc.as<JsonArray>();
  total_nasabah = 0;
  for (JsonObject obj : arr) {
    if (total_nasabah >= MAX_NASABAH) break;
    db_nasabah[total_nasabah].id             = obj["id"].as<String>();
    db_nasabah[total_nasabah].nama           = obj["nama"].as<String>();
    db_nasabah[total_nasabah].fingerprint_id = obj["fingerprint_id"] | 0;
    total_nasabah++;
  }
  Serial.println("[DB] Nasabah di-cache: " + String(total_nasabah));
}

void fetchLoker() {
  String resp = sbGET("loker?select=id,id_nasabah,nomor_loker&limit=" + String(MAX_LOKER));
  if (resp == "" || resp == "[]") return;
  DynamicJsonDocument doc(4096);
  if (deserializeJson(doc, resp)) return;
  JsonArray arr = doc.as<JsonArray>();
  total_loker = 0;
  for (JsonObject obj : arr) {
    if (total_loker >= MAX_LOKER) break;
    db_loker[total_loker].id          = obj["id"].as<String>();
    db_loker[total_loker].id_nasabah  = obj["id_nasabah"] | String("");
    db_loker[total_loker].nomor_loker = obj["nomor_loker"].as<String>();
    total_loker++;
  }
  Serial.println("[DB] Loker di-cache: " + String(total_loker));
}

void restoreState() {
  String resp = sbGET("log_pintu?select=tipe_akses,is_anomali,id_nasabah&order=waktu_akses.desc&limit=1");
  if (resp == "" || resp == "[]") {
    Serial.println("[RESTORE] Tidak ada log sebelumnya.");
    return;
  }
  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, resp)) return;
  JsonObject last      = doc[0].as<JsonObject>();
  String     tipe      = last["tipe_akses"] | String("KELUAR");
  bool       anomali   = last["is_anomali"] | false;
  String     idNasabah = last["id_nasabah"] | String("");

  Serial.println("[RESTORE] Log terakhir: tipe=" + tipe
    + " anomali=" + String(anomali ? "true" : "false")
    + " id_nasabah=" + idNasabah);

  // [v5_1 merge] Tolak restore jika log terakhir adalah anomali
  if (tipe != "MASUK" || anomali || idNasabah == "" || idNasabah == "null") {
    Serial.println("[RESTORE] State: STANDBY");
    return;
  }

  nasabahAktif = cariNasabahByID(idNasabah);
  if (nasabahAktif != nullptr) {
    state      = DI_DALAM;
    timerDalam = millis();
    Serial.println("[RESTORE] Nasabah masih di dalam: " + nasabahAktif->nama);
    return;
  }
  Serial.println("[RESTORE] WARN: id_nasabah tidak ditemukan di cache → STANDBY");
}

// ============================================================
//  LOGGING ke Supabase
// ============================================================
void logPintu(String idNasabah, String tipe, bool anomali) {
  String body = "{\"tipe_akses\":\"" + tipe
              + "\",\"is_anomali\":" + String(anomali ? "true" : "false");
  if (idNasabah != "") body += ",\"id_nasabah\":\"" + idNasabah + "\"";
  body += "}";
  bool ok = sbPOST("log_pintu", body);
  Serial.println("[LOG] Pintu " + tipe + ": " + String(ok ? "OK" : "FAIL"));
}

String logPintuGetID(String idNasabah, String tipe, bool anomali) {
  String body = "{\"tipe_akses\":\"" + tipe
              + "\",\"is_anomali\":" + String(anomali ? "true" : "false");
  if (idNasabah != "") body += ",\"id_nasabah\":\"" + idNasabah + "\"";
  body += "}";
  String resp = sbPOSTGetBody("log_pintu", body);
  if (resp == "" || resp == "[]") return "";
  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, resp)) return "";
  return doc[0]["id"] | String("");
}

void logLoker(String idNasabah, String idLoker, String status) {
  String body = "{\"status_akses\":\"" + status + "\"";
  if (idNasabah != "") body += ",\"id_nasabah\":\"" + idNasabah + "\"";
  if (idLoker   != "") body += ",\"id_loker\":\""   + idLoker   + "\"";
  body += "}";
  bool ok = sbPOST("log_loker", body);
  Serial.println("[LOG] Loker " + status + ": " + String(ok ? "OK" : "FAIL"));
}

void triggerCameraCapture(String logPintuID) {
  String body = "{\"type\":\"CAPTURE_PHOTO\",\"status\":\"pending\","
                "\"payload\":{\"log_pintu_id\":\"" + logPintuID + "\"}}";
  sbPOST("commands", body);
}

// ============================================================
//  COMMAND POLLING (sama seperti v5)
// ============================================================
void updateCmdProgress(String cmdID, String nasabahId, String msg, int fpId) {
  String pl = "{\"nasabah_id\":\"" + nasabahId + "\",\"progress\":\"" + msg + "\"";
  if (fpId >= 0) pl += ",\"fingerprint_id\":" + String(fpId);
  pl += "}";
  bool ok = sbPATCH("commands?id=eq." + cmdID,
                    "{\"status\":\"pending\",\"payload\":" + pl + "}");
  Serial.println("[PROGRESS] " + msg.substring(0, 40) + (ok ? "" : " [FAIL]"));
}

void markCommandDone(String cmdID) {
  bool ok = sbPATCH("commands?id=eq." + cmdID, "{\"status\":\"done\"}");
  Serial.println("[CMD] Done: " + String(ok ? "OK" : "FAIL"));
}

void pollCommands() {
  String resp = sbGET(
    "commands"
    "?status=eq.pending"
    "&type=neq.CAPTURE_PHOTO"
    "&order=created_at.asc"
    "&limit=5"
    "&select=id,type,payload"
  );
  if (resp == "" || resp == "[]") return;

  DynamicJsonDocument doc(2048);
  if (deserializeJson(doc, resp)) return;
  JsonArray arr = doc.as<JsonArray>();
  if (arr.size() == 0) return;
  Serial.println("[POLL] " + String(arr.size()) + " command(s)");

  for (JsonObject cmd : arr) {
    String type  = cmd["type"].as<String>();
    String cmdID = cmd["id"].as<String>();
    Serial.println("[POLL] → " + type);

    bool selfHandled = false;

    if (type == "LOCK_ALL") {
      tutupBrankas(); tutupPintu();
      if (nasabahAktif) logPintu(nasabahAktif->id, "KELUAR", false);
      nasabahAktif = nullptr;
      state        = STANDBY;
      setLED(LED_STANDBY_OK);

    } else if (type == "RESET_ALARM") {
      state   = STANDBY;
      failOTP = 0;
      failFP  = 0;
      digitalWrite(BUZZER, LOW);
      setLED(LED_STANDBY_OK);

    } else if (type == "UNLOCK_DOOR") {
      bukaPintu();
      state      = PINTU_MASUK;
      timerPintu = millis();

    } else if (type == "REFRESH_CACHE") {
      fetchSettings(); delay(1000);
      fetchNasabah();  delay(1000);
      fetchLoker();
      timerCache = millis();

    } else if (type == "OTP_UNLOCK") {
      selfHandled = true;
      if (otpCache.active && otpCache.cmdId == cmdID) {
        // Command yang sama masih di-cache & sedang ditunggu input tombol — no-op,
        // jangan reset inputBuffer/cache (kalau tidak, partial input user kebuang
        // setiap kali poll 5 detik mengulang baca command pending yang sama).
      } else if (state != STANDBY) {
        sbPATCH("commands?id=eq." + cmdID,
          "{\"status\":\"error\",\"payload\":"
          "{\"progress\":\"DITOLAK: Alat tidak dalam mode STANDBY.\"}}");
      } else {
        String nasabahId = cmd["payload"]["nasabah_id"] | String("");
        String otpCode   = cmd["payload"]["otp_code"]   | String("");
        String expiresAt = cmd["payload"]["expires_at"] | String("");

        if (nasabahId == "" || nasabahId == "null" || otpCode == "" || expiresAt == "") {
          sbPATCH("commands?id=eq." + cmdID,
            "{\"status\":\"error\",\"payload\":"
            "{\"progress\":\"GAGAL: payload OTP tidak lengkap.\"}}");
        } else {
          // Ada OTP lama yang belum kepake/expired — tandai diganti, biar tidak
          // nyangkut 'pending' selamanya di DB (lihat insiden web dashboard).
          if (otpCache.active && otpCache.cmdId != cmdID) {
            Serial.println("[OTP] Menggantikan OTP lama, cmdId=" + otpCache.cmdId);
            sbPATCH("commands?id=eq." + otpCache.cmdId,
              "{\"status\":\"error\",\"payload\":{\"progress\":\"Digantikan OTP baru.\"}}");
          }

          otpCache.active         = true;
          otpCache.cmdId          = cmdID;
          otpCache.nasabahId      = nasabahId;
          otpCache.otpCode        = otpCode;
          otpCache.expiresAtEpoch = isoToEpoch(expiresAt);
          inputBuffer             = "";

          Serial.println("[OTP] Cached: nasabah=" + nasabahId
            + " expiresEpoch=" + String(otpCache.expiresAtEpoch));
        }
      }

    } else if (type == "ENROLL_FP") {
      selfHandled = true;
      if (state != STANDBY) {
        sbPATCH("commands?id=eq." + cmdID,
          "{\"status\":\"error\",\"payload\":"
          "{\"progress\":\"DITOLAK: Alat tidak dalam mode STANDBY.\"}}");
      } else {
        String nasabahId  = cmd["payload"]["nasabah_id"]   | String("");
        int    fpTargetId = cmd["payload"]["fingerprint_id"]| 0;
        if (nasabahId == "" || nasabahId == "null") {
          sbPATCH("commands?id=eq." + cmdID,
            "{\"status\":\"error\",\"payload\":"
            "{\"progress\":\"GAGAL: nasabah_id tidak valid.\"}}");
        } else if (fpTargetId < 1 || fpTargetId > 127) {
          // [v5_1 merge] Validasi range fingerprint_id sensor AS608
          sbPATCH("commands?id=eq." + cmdID,
            "{\"status\":\"error\",\"payload\":"
            "{\"progress\":\"GAGAL: fingerprint_id harus 1-127.\"}}");
        } else {
          handleEnrollFP(cmdID, nasabahId, fpTargetId);
        }
      }
    }

    if (!selfHandled) markCommandDone(cmdID);
  }
}

// ============================================================
//  ENROLL FINGERPRINT — dua kali scan & simpan ke sensor
// ============================================================
void handleEnrollFP(String cmdID, String nasabahId, int fpTargetId) {
  Serial.println("[ENROLL_FP] Mulai → ID=" + String(fpTargetId) + " nasabah=" + nasabahId);

  // ── Fase 1: scan jari pertama ─────────────────────────────
  updateCmdProgress(cmdID, nasabahId, "Tempelkan jari Anda ke sensor...", fpTargetId);
  buzzerBeep(100);

  unsigned long start = millis();
  int p = -1;
  while (millis() - start < ENROLL_TIMEOUT_MS) {
    blinkLED(LED_PROCESSING, 1, 250);
    p = finger.getImage();
    if (p == FINGERPRINT_OK) break;
    if (p == FINGERPRINT_NOFINGER) { delay(80); continue; }
    delay(100);
  }
  if (p != FINGERPRINT_OK) {
    updateCmdProgress(cmdID, nasabahId, "TIMEOUT: Tidak ada sidik jari terdeteksi.", fpTargetId);
    sbPATCH("commands?id=eq." + cmdID, "{\"status\":\"error\"}");
    blinkLED(LED_REJECTED, 3, 300);
    setLED(LED_STANDBY_OK);
    return;
  }
  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    updateCmdProgress(cmdID, nasabahId, "GAGAL: Kualitas gambar buruk. Coba lagi.", fpTargetId);
    sbPATCH("commands?id=eq." + cmdID, "{\"status\":\"error\"}");
    blinkLED(LED_REJECTED, 3, 300);
    setLED(LED_STANDBY_OK);
    return;
  }
  Serial.println("[ENROLL_FP] Gambar 1 OK");
  buzzerBeep(200);

  // ── Fase 2: angkat jari ────────────────────────────────────
  updateCmdProgress(cmdID, nasabahId, "Angkat jari dari sensor...", fpTargetId);
  setLED(LED_STANDBY_OK);
  delay(1000);
  start = millis();
  while (millis() - start < 10000) {
    if (finger.getImage() == FINGERPRINT_NOFINGER) break;
    delay(80);
  }

  // ── Fase 3: scan jari kedua ────────────────────────────────
  updateCmdProgress(cmdID, nasabahId, "Tempelkan jari yang SAMA lagi...", fpTargetId);
  buzzerBeep(100);

  start = millis();
  p     = -1;
  while (millis() - start < ENROLL_TIMEOUT_MS) {
    blinkLED(LED_PROCESSING, 1, 250);
    p = finger.getImage();
    if (p == FINGERPRINT_OK) break;
    if (p == FINGERPRINT_NOFINGER) { delay(80); continue; }
    delay(100);
  }
  if (p != FINGERPRINT_OK) {
    updateCmdProgress(cmdID, nasabahId, "TIMEOUT: Scan jari kedua gagal.", fpTargetId);
    sbPATCH("commands?id=eq." + cmdID, "{\"status\":\"error\"}");
    blinkLED(LED_REJECTED, 3, 300);
    setLED(LED_STANDBY_OK);
    return;
  }
  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    updateCmdProgress(cmdID, nasabahId, "GAGAL: Kualitas gambar jari kedua buruk.", fpTargetId);
    sbPATCH("commands?id=eq." + cmdID, "{\"status\":\"error\"}");
    blinkLED(LED_REJECTED, 3, 300);
    setLED(LED_STANDBY_OK);
    return;
  }
  Serial.println("[ENROLL_FP] Gambar 2 OK");

  // ── Buat model & simpan ────────────────────────────────────
  updateCmdProgress(cmdID, nasabahId, "Memproses & menyimpan sidik jari...", fpTargetId);
  setLED(LED_PROCESSING);

  p = finger.createModel();
  if (p == FINGERPRINT_ENROLLMISMATCH) {
    updateCmdProgress(cmdID, nasabahId, "GAGAL: Dua sidik jari tidak cocok. Ulangi.", fpTargetId);
    sbPATCH("commands?id=eq." + cmdID, "{\"status\":\"error\"}");
    blinkLED(LED_REJECTED, 3, 300);
    setLED(LED_STANDBY_OK);
    return;
  }
  if (p != FINGERPRINT_OK) {
    updateCmdProgress(cmdID, nasabahId, "GAGAL: Tidak dapat membuat model.", fpTargetId);
    sbPATCH("commands?id=eq." + cmdID, "{\"status\":\"error\"}");
    blinkLED(LED_REJECTED, 3, 300);
    setLED(LED_STANDBY_OK);
    return;
  }
  p = finger.storeModel(fpTargetId);
  if (p != FINGERPRINT_OK) {
    updateCmdProgress(cmdID, nasabahId, "GAGAL menyimpan ke sensor fingerprint.", fpTargetId);
    sbPATCH("commands?id=eq." + cmdID, "{\"status\":\"error\"}");
    blinkLED(LED_REJECTED, 3, 300);
    setLED(LED_STANDBY_OK);
    return;
  }
  Serial.println("[ENROLL_FP] Stored ID=" + String(fpTargetId));

  bool ok = sbPATCH("nasabah?id=eq." + nasabahId,
                    "{\"fingerprint_id\":" + String(fpTargetId) + "}");
  if (!ok) {
    updateCmdProgress(cmdID, nasabahId, "GAGAL menyimpan fingerprint_id ke database.", fpTargetId);
    sbPATCH("commands?id=eq." + cmdID, "{\"status\":\"error\"}");
    blinkLED(LED_REJECTED, 3, 300);
    setLED(LED_STANDBY_OK);
    return;
  }

  String finalPl = "{\"nasabah_id\":\"" + nasabahId
                 + "\",\"fingerprint_id\":" + String(fpTargetId)
                 + ",\"progress\":\"Berhasil! Sidik jari ID #"
                 + String(fpTargetId) + " tersimpan.\"}";
  sbPATCH("commands?id=eq." + cmdID, "{\"status\":\"done\",\"payload\":" + finalPl + "}");

  fetchNasabah();
  setLED(LED_STANDBY_OK);
  buzzerBeep(100); delay(80); buzzerBeep(100); delay(80); buzzerBeep(300);
  Serial.println("[ENROLL_FP] Done ID=" + String(fpTargetId));
}

// ============================================================
//  LOOKUP (cache)
// ============================================================
Nasabah* cariNasabahByID(String id) {
  for (int i = 0; i < total_nasabah; i++)
    if (db_nasabah[i].id == id) return &db_nasabah[i];
  return nullptr;
}
Nasabah* cariNasabahFP(int fpID) {
  for (int i = 0; i < total_nasabah; i++)
    if (db_nasabah[i].fingerprint_id == fpID) return &db_nasabah[i];
  return nullptr;
}
Loker* cariLoker(String idNasabah) {
  for (int i = 0; i < total_loker; i++)
    if (db_loker[i].id_nasabah == idNasabah) return &db_loker[i];
  return nullptr;
}

// ============================================================
//  UTILITAS WAKTU — parse ISO8601 UTC ("...Z") → unix epoch
//  Tidak pakai mktime() (bergantung timezone lokal yang sudah
//  di-set via configTime(GMT_OFFSET,...) untuk localtime()).
// ============================================================
static long daysFromCivil(int y, int m, int d) {
  // Howard Hinnant's days_from_civil — proleptic Gregorian, no library needed
  y -= m <= 2;
  long era    = (y >= 0 ? y : y - 399) / 400;
  unsigned yoe = (unsigned)(y - era * 400);
  unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097L + (long)doe - 719468L;
}

long isoToEpoch(const String& iso) {
  int y, mo, d, h, mi, se;
  if (sscanf(iso.c_str(), "%d-%d-%dT%d:%d:%d", &y, &mo, &d, &h, &mi, &se) != 6) return 0;
  return daysFromCivil(y, mo, d) * 86400L + h * 3600L + mi * 60L + se;
}

// ============================================================
//  TOMBOL — debounce + deteksi tepi tekan (dipanggil tiap loop())
// ============================================================
void updateButtons() {
  for (int i = 0; i < 6; i++) {
    bool raw = (digitalRead(BTN_PINS[i]) == LOW);   // aktif LOW (INPUT_PULLUP)
    buttonJustPressed[i] = false;

    if (raw != buttonRawLast[i]) {
      buttonChangeTime[i] = millis();
      buttonRawLast[i]    = raw;
    }

    if (millis() - buttonChangeTime[i] > BTN_DEBOUNCE_MS && raw != buttonState[i]) {
      buttonState[i] = raw;
      if (buttonState[i]) {
        buttonPressStart[i]  = millis();
        buttonJustPressed[i] = true;
      }
    }
  }
}

// ============================================================
//  JAM KERJA
// ============================================================
bool isJamKerja() {
  time_t now = time(nullptr);
  if (now < 1000000000) return true;  // NTP belum sync → beri akses
  struct tm* t = localtime(&now);
  return (t->tm_hour >= cfgJamBuka && t->tm_hour < cfgJamTutup);
}

// ============================================================
//  AKTUATOR
// ============================================================
void bukaPintu()    { servoPintu.write(0);   buzzerBeep(200); Serial.println("[HW] Pintu BUKA"); }
void tutupPintu()   { servoPintu.write(90);    Serial.println("[HW] Pintu KUNCI"); }
void bukaBrankas()  { servoBrankas.write(90); buzzerBeep(100); delay(80); buzzerBeep(100); Serial.println("[HW] Brankas BUKA"); }
void tutupBrankas() { servoBrankas.write(0);  Serial.println("[HW] Brankas KUNCI"); }

// ============================================================
//  ALARM — non-blocking, durasi 1 jam, bisa di-interrupt RESET_ALARM
//
//  Sebelumnya: while(millis()-s < 3600000) → loop() freeze 1 jam
//              → pollCommands() tidak jalan → RESET_ALARM dari web diabaikan
//
//  Sekarang:   triggerAlarm() hanya set state + catat waktu, lalu return.
//              loopAlarm() dipanggil tiap iterasi loop() → blink via millis().
//              pollCommands() tetap poll tiap 5 detik → RESET_ALARM bisa interrupt.
// ============================================================
void triggerAlarm() {
  state         = ALARM;
  alarmStartMs  = millis();
  alarmBlinkMs  = millis();
  alarmBuzzerOn = false;
  setLED(LED_REJECTED);
  digitalWrite(BUZZER, HIGH);
  Serial.println("[ALARM] !!! Pelanggaran keamanan !!! (maks 1 jam)");
}

void loopAlarm() {
  // Selesai otomatis setelah 1 jam
  if (millis() - alarmStartMs >= ALARM_DURATION) {
    digitalWrite(BUZZER, LOW);
    setLED(LED_STANDBY_OK);
    state   = STANDBY;
    failOTP = 0;
    failFP  = 0;
    Serial.println("[ALARM] 1 jam selesai. Kembali ke STANDBY.");
    return;
  }

  // Blink LED + buzzer tiap 200ms (non-blocking)
  if (millis() - alarmBlinkMs >= 200) {
    alarmBlinkMs  = millis();
    alarmBuzzerOn = !alarmBuzzerOn;
    if (alarmBuzzerOn) {
      setLED(LED_REJECTED);
      digitalWrite(BUZZER, HIGH);
    } else {
      setLED(LED_ALL_OFF);
      digitalWrite(BUZZER, LOW);
    }
  }
}

// ============================================================
//  BUZZER
// ============================================================
void buzzerBeep(int d) { digitalWrite(BUZZER, HIGH); delay(d); digitalWrite(BUZZER, LOW); }
void buzzerDenied()    { for (int i = 0; i < 3; i++) { buzzerBeep(100); delay(100); } }
void buzzerAlert()     { for (int i = 0; i < 2; i++) { buzzerBeep(400); delay(200); } }
void buzzerError()     { buzzerBeep(1500); }

// ============================================================
//  FINGERPRINT
// ============================================================
int scanFP() {
  if (finger.getImage()       != FINGERPRINT_OK) return -2;  // no finger
  if (finger.image2Tz()       != FINGERPRINT_OK) return -1;  // bad image
  if (finger.fingerFastSearch() == FINGERPRINT_OK) {
    Serial.println("[FP] ID=" + String(finger.fingerID)
      + " confidence=" + String(finger.confidence));
    return finger.fingerID;
  }
  return 0;  // not found
}

// ============================================================
//  WIFI
// ============================================================
void connectWiFi() {
  Serial.print("[WiFi] Connecting to " + String(WIFI_SSID));
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; WiFi.status() != WL_CONNECTED && i < 20; i++) {
    delay(500); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] OK — IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] GAGAL! Cek SSID/password.");
  }
}

const char* stateStr() {
  switch (state) {
    case STANDBY:      return "STANDBY";
    case PINTU_MASUK:  return "DOOR_ENTRY";
    case DI_DALAM:     return "INSIDE";
    case BRANKAS_BUKA: return "VAULT_OPEN";
    case PINTU_KELUAR: return "DOOR_EXIT";
    case ALARM:        return "ALARM";
    default:           return "UNKNOWN";
  }
}
