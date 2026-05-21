# KomikCast Scraper API 🚀

API scraper untuk KomikCast, di-deploy ke **Deno Deploy**.

---

## 📁 Struktur File

```
komikcast-api/
├── main.ts       ← Server utama (Hono routes)
├── scraper.ts    ← Logic scraping HTML
├── deno.json     ← Konfigurasi Deno
└── README.md
```

---

## 🛠️ Cara Deploy ke Deno Deploy

### Langkah 1 — Install Deno (lokal, opsional untuk testing)
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

### Langkah 3 — Upload ke GitHub
1. Buat repo baru di GitHub (misal: `komikcast-api`)
2. Push ketiga file (`main.ts`, `scraper.ts`, `deno.json`) ke repo tersebut

### Langkah 4 — Deploy ke Deno Deploy
1. Buka https://dash.deno.com
2. Klik **"New Project"**
3. Pilih **"Deploy from GitHub"**
4. Pilih repo `komikcast-api`
5. Set **entrypoint** ke `main.ts`
6. Klik **Deploy** ✅

Deno Deploy akan memberikan URL seperti:
```
https://komikcast-api.deno.dev
```

---

## 🌐 Daftar Endpoint

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/` | Info API |
| GET | `/api/latest?page=1` | Komik terbaru |
| GET | `/api/popular?page=1` | Komik terpopuler |
| GET | `/api/search?q=naruto&page=1` | Cari komik |
| GET | `/api/genre` | List semua genre |
| GET | `/api/genre/:slug?page=1` | Komik berdasarkan genre |
| GET | `/api/komik/:slug` | Detail komik + daftar chapter |
| GET | `/api/chapter/:slug` | Baca chapter (list gambar) |

---

## 💻 Contoh Response

### GET /api/latest
```json
{
  "success": true,
  "data": {
    "page": 1,
    "hasNext": true,
    "results": [
      {
        "title": "One Piece",
        "slug": "one-piece",
        "cover": "https://...",
        "type": "Manga",
        "status": "Ongoing",
        "chapter": "Chapter 1110",
        "rating": "9.5"
      }
    ]
  }
}
```

### GET /api/komik/:slug
```json
{
  "success": true,
  "data": {
    "title": "One Piece",
    "cover": "https://...",
    "type": "Manga",
    "status": "Ongoing",
    "author": "Eiichiro Oda",
    "genres": ["Action", "Adventure"],
    "synopsis": "...",
    "chapters": [
      { "title": "Chapter 1110", "slug": "one-piece-chapter-1110", "date": "2024-01-01" }
    ]
  }
}
```

### GET /api/chapter/:slug
```json
{
  "success": true,
  "data": {
    "title": "One Piece Chapter 1110",
    "images": ["https://cdn.../page1.jpg", "https://cdn.../page2.jpg"],
    "prev": "one-piece-chapter-1109",
    "next": "one-piece-chapter-1111"
  }
}
```

---

## 🔗 Integrasi di Mangnime (Next.js/React)

```javascript
// lib/api.js
const API_BASE = "https://komikcast-api.deno.dev";

export const getLatest = (page = 1) =>
  fetch(`${API_BASE}/api/latest?page=${page}`).then(r => r.json());

export const getKomikDetail = (slug) =>
  fetch(`${API_BASE}/api/komik/${slug}`).then(r => r.json());

export const getChapter = (slug) =>
  fetch(`${API_BASE}/api/chapter/${slug}`).then(r => r.json());

export const search = (q, page = 1) =>
  fetch(`${API_BASE}/api/search?q=${q}&page=${page}`).then(r => r.json());
```

```jsx
// Contoh penggunaan di komponen
const { data } = await getLatest(1);
data.results.map(komik => <KomikCard key={komik.slug} {...komik} />);
```

---

## ⚠️ Catatan Penting

- **CORS** sudah dikonfigurasi untuk `mangnime.vercel.app` dan `localhost:3000/5173`
- Jika ada perubahan struktur HTML di KomikCast, selector di `scraper.ts` perlu disesuaikan
- Deno Deploy **gratis** untuk penggunaan normal (100k request/hari)
- Tambahkan domain kamu di bagian `origin` di `main.ts` jika URL Vercel berbeda