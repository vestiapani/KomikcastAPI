import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import {
  getHomeData,
  getLatestKomik,
  getPopularKomik,
  getKomikDetail,
  getChapterDetail,
  searchKomik,
  getGenreList,
} from "./scraper.ts";

const app = new Hono();

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

const ok = (c: any, data: unknown) => c.json({ success: true, data }, 200);
const err = (c: any, message: string, status = 500) =>
  c.json({ success: false, message }, status);

app.get("/", async (c) => {
  try {
    const html = await Deno.readTextFile("./public/index.html");
    return c.html(html);
  } catch {
    return c.json({ message: "Playground UI tidak ditemukan." });
  }
});

// ─── ENDPOINT SESUAI MANGNIME (OLD API) ───────────────────────────────────────

app.get("/api/home", async (c) => {
  try {
    const data = await getHomeData();
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

app.get("/api/latest", async (c) => {
  try {
    const page = Number(c.req.query("page") ?? 1);
    const data = await getLatestKomik(page);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

app.get("/api/popular", async (c) => {
  try {
    const page = Number(c.req.query("page") ?? 1);
    const category = c.req.query("category") ?? "all";
    const data = await getPopularKomik(page, category);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

app.get("/api/advanceSearch", async (c) => {
  try {
    const search = c.req.query("search") || "";
    const genreIds = c.req.query("genreIds") || "";
    const page = Number(c.req.query("page") ?? 1);

    // ✅ Memperbolehkan pencarian asalkan setidaknya ada 'search' atau 'genreIds'
    if (!search && !genreIds)
      return err(c, "Parameter ?search= atau ?genreIds= wajib diisi", 400);

    const data = await searchKomik(search, page, genreIds);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

app.get("/api/genres", async (c) => {
  try {
    const data = await getGenreList();
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

app.get("/api/komik/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const data = await getKomikDetail(slug);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

app.get("/api/komik/:slug/:chapterId", async (c) => {
  try {
    const slug = c.req.param("slug");
    const chapterId = c.req.param("chapterId");
    const data = await getChapterDetail(slug, chapterId);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

app.notFound((c) => err(c, "Endpoint tidak ditemukan", 404));

Deno.serve({ port: 8000 }, app.fetch);
console.log("🚀 Server berjalan di http://localhost:8000");
