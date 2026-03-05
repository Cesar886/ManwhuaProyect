export const isTruthyAdultFlag = (value) => (
  value === true || value === 1 || value === '1' || value === 'true'
);

export const isAdultSeries = (series) => {
  if (!series) return false;

  if (isTruthyAdultFlag(series.isAdult) || isTruthyAdultFlag(series.is_adult)) {
    return true;
  }

  const genres = Array.isArray(series.genres) ? series.genres : [];
  return genres.some((genre) => {
    const name = (typeof genre === 'string' ? genre : genre?.name || '').toLowerCase();
    return (
      name.includes('adult') ||
      name.includes('hentai') ||
      name.includes('ecchi') ||
      name.includes('smut')
    );
  });
};

export const filterNonAdultSeries = (seriesList = []) =>
  seriesList.filter((series) => !isAdultSeries(series));
