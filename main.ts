import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import {
  getLatestKomik,
  getPopularKomik,
  getKomikDetail,
  getChapter,
  searchKomik,
  getGenreList,
  getKomikByGenre,
} from "./scraper.ts";

const app = new Hono();

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  "/*",
  cors({
    origin: [
      "https://mangnime.vercel.app",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

// ─── Helper response ──────────────────────────────────────────────────────────
const ok = (c: any, data: unknown) => c.json({ success: true, data }, 200);

const err = (c: any, message: string, status = 500) =>
  c.json({ success: false, message }, status);

// ─── ROOT — serve playground UI ───────────────────────────────────────────────
app.get("/", async (c) => {
  try {
    const html = await Deno.readTextFile("./public/index.html");
    return c.html(html);
  } catch {
    return c.json({
      name: "KomikCast Scraper API",
      version: "1.0.0",
      endpoints: [
        "GET /api/latest?page=1",
        "GET /api/popular?page=1",
        "GET /api/search?q=demon&page=1",
        "GET /api/genre",
        "GET /api/genre/:slug?page=1",
        "GET /api/komik/:slug",
        "GET /api/chapter/:series/:chapter",
      ],
    });
  }
});

// ─── LATEST ───────────────────────────────────────────────────────────────────
app.get("/api/latest", async (c) => {
  try {
    const page = Number(c.req.query("page") ?? 1);
    const data = await getLatestKomik(page);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

// ─── POPULAR ──────────────────────────────────────────────────────────────────
app.get("/api/popular", async (c) => {
  try {
    const page = Number(c.req.query("page") ?? 1);
    const data = await getPopularKomik(page);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

// ─── SEARCH ───────────────────────────────────────────────────────────────────
app.get("/api/search", async (c) => {
  try {
    const q = c.req.query("q");
    const page = Number(c.req.query("page") ?? 1);
    if (!q) return err(c, "Parameter ?q= wajib diisi", 400);
    const data = await searchKomik(q, page);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

// ─── GENRE LIST ───────────────────────────────────────────────────────────────
app.get("/api/genre", async (c) => {
  try {
    const data = await getGenreList();
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

// ─── KOMIK BY GENRE ───────────────────────────────────────────────────────────
app.get("/api/genre/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const page = Number(c.req.query("page") ?? 1);
    const data = await getKomikByGenre(slug, page);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

// ─── KOMIK DETAIL ─────────────────────────────────────────────────────────────
app.get("/api/komik/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const data = await getKomikDetail(slug);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

// ─── CHAPTER (Menangkap :series dan :chapter) ─────────────────────────────────
app.get("/api/chapter/:series/:chapter", async (c) => {
  try {
    const series = c.req.param("series");
    const chapter = c.req.param("chapter");
    const data = await getChapter(series, chapter);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.notFound((c) => err(c, "Endpoint tidak ditemukan", 404));

Deno.serve({ port: 8000 }, app.fetch);
console.log("🚀 Server berjalan di http://localhost:8000");
