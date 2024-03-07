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
    return res.status(200).send({
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

async function fetchAnimeEpisodes(req, res) {
  const { id, start_date, end_date } = req.params;
  const tmdbIdResult = await fetchTmdbId(id);
  if (!tmdbIdResult.success) {
    return res
      .status(500)
      .send({ success: false, message: "TMDB ID not found." });
  }
  const tmdbId = tmdbIdResult.tmdb_id;
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=season/1,season/2,season/3,season/4,season/5,season/6,season/7,season/8,season/9,season/10,season/11,season/12,season/13,season/14,season/15,season/16,season/17,season/18,season/19`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const episodesWithinDateRange = [];

    // Convert start_date and end_date to Date objects
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // Iterate through each season in the append_to_response
    for (let i = 1; i <= 19; i++) {
      const season = data[`season/${i}`];
      if (season && season.episodes) {
        const filteredEpisodes = season.episodes.filter((episode) => {
          const airDate = new Date(episode.air_date);
          return airDate >= startDate && airDate <= endDate;
        });
        episodesWithinDateRange.push(...filteredEpisodes);
      }
    }

    res.json({ success: true, episodes: episodesWithinDateRange });
  } catch (error) {
    console.error("Error fetching anime episodes:", error);
    res
      .status(500)
      .send({ success: false, message: "Error fetching anime episodes." });
  }
}

module.exports = {
  fetchAnime,
  fetchAnimeChain,
  fetchTmdbId,
  fetchAnimeImagesFromTMDB,
  fetchRelations,
  fetchAnimeEpisodes,
};
