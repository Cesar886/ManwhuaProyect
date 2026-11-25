/** Consistent series cover fields for API responses. */
const mapSeriesCoverFields = (series = {}) => ({
    cover_url: series.cover_url || null,
    cover_url_web: series.cover_url_web || null,
    cover_url_tmo: series.cover_url_tmo || null,
    cover_url_oni: series.cover_url_oni || null,
    cover: series.cover_url || series.cover_url_web || series.cover_url_tmo || series.cover_url_oni || null,
    coverUrl: series.cover_url || null,
    coverUrlWeb: series.cover_url_web || null,
    coverUrlTmo: series.cover_url_tmo || null,
    coverUrlOni: series.cover_url_oni || null,
});

module.exports = { mapSeriesCoverFields };
