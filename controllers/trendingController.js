const {
  fetchLogos,
  fetchTrending,
  fetchExternalIds,
} = require("../services/tmdbServices");

async function enrichWithLogos(items, type) {
  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      try {
        // Fetch logos
        const logos = await fetchLogos(type, item.id);
        if (logos && logos.length > 0) {
          item.logo_path = `https://image.tmdb.org/t/p/original${logos[0].file_path}`;
        }

        if (type === "tv") {
          const ids = await fetchExternalIds(item.id);
          if (ids) {
            item.anidb_id = ids.anidbId;
            item.tvdb_id = ids.tvdbId;
          }
        }

        if (item.anidb_id) {
          item.media_type = "anime";
        }
        return item;
      } catch (error) {
        console.log(`Error enriching ${type} ID ${item.id}: ${error}`);
        return item; // Return item without additional data in case of error
      }
    })
  );
  return enrichedItems;
}

async function getTrending(_, res) {
  try {
    let movies = await fetchTrending("movie");
    let tvShows = await fetchTrending("tv");

    movies = await enrichWithLogos(movies, "movie");
    tvShows = await enrichWithLogos(tvShows, "tv");

    res.send({ movies, tvShows });
  } catch (error) {
    console.log(`Error: ${error}`);
    res
      .status(500)
      .send("An error occurred while trying to fetch trending items");
  }
}

module.exports = { getTrending };
