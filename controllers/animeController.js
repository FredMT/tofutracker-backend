const {
  getAnime,
  getAnimeChain,
  getMapping,
  getRelations,
} = require("../models/animeModel");
const supabase = require("../supabaseClient");

async function fetchAnime(req, res) {
  const id = req.params.id;
  const animeData = await getAnime(id);

  if (!animeData) {
    return res.status(404).send({ message: "Anime not found." });
  }

  res.json(animeData);
}

async function fetchAnimeChain(req, res) {
  const id = req.params.id;
  const animeChain = await getAnimeChain(id);

  if (!animeChain) {
    return res
      .status(404)
      .send({ success: false, message: "Anime chain not found." });
  }

  res.json({ success: true, data: animeChain });
}

async function fetchTmdbId(id) {
  const data = await getMapping(id);

  if (!data) {
    return { success: false, status: 404, message: "Anime mapping not found." };
  }

  if (data && data.tmdb_id) {
    return { success: true, tmdb_id: data.tmdb_id };
  }

  if (!data.tmdb_id && !data.tvdb_id) {
    return { success: false, status: 404, message: "Anime mapping not found." };
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
            return {
              success: false,
              status: 500,
              message: "Error updating anime mapping.",
            };
          }

          return { success: true, tmdb_id: tvResult.id };
        } else {
          return { success: false, status: 500, message: "TVDB ID not found." };
        }
      }
    } catch (error) {
      return { success: false, status: 500, message: error.message };
    }
  }
}

async function fetchAnimeImagesFromTMDB(req, res) {
  const { type, id } = req.params;
  const tmdbIdResult = await fetchTmdbId(id);
  if (!tmdbIdResult.success) {
    return res
      .status(500)
      .send({ success: false, message: "TMDB ID not found." });
  }
  const url = `https://api.themoviedb.org/3/${type}/${tmdbIdResult.tmdb_id}/images?api_key=${process.env.TMDB_API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return res.json({ success: true, data: data });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
}

async function fetchRelations(req, res) {
  const id = req.params.id;
  const relations = await getRelations(id);
  if (!relations || relations.length === 0) {
    return res.status(404).send({
      success: false,
      message: "Anime relations not found.",
      data: "No relations available for this anime.",
    });
  }
  res.json({
    success: true,
    message: "Anime relations found",
    data: relations,
  });
}

module.exports = {
  fetchAnime,
  fetchAnimeChain,
  fetchTmdbId,
  fetchAnimeImagesFromTMDB,
  fetchRelations,
};
