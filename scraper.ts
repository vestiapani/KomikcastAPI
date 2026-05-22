const BE = "https://be.komikcast.cc";

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; expiredAt: number }>();

const TTL = {
  home: 30 * 60 * 1000, // 30 menit
  list: 15 * 60 * 1000, // 15 menit (latest, popular, search, genre)
  detail: 60 * 60 * 1000, // 1 jam
  chapter: 24 * 60 * 60 * 1000, // 24 jam
};

function getCache(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiredAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown, ttl: number) {
  cache.set(key, { data, expiredAt: Date.now() + ttl });
}

// ─── Rate Limit Helper ────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Fetch Helper ─────────────────────────────────────────────────────────────
async function fetchAPI(path: string) {
  await delay(500);
  const res = await fetch(`${BE}${path}`, {
    headers: {
      Origin: "https://v2.komikcast.fit",
      Referer: "https://v2.komikcast.fit/",
      Accept: "application/json, text/plain, */*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${path}`);
  return await res.json();
}

// ─── NORMALIZERS ─────────────────────────────────────────────────────────────
const normalizeCard = (item: any) => {
  const d = item.data?.title ? item.data : item.data?.data || item.data || item;

  let chapterText = "";
  if (d.chapters && d.chapters.length > 0) {
    const firstCh = d.chapters[0].data || d.chapters[0];
    chapterText = `Ch ${firstCh.slug || firstCh.index || ""}`;
  } else if (d.totalChapters) {
    chapterText = `Ch ${d.totalChapters}`;
  }

  return {
    title: d.title || d.nativeTitle || "",
    slug: d.slug || "",
    image: d.coverImage || d.backgroundImage || d.cover || "",
    score: d.rating || "?",
    type: d.format || d.type || "Manga",
    status: d.status || "Ongoing",
    chapter: chapterText,
  };
};

const normalizeDetail = (detailItem: any, chaptersData: any[] = []) => {
  const d = detailItem.data?.title
    ? detailItem.data
    : detailItem.data?.data || detailItem.data || detailItem;

  const mappedGenres = (d.genres || []).map((g: any) => {
    const gData = g.data || g;
    return { id: g.id || gData.name, name: gData.name, slug: gData.name };
  });

  const mappedChapters = (chaptersData || []).map((ch: any) => {
    const chData = ch.data || ch;
    const chapSlug = chData.slug || chData.index;
    return {
      chapterIndex: chapSlug,
      title: chData.title || `Chapter ${chapSlug}`,
    };
  });

  return {
    title: d.title || "",
    nativeTitle: d.nativeTitle || "",
    slug: d.slug || "",
    cover: d.coverImage || d.cover || "",
    backgroundImage: d.backgroundImage || d.coverImage || "",
    rating: d.rating || "?",
    status: d.status || "Unknown",
    author: d.author || "Unknown",
    format: d.format || d.type || "Manga",
    totalChapters: d.totalChapters || mappedChapters.length || 0,
    synopsis: d.synopsis || "Sinopsis belum tersedia.",
    genres: mappedGenres,
    readChapter: mappedChapters,
    recommended: (d.recommended || []).map(normalizeCard),
  };
};

const normalizeChapterDetail = (
  item: any,
  seriesSlug: string,
  chapterSlug: string,
) => {
  const d = item.data?.title ? item.data : item.data?.data || item.data || item;
  return {
    komikTitle: d.title || seriesSlug.replace(/-/g, " "),
    chapterIndex: chapterSlug,
    images: d.images || [],
    prevChapterId: d.prev || null,
    nextChapterId: d.next || null,
  };
};

// ─── API FUNCTIONS ────────────────────────────────────────────────────────────

// 1. GET HOME
export async function getHomeData() {
  const key = "home";
  const cached = getCache(key);
  if (cached) return cached;

  const popularRes = await fetchAPI(
    `/series?preset=popular_all&take=10&page=1`,
  );
  const latestRes = await fetchAPI(
    `/series?preset=rilisan_terbaru&take=15&page=1`,
  );

  const result = {
    popular: (popularRes?.data || []).map(normalizeCard),
    newest: (latestRes?.data || []).map(normalizeCard),
  };

  setCache(key, result, TTL.home);
  return result;
}

// 2. LATEST
export async function getLatestKomik(page = 1) {
  const key = `latest:${page}`;
  const cached = getCache(key);
  if (cached) return cached;

  const data = await fetchAPI(
    `/series?preset=rilisan_terbaru&take=20&page=${page}`,
  );
  const result = {
    data: (data?.data || []).map(normalizeCard),
    meta: data?.meta || { page, lastPage: 50 },
  };

  setCache(key, result, TTL.list);
  return result;
}

// 3. POPULAR
export async function getPopularKomik(page = 1, category = "all") {
  const key = `popular:${page}:${category}`;
  const cached = getCache(key);
  if (cached) return cached;

  const filter = category && category !== "all" ? `&format=${category}` : "";
  const data = await fetchAPI(
    `/series?preset=popular_all&take=20&page=${page}${filter}`,
  );
  const result = {
    data: (data?.data || []).map(normalizeCard),
    meta: data?.meta || { page, lastPage: 50 },
  };

  setCache(key, result, TTL.list);
  return result;
}

// 4. SEARCH
export async function searchKomik(
  query: string,
  page = 1,
  genreIds: string = "",
) {
  const key = `search:${query}:${page}:${genreIds}`;
  const cached = getCache(key);
  if (cached) return cached;

  let url = `/series?take=20&page=${page}&includeMeta=true`;
  if (query) {
    const rawFilter = `title=like="${query}",nativeTitle=like="${query}"`;
    url += `&filter=${encodeURIComponent(rawFilter)}`;
  }
  if (genreIds) url += `&genreIds=${genreIds}`;

  const data = await fetchAPI(url);
  const result = {
    data: (data?.data || []).map(normalizeCard),
    meta: data?.meta || { page, lastPage: 50 },
  };

  setCache(key, result, TTL.list);
  return result;
}

// 5. KOMIK DETAIL
export async function getKomikDetail(slug: string) {
  const key = `detail:${slug}`;
  const cached = getCache(key);
  if (cached) return cached;

  const detailRaw = await fetchAPI(`/series/${slug}?includeMeta=true`).catch(
    () => null,
  );
  const chaptersRaw = await fetchAPI(`/series/${slug}/chapters`).catch(
    () => null,
  );
  const result = normalizeDetail(detailRaw, chaptersRaw?.data || []);

  setCache(key, result, TTL.detail);
  return result;
}

// 6. CHAPTER DETAIL
export async function getChapterDetail(
  seriesSlug: string,
  chapterSlug: string,
) {
  const key = `chapter:${seriesSlug}:${chapterSlug}`;
  const cached = getCache(key);
  if (cached) return cached;

  const data = await fetchAPI(`/series/${seriesSlug}/chapters/${chapterSlug}`);
  const result = normalizeChapterDetail(data, seriesSlug, chapterSlug);

  setCache(key, result, TTL.chapter);
  return result;
}

// 7. GENRE LIST
export async function getGenreList() {
  const key = "genres";
  const cached = getCache(key);
  if (cached) return cached;

  const data = await fetchAPI(`/genres`);
  const genresArray = data?.data || data || [];
  const result = genresArray.map((g: any) => {
    const gData = g.data || g;
    return {
      id: g.id,
      data: { name: gData.name, description: gData.description },
    };
  });

  setCache(key, result, TTL.detail);
  return result;
}

// 8. KOMIK BY GENRE
export async function getKomikByGenre(genreSlug: string, page = 1, take = 12) {
  const key = `genre:${genreSlug}:${page}`;
  const cached = getCache(key);
  if (cached) return cached;

  const data = await fetchAPI(
    `/series?genreIds=${genreSlug}&sort=latest&sortOrder=desc&take=${take}&page=${page}`,
  );
  const result = {
    data: (data?.data || []).map(normalizeCard),
    meta: data?.meta || { page, lastPage: 50 },
  };

  setCache(key, result, TTL.list);
  return result;
}
