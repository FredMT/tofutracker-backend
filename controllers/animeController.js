const { getAnime, getAnimeChain, getMapping } = require("../models/animeModel");
const supabase = require("../supabaseClient");

async function fetchAnime(req, res) {
  const id = req.params.id;
  const animeData = await getAnime(id);

  if (!animeData) {
    return res.status(404).send("Anime not found.");
  }

  res.json(animeData);
}

async function fetchAnimeChain(req, res) {
  const id = req.params.id;
  const animeChain = await getAnimeChain(id);

  if (!animeChain) {
    return res.status(404).send("Anime chain not found.");
  }

  res.json(animeChain);
}

async function fetchTmdbId(id) {
  const data = await getMapping(id);

  if (!data) {
    throw new Error("Anime mapping not found");
  }

  if (data.tmdb_id) {
    return data.tmdb_id;
  }

  if (!data.tmdb_id && !data.tvdb_id) {
    throw new Error("Anime mapping not found");
  }

  if (data.anidb_id && data.tvdb_id) {
    const url = `https://api.themoviedb.org/3/find/${data.tvdb_id}?external_source=tvdb_id&api_key=${process.env.TMDB_API_KEY}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data) {
        const tvResult = data.tv_results[0];
        if (tvResult) {
          const { error } = await supabase
            .from("anidb_tvdb_tmdb_mapping")
            .update({ tmdb_id: tvResult.id })
            .eq("anidb_id", id);

          if (error) {
            throw new Error("Error updating anime mapping.", error);
          }

          return tvResult.id;
        } else {
          throw new Error("No TV result found for TVDB ID:", data.tvdb_id);
        }
      }
    } catch (error) {
      console.error("Error fetching from TMDB:", error.message);
      throw new Error("Error fetching from TMDB:", error.message);
    }
  }
}

async function fetchAnimeImagesFromTMDB(req, res) {
  const { type, id } = req.params;
  console.log(type, id);
  const tmdbId = await fetchTmdbId(id);
  const url = `https://api.themoviedb.org/3/${type}/${tmdbId}/images?api_key=${process.env.TMDB_API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("Error fetching from TMDB:", error.message);
    return null;
  }
}

module.exports = {
  fetchAnime,
  fetchAnimeChain,
  fetchTmdbId,
  fetchAnimeImagesFromTMDB,
};
