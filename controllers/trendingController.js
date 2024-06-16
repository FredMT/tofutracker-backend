const { fetchLogos, fetchTrending } = require("../services/tmdbServices");
const { fetchAnidbTrending } = require("../services/anidbServices");
const supabase = require("../supabaseClient");

async function enrichWithLogos(items, type) {
  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      try {
        // Fetch logos
        const logos = await fetchLogos(type, item.id);
        if (logos && logos.length > 0) {
          item.logo_path = `https://image.tmdb.org/t/p/w300${logos[0].file_path}`;
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
  const { data, error } = await supabase
    .from("trending")
    .select("movies, tvShows, anime")
    .eq("id", 1);

  if (error) {
    console.error("Supabase error:", error);
    return res.status(500).json({ error: error.message });
  }

  return res.json(data[0]);
}

async function fetchTrendingFromAPIS() {
  let movies = await fetchTrending("movie");
  let tvShows = await fetchTrending("tv");
  let anime = await fetchAnidbTrending();

  movies = await enrichWithLogos(movies, "movie");
  tvShows = await enrichWithLogos(tvShows, "tv");
  let updated_at = new Date().toISOString();

  const trendingData = { movies, tvShows, anime, updated_at };

  return trendingData;
}

async function updateTrending(_, res) {
  console.log(
    "Running cron job every day at 12:59PM to fetch and update trending items"
  );
  const data = await fetchTrendingFromAPIS();

  const { error } = await supabase.from("trending").update([data]).eq("id", 1);

  if (error) {
    console.error("Supabase error:", error);
    throw new Error(error.message);
  }

  console.log("Cron job done");

  return res.status(200).json({ message: "Trending items updated" });
}

module.exports = { getTrending, fetchTrendingFromAPIS, updateTrending };
