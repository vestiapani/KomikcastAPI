// scraper.ts
const BE = "https://be.komikcast.cc";

// ─── Fetch Helper ─────────────────────────────────────────────────────────────
async function fetchAPI(path: string) {
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

// ─── LATEST ───────────────────────────────────────────────────────────────────
export async function getLatestKomik(page = 1) {
  const data = await fetchAPI(
    `/series?preset=rilisan_terbaru&take=20&takeChapter=3&page=${page}`,
  );
  return data;
}

// ─── POPULAR ──────────────────────────────────────────────────────────────────
export async function getPopularKomik(page = 1) {
  const data = await fetchAPI(
    `/series?preset=popular_all&take=20&takeChapter=2&page=${page}`,
  );
  return data;
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
export async function searchKomik(query: string, page = 1) {
  const rawFilter = `title=like="${query}",nativeTitle=like="${query}"`;
  const encodedFilter = encodeURIComponent(rawFilter);
  const data = await fetchAPI(
    `/series?filter=${encodedFilter}&take=20&page=${page}&includeMeta=true`,
  );
  return data;
}

// ─── GENRE LIST ───────────────────────────────────────────────────────────────
export async function getGenreList() {
  const data = await fetchAPI(`/genres`);
  return data;
}

// ─── KOMIK BY GENRE ───────────────────────────────────────────────────────────
export async function getKomikByGenre(genreSlug: string, page = 1, take = 12) {
  const data = await fetchAPI(
    `/series?genreIds=${genreSlug}&takeChapter=2&includeMeta=true&sort=latest&sortOrder=desc&take=${take}&page=${page}`
  );
  return data;
}

// ─── KOMIK DETAIL ─────────────────────────────────────────────────────────────
export async function getKomikDetail(slug: string) {
  const data = await fetchAPI(`/series/${slug}?includeMeta=true`);
  return data;
}

// ─── CHAPTER LIST (NEW) ───────────────────────────────────────────────────────
export async function getChapterList(seriesSlug: string) {
  const data = await fetchAPI(`/series/${seriesSlug}/chapters`);
  return data;
}

// ─── CHAPTER DETAIL ───────────────────────────────────────────────────────────
export async function getChapter(seriesSlug: string, chapterSlug: string) {
  const data = await fetchAPI(`/series/${seriesSlug}/chapters/${chapterSlug}`);
  return data;
}
