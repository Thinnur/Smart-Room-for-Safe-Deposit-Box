-- Jalankan file ini di Supabase SQL Editor untuk setup database dari awal.

-- 1. CREATE TABLE nasabah
CREATE TABLE nasabah (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    rfid_uid TEXT UNIQUE,
    fingerprint_id INTEGER UNIQUE CHECK (fingerprint_id BETWEEN 1 AND 127),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. CREATE TABLE loker
CREATE TABLE loker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_loker TEXT NOT NULL UNIQUE,
    id_nasabah UUID REFERENCES nasabah(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CREATE TABLE log_pintu
CREATE TABLE log_pintu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_nasabah UUID REFERENCES nasabah(id) ON DELETE SET NULL,
    tipe_akses TEXT NOT NULL CHECK (tipe_akses IN ('MASUK', 'KELUAR')),
    is_anomali BOOLEAN NOT NULL DEFAULT false,
    url_foto TEXT,
    waktu_akses TIMESTAMPTZ DEFAULT now()
);

-- 4. CREATE TABLE log_loker
CREATE TABLE log_loker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_nasabah UUID REFERENCES nasabah(id) ON DELETE SET NULL,
    id_loker UUID REFERENCES loker(id) ON DELETE SET NULL,
    status_akses TEXT NOT NULL CHECK (status_akses IN ('BERHASIL', 'GAGAL')),
    waktu_akses TIMESTAMPTZ DEFAULT now()
);

-- 5. CREATE TABLE commands
CREATE TABLE commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','error','cancelled')),
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CREATE TABLE system_settings
CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    jam_buka TIME NOT NULL DEFAULT '08:00',
    jam_tutup TIME NOT NULL DEFAULT '23:00',
    CONSTRAINT check_only_one_row CHECK (id = 1)
);

-- 7. CREATE OR REPLACE VIEW view_log_pintu
CREATE OR REPLACE VIEW view_log_pintu AS
SELECT log_pintu.*, nasabah.nama, nasabah.rfid_uid
FROM log_pintu
LEFT JOIN nasabah ON log_pintu.id_nasabah = nasabah.id
ORDER BY log_pintu.waktu_akses DESC;

-- 8. CREATE OR REPLACE VIEW view_log_loker
CREATE OR REPLACE VIEW view_log_loker AS
SELECT log_loker.*, nasabah.nama AS nama_pengakses, loker.nomor_loker
FROM log_loker
LEFT JOIN nasabah ON log_loker.id_nasabah = nasabah.id
LEFT JOIN loker ON log_loker.id_loker = loker.id
ORDER BY log_loker.waktu_akses DESC;

-- 9. Enable RLS pada semua tabel
ALTER TABLE nasabah ENABLE ROW LEVEL SECURITY;
ALTER TABLE loker ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_pintu ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_loker ENABLE ROW LEVEL SECURITY;
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 10. Buat policy anon read+write untuk semua tabel
CREATE POLICY "anon_all" ON nasabah FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON loker FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON log_pintu FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON log_loker FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON commands FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON system_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- 11. Tambahkan INSERT awal untuk system_settings
INSERT INTO system_settings (id, jam_buka, jam_tutup)
VALUES (1, '08:00', '23:00')
ON CONFLICT (id) DO NOTHING;
