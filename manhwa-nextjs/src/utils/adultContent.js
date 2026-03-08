export const isTruthyAdultFlag = (value) => (
  value === true || value === 1 || value === '1' || value === 'true'
);

export const isAdultSeries = (series) => {
  if (!series) return false;

  // Check top-level flags
  if (isTruthyAdultFlag(series.isAdult) || isTruthyAdultFlag(series.is_adult)) {
    return true;
  }

  // Check nested flags object (API often returns flags nested)
  if (series.flags && typeof series.flags === 'object') {
    if (isTruthyAdultFlag(series.flags.isAdult) || isTruthyAdultFlag(series.flags.is_adult)) {
      return true;
    }
  }

  const genres = Array.isArray(series.genres) ? series.genres : [];
  const ADULT_GENRES = [
    'adult', 'hentai', 'ecchi', 'smut', 'mature',
    'ntr', 'milf', 'mujer mayor', 'madrastra',
    'madre e hija', 'amigos con derechos', 'relacion secreta',
  ];
  return genres.some((genre) => {
    const name = (typeof genre === 'string' ? genre : genre?.name || '').toLowerCase();
    return ADULT_GENRES.some((ag) => name.includes(ag));
  });
};

export const getChapterCount = (series) => {
  const count = Number(
    series?.chapterCount ??
    series?.chaptersCount ??
    series?.chapters_count ??
    series?.totalChapters ??
    series?.total_chapters ??
    series?.chapter_total ??
    0
  );
  if (Number.isFinite(count) && count > 0) return count;
  if (Array.isArray(series?.chapters)) return series.chapters.length;
  return 0;
};

export const hasAvailableChapters = (series) => getChapterCount(series) > 0;

export const filterNonAdultSeries = (seriesList = []) =>
  seriesList.filter((series) => !isAdultSeries(series));

export const filterAvailableSeries = (seriesList = []) =>
  seriesList.filter((series) => !isAdultSeries(series) && hasAvailableChapters(series));
