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

// ─── NORMALIZERS (Menerjemahkan API Asli ke Format MangNime) ────────────────
const normalizeCard = (item: any) => {
  // Menembus bungkus ganda JSON: item -> item.data -> item.data.data
  const d = item.data?.title ? item.data : item.data?.data || item.data || item;

  // ✅ FIX: Ekstrak chapter dengan melihat properti 'index' jika 'slug' null
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

  // Menyesuaikan format Genre untuk MangNime
  const mappedGenres = (d.genres || []).map((g: any) => {
    const gData = g.data || g;
    return { id: g.id || gData.name, name: gData.name, slug: gData.name };
  });

  // ✅ FIX: Menyesuaikan format Chapter list dengan menangkap properti 'index'
  const mappedChapters = (chaptersData || []).map((ch: any) => {
    const chData = ch.data || ch;
    const chapSlug = chData.slug || chData.index; // <-- Menggunakan .index
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
    // Menambahkan rekomendasi komik di halaman detail
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
    images: d.images || [], // Biasanya array string URL gambar
    prevChapterId: d.prev || null,
    nextChapterId: d.next || null,
  };
};

// ─── API FUNCTIONS ────────────────────────────────────────────────────────────

// 1. GET HOME
export async function getHomeData() {
  const [popularRes, latestRes] = await Promise.all([
    fetchAPI(`/series?preset=popular_all&take=10&page=1`),
    fetchAPI(`/series?preset=rilisan_terbaru&take=15&page=1`),
  ]);

  return {
    popular: (popularRes?.data || []).map(normalizeCard),
    newest: (latestRes?.data || []).map(normalizeCard),
  };
}

// 2. LATEST
export async function getLatestKomik(page = 1) {
  const data = await fetchAPI(
    `/series?preset=rilisan_terbaru&take=20&page=${page}`,
  );
  return {
    data: (data?.data || []).map(normalizeCard),
    meta: data?.meta || { page, lastPage: 50 },
  };
}

// 3. POPULAR (Fix Category: Manga, Manhwa, Manhua)
export async function getPopularKomik(page = 1, category = "all") {
  const filter = category && category !== "all" ? `&format=${category}` : "";
  const data = await fetchAPI(
    `/series?preset=popular_all&take=20&page=${page}${filter}`,
  );
  return {
    data: (data?.data || []).map(normalizeCard),
    meta: data?.meta || { page, lastPage: 50 },
  };
}

// 4. SEARCH
export async function searchKomik(query: string, page = 1) {
  const rawFilter = `title=like="${query}",nativeTitle=like="${query}"`;
  const encodedFilter = encodeURIComponent(rawFilter);
  const data = await fetchAPI(
    `/series?filter=${encodedFilter}&take=20&page=${page}&includeMeta=true`,
  );
  return {
    data: (data?.data || []).map(normalizeCard),
    meta: data?.meta || { page, lastPage: 50 },
  };
}

// 5. KOMIK DETAIL (Menggabungkan Detail + List Chapter)
export async function getKomikDetail(slug: string) {
  const [detailRaw, chaptersRaw] = await Promise.all([
    fetchAPI(`/series/${slug}?includeMeta=true`).catch(() => null),
    fetchAPI(`/series/${slug}/chapters`).catch(() => null),
  ]);

  return normalizeDetail(detailRaw, chaptersRaw?.data || []);
}

// 6. CHAPTER DETAIL (Baca Komik)
export async function getChapterDetail(
  seriesSlug: string,
  chapterSlug: string,
) {
  const data = await fetchAPI(`/series/${seriesSlug}/chapters/${chapterSlug}`);
  return normalizeChapterDetail(data, seriesSlug, chapterSlug);
}

// 7. GENRE LIST
export async function getGenreList() {
  const data = await fetchAPI(`/genres`);
  // Pastikan formatnya sesuai yang dibutuhkan frontend
  const genresArray = data?.data || data || [];
  return genresArray.map((g: any) => {
    const gData = g.data || g;
    return {
      id: g.id,
      data: { name: gData.name, description: gData.description },
    };
  });
}

// 8. KOMIK BY GENRE
export async function getKomikByGenre(genreSlug: string, page = 1, take = 12) {
  const data = await fetchAPI(
    `/series?genreIds=${genreSlug}&sort=latest&sortOrder=desc&take=${take}&page=${page}`,
  );
  return {
    data: (data?.data || []).map(normalizeCard),
    meta: data?.meta || { page, lastPage: 50 },
  };
}
