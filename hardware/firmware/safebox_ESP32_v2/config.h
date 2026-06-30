// ============================================================
//  config.h.example — Smart Safe Deposit Box
//
//  CARA PAKAI:
//  1. Salin file ini: cp config.h.example config.h
//  2. Isi nilai di bawah sesuai konfigurasi kamu
//  3. JANGAN pernah commit config.h ke repository!
//     (sudah ada di .gitignore)
//
//  Temukan Supabase URL & KEY di:
//  Supabase Dashboard → Project Settings → API
// ============================================================
#pragma once

// ── WiFi ────────────────────────────────────────────────────
#define CFG_WIFI_SSID      "COLD N BREW LT.1"
#define CFG_WIFI_PASSWORD  "cnbparis"

// ── Supabase ─────────────────────────────────────────────────
#define CFG_SUPABASE_URL   "https://wzyrbmxpxfvsqxroyoyu.supabase.co"
#define CFG_SUPABASE_KEY   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6eXJibXhweGZ2c3F4cm95b3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODY3MTQsImV4cCI6MjA5MzQ2MjcxNH0.dJPvtjZePc2kgZLCfHQQBS-javob6rgZf6KrGIAMbOw"

// ── NTP / Timezone ───────────────────────────────────────────
// GMT+7 untuk WIB (Waktu Indonesia Barat)
#define CFG_NTP_SERVER     "pool.ntp.org"
#define CFG_GMT_OFFSET     (7L * 3600L)
