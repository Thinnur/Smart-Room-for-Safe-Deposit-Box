# Web Dashboard Smart Deposit Box

Dashboard Admin berbasis web untuk memantau sistem **Smart Safe Deposit Box** secara real-time. Dibangun menggunakan React + Vite + Supabase.

## ✨ Fitur

- 📊 **Real-time Monitoring** — Log akses pintu & loker diperbarui otomatis via Supabase Realtime
- 🔐 **Akses Log** — Rekam jejak siapa yang membuka/menutup deposit box beserta timestamp
- 🚨 **Alert Anomali** — Notifikasi langsung saat terdeteksi aktivitas mencurigakan
- 🌙 **Dark / Light Mode** — Toggle tema dengan preferensi tersimpan
- 📱 **Responsif** — Tampilan optimal di desktop maupun mobile

## 🛠️ Tech Stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Supabase](https://supabase.com/) (Database + Realtime + Auth)
- CSS (Vanilla, custom design system)

## 🚀 Cara Menjalankan

### 1. Clone repository

```bash
git clone https://github.com/Thinnur/Web_Dashboard_Smart_Deposit_Box.git
cd Web_Dashboard_Smart_Deposit_Box
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup environment variables

Salin `.env.example` menjadi `.env` dan isi dengan kredensial Supabase Anda:

```bash
cp .env.example .env
```

Edit file `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ **Jangan pernah commit file `.env`** yang berisi nilai asli ke repository!

### 4. Jalankan development server

```bash
npm run dev
```

Buka browser di `http://localhost:5173`

## 📁 Struktur Project

```
src/
├── components/     # Komponen UI (Header, Sidebar, Cards, dll.)
├── context/        # React Context (ThemeContext, dll.)
├── lib/            # Supabase client
├── App.jsx         # Root component & routing
├── main.jsx        # Entry point
└── index.css       # Global styles & design system
```

## 🔒 Keamanan

- Semua kredensial disimpan di `.env` (tidak di-commit)
- Menggunakan Supabase **anon key** (bukan service role key)
- Row Level Security (RLS) diaktifkan di Supabase

## 📄 Lisensi

MIT — untuk keperluan akademik Semester 4.
