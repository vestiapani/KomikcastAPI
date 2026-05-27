# KomikCast Adapter API 🚀

API adapter untuk [MangNime](https://mangnime.vercel.app) yang bertindak sebagai jembatan antara frontend Next.js dengan backend asli KomikCast. Di-deploy ke **Deno Deploy**.

---

## 📁 Struktur File

```
KomikcastAPI/
├── main.ts         ← Server utama (Hono routes, rate limiter, sanitizer)
├── scraper.ts      ← Logic fetching + normalisasi data ke format MangNime
├── deno.json       ← Konfigurasi Deno
├── public/
│   └── index.html  ← API Playground (dashboard testing live)
└── README.md
```

---

## 🏗️ Arsitektur

```
MangNime (Next.js)
      ↓  fetch
main.ts  (Hono — routing, rate limit, sanitize input)
      ↓
scraper.ts  (fetch ke BE KomikCast → normalisasi → in-memory cache)
      ↓
be.komikcast.cc  (backend asli KomikCast)
```

**Adapter Pattern** — data mentah dari KomikCast dinormalisasi agar 100% kompatibel dengan format yang diharapkan frontend MangNime, tanpa perlu mengubah komponen UI.

---

## 🛡️ Fitur Keamanan

- **Rate Limiting** — 60 request/menit per IP, respons 429 jika terlampaui
- **Input Sanitizer** — semua parameter query & slug dibersihkan dari karakter berbahaya
- **CORS** — hanya domain MangNime dan localhost yang diizinkan
- **In-Memory Cache** — mengurangi beban hit ke backend KomikCast

---

## 🛠️ Cara Deploy

### Langkah 1 — Install Deno (opsional, untuk testing lokal)

```bash
# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex

# Mac/Linux
curl -fsSL https://deno.land/install.sh | sh
```

### Langkah 2 — Test di lokal

```bash
deno task dev
# Server berjalan di http://localhost:8000
```

### Langkah 3 — Push ke GitHub

```bash
git add .
git commit -m "deploy: initial setup"
git push origin main
```

### Langkah 4 — Deploy ke Deno Deploy

1. Buka https://dash.deno.com
2. Klik **"New Project"** → **"Deploy from GitHub"**
3. Pilih repo `KomikcastAPI`
4. Set **entrypoint** ke `main.ts`
5. Klik **Deploy** ✅

URL yang didapat:
```

```

---

## 🌐 Daftar Endpoint

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/` | API Playground |
| GET | `/api/home` | Data home (popular + terbaru) |
| GET | `/api/latest?page=1` | Komik update terbaru |
| GET | `/api/popular?page=1&category=all` | Komik terpopuler |
| GET | `/api/advanceSearch?search=naruto` | Cari komik by judul |
| GET | `/api/advanceSearch?genreIds=19` | Cari komik by genre ID |
| GET | `/api/genres` | List semua genre |
| GET | `/api/komik/:slug` | Detail komik + daftar chapter |
| GET | `/api/komik/:slug/:chapterId` | Baca chapter (list gambar) |

**Filter `category`** pada `/api/popular`: `all` · `manga` · `manhwa` · `manhua`

---

## 💻 Contoh Response

### GET /api/home

```json
{
  "success": true,
  "data": {
    "popular": [
      {
        "title": "Magic Emperor",
        "slug": "magic-emperor",
        "image": "https://minio.imgkc1.my.id/...",
        "score": 9,
        "type": "manhua",
        "status": "ongoing",
        "chapter": "Ch 865"
      }
    ],
    "newest": []
  }
}
```

### GET /api/komik/:slug

```json
{
  "success": true,
  "data": {
    "title": "Nano Machine",
    "nativeTitle": "나노 마신",
    "slug": "nano-machine",
    "cover": "https://minio.imgkc1.my.id/...",
    "backgroundImage": "https://minio.imgkc1.my.id/...",
    "rating": 9,
    "status": "ongoing",
    "author": "Geumgang Bulgoe",
    "format": "manhwa",
    "totalChapters": 315,
    "synopsis": "...",
    "genres": [
      { "id": 19, "name": "Action", "slug": "Action" }
    ],
    "readChapter": [
      { "chapterIndex": "315", "title": "Chapter 315" }
    ],
    "recommended": []
  }
}
```

### GET /api/komik/:slug/:chapterId

```json
{
  "success": true,
  "data": {
    "komikTitle": "Nano Machine",
    "chapterIndex": "315",
    "images": ["https://cdn.../page1.webp", "https://cdn.../page2.webp"],
    "prevChapterId": "314",
    "nextChapterId": null
  }
}
```

---

## ⏱️ Cache TTL

| Data | Durasi |
|------|--------|
| Home | 20 menit |
| Latest / Popular / Search | 10 menit |
| Detail komik | 30 menit |
| Chapter (gambar) | 24 jam |

Cache disimpan di memori Deno Deploy dan akan reset saat instance restart atau deploy ulang.

---

## 🔗 Integrasi di MangNime (Next.js)

```javascript
// services/komikApi.js
const KOMIK_API_URL = "https://komikcastapi.vestiapani.deno.net/api";

export const getHomeKomik     = (options = {}) => fetchKomikAPI("/home", 0, options);
export const getLatestKomik   = (page = 1, options = {}) => fetchKomikAPI(`/latest?page=${page}`, 0, options);
export const getPopularKomik  = (page = 1, category = "all", options = {}) => fetchKomikAPI(`/popular?category=${category}&page=${page}`, 0, options);
export const getKomikDetail   = (slug, options = {}) => fetchKomikAPI(`/komik/${slug}`, 0, options);
export const getChapterDetail = (slug, chapterId, options = {}) => fetchKomikAPI(`/komik/${slug}/${chapterId}`, 0, options);
export const searchKomik      = (keyword, options = {}) => fetchKomikAPI(`/advanceSearch?search=${encodeURIComponent(keyword)}`, 0, options);
```

---

## ⚠️ Catatan Penting

- **Signed URL gambar** dari KomikCast expire setiap 24 jam — TTL cache di-set di bawah batas ini agar gambar tidak broken
- **Rate limit** hanya berlaku untuk endpoint `/api/*`, halaman Playground `/` tidak terkena
- Jika struktur response backend KomikCast berubah, sesuaikan fungsi `normalizeCard` / `normalizeDetail` di `scraper.ts`
- Tambahkan domain kamu di array `origin` pada `main.ts` jika URL Vercel berbeda dari `mangnime.vercel.app`
- Deno Deploy **gratis** hingga 100k request/hari
