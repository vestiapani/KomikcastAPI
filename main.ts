import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { getConnInfo } from "npm:hono/deno"; // ✅ FIX: Import alat pelacak IP asli Deno
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

// --- CCTV LOGGER ---
app.use("*", logger());
app.use("*", async (c, next) => {
  const userAgent = c.req.header("User-Agent") || "Unknown Bot";
  
  const blockedBots = ["ClaudeBot", "GPTBot", "ChatGPT", "CCBot"];
  const isBotBlocked = blockedBots.some((bot) => userAgent.includes(bot));

  if (isBotBlocked) {
    console.log(`[DITENDANG] AI Bot mencoba masuk: ${userAgent}`);
    return c.json(
      { success: false, message: "AI Bots are strictly prohibited." },
      403,
    );
  }

  const info = getConnInfo(c);
  const ip = c.req.header("x-forwarded-for") || 
             c.req.header("x-real-ip") || 
             c.req.header("cf-connecting-ip") || 
             info?.remote?.address ||
             "Unknown IP";
  
  console.log(`[CCTV] Akses dari IP: ${ip} | User-Agent: ${userAgent}`);
  await next();
});

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

// ─── Rate Limiter (Satpam Penjaga) ───────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = { maxRequests: 100, windowMs: 60 * 1000 };

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return true;
  }
  if (entry.count >= RATE_LIMIT.maxRequests) return false;
  entry.count++;
  return true;
}

app.use("/api/*", async (c, next) => {
  const authToken = c.req.header("Authorization");
  const SECRET_KEY = Deno.env.get("API_SECRET_KEY");

  if (!authToken || authToken !== `Bearer ${SECRET_KEY}`) {
    return c.json(
      {
        success: false,
        message: "Akses ditolak. Token tidak valid atau tidak disertakan.",
      },
      401,
    );
  }

  const info = getConnInfo(c);
  const ip =
    c.req.header("x-forwarded-for") ||
    c.req.header("x-real-ip") ||
    c.req.header("cf-connecting-ip") ||
    info?.remote?.address ||
    "Unknown IP";

  if (!checkRateLimit(ip)) {
    return c.json(
      {
        success: false,
        message: "Terlalu banyak request. Server sedang sibuk.",
      },
      429,
    );
  }
  await next();
});

// ─── Input Sanitizer ──────────────────────────────────────────────────────────
function sanitize(input: string, maxLength = 100): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>"'`;]/g, "");
}

function sanitizePage(raw: string | undefined): number {
  const n = Number(raw ?? 1);
  return Math.min(Math.max(Number.isFinite(n) ? n : 1, 1), 500);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ok = (c: any, data: unknown) => c.json({ success: true, data }, 200);
const err = (c: any, message: string, status = 500) =>
  c.json({ success: false, message }, status);

// ─── PLAYGROUND ───────────────────────────────────────────────────────────────
app.get("/", async (c) => {
  try {
    const html = await Deno.readTextFile("./public/index.html");
    return c.html(html);
  } catch {
    return c.json({ message: "Playground UI tidak ditemukan." });
  }
});

// ─── ENDPOINTS ────────────────────────────────────────────────────────────────
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
    const page = sanitizePage(c.req.query("page"));
    const data = await getLatestKomik(page);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

app.get("/api/popular", async (c) => {
  try {
    const page = sanitizePage(c.req.query("page"));
    const category = sanitize(c.req.query("category") ?? "all", 20);
    const data = await getPopularKomik(page, category);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

app.get("/api/advanceSearch", async (c) => {
  try {
    const search = sanitize(c.req.query("search") || "", 100);
    const genreIds = sanitize(c.req.query("genreIds") || "", 50);
    const page = sanitizePage(c.req.query("page"));

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
    const slug = sanitize(c.req.param("slug"), 200);
    const data = await getKomikDetail(slug);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

app.get("/api/komik/:slug/:chapterId", async (c) => {
  try {
    const slug = sanitize(c.req.param("slug"), 200);
    const chapterId = sanitize(c.req.param("chapterId"), 100);
    const data = await getChapterDetail(slug, chapterId);
    return ok(c, data);
  } catch (e) {
    return err(c, (e as Error).message);
  }
});

app.notFound((c) => err(c, "Endpoint tidak ditemukan", 404));

Deno.serve({ port: 8000 }, app.fetch);
console.log("🚀 Server berjalan di http://localhost:8000");