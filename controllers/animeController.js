const {
  getAnime,
  getAnimeChain,
  getMapping,
  getRelations,
  getRelatedAnimeInfo,
  getSimilarAnimeDetails,
  getMultipleSimilarAnimeDetails,
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

async function checkAnimeInLibrary(req, res) {
  const { id, user_id } = req.params;
  const { data, error } = await supabase
    .from("item_lists")
    .select("*")
    .eq("user_id", user_id)
    .eq("item_id", id)
    .eq("item_type", "anime")
    .maybeSingle();
  if (error) {
    return res.status(500).send({
      success: false,
      message: "Error checking anime in library.",
      error,
    });
  }
  res.json({ success: true, data });
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

async function fetchRelationsInfo(req, res) {
  const id = req.params.id;

  const data = await getRelatedAnimeInfo(id);

  if (!data.success) {
    return res
      .status(data.status)
      .send({ success: false, message: data.message });
  }

  return res.json({ success: true, data: data.data });
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
    const endDate =
      end_date === "null"
        ? new Date(new Date().toISOString().split("T")[0])
        : new Date(end_date);

    // Iterate through each season in the append_to_response
    for (let i = 1; i <= 19; i++) {
      const season = data[`season/${i}`];
      if (season && season.episodes) {
        const filteredEpisodes = season.episodes
          .filter((episode) => {
            const airDate = new Date(episode.air_date);
            return airDate >= startDate && airDate <= endDate;
          })
          .map((episode) => ({
            air_date: episode.air_date,
            episode_number: episode.episode_number,
            episode_name: episode.name, // Assuming 'name' is the field for episode name
            episode_overview: episode.overview,
            runtime: episode.runtime,
            still_path: episode.still_path,
          }));
        episodesWithinDateRange.push(...filteredEpisodes);
      }
    }

    res.json({ success: true, data: episodesWithinDateRange });
  } catch (error) {
    console.error("Error fetching anime episodes:", error);
    res
      .status(500)
      .send({ success: false, message: "Error fetching anime episodes." });
  }
}

async function fetchSimilarAnime(req, res) {
  const { id, type } = req.params;
  const animeData = await getAnime(id);

  if (!animeData) {
    return res
      .status(404)
      .send({ success: false, message: "Anime not found." });
  }

  const similarAnimeObjects = animeData[0].anime_similar;

  if (!similarAnimeObjects) {
    try {
      const tmdbIdResult = await fetchTmdbId(id);
      console.log(tmdbIdResult);

      if (!tmdbIdResult.success) {
        return res
          .status(500)
          .send({ success: false, message: "TMDB ID not found." });
      }

      const url = `https://api.themoviedb.org/3/${type.toString()}/${
        tmdbIdResult.tmdb_id
      }/recommendations?api_key=${process.env.TMDB_API_KEY}`;

      try {
        const response = await fetch(url);
        let data = await response.json();
        data.results = data.results.filter(
          (anime) =>
            anime.genre_ids.includes(16) && anime.origin_country.includes("JP")
        );
        const similarAnimeIds = data.results.map((anime) => anime.id);

        for (const id of similarAnimeIds) {
          await checkAndInsertTMDBId(id);
        }

        const { data: similarAnidbIDs, error } = await supabase
          .from("anidb_tvdb_tmdb_mapping")
          .select("anidb_id")
          .in("tmdb_id", similarAnimeIds);

        if (error) {
          console.error("Error fetching data:", error);
          return res.status(500).send({
            success: false,
            message: "Error fetching similar anime details.",
          });
        }

        const anidbIds = similarAnidbIDs.map((similar) => similar.anidb_id);

        try {
          const similarAnimeDetails = await getMultipleSimilarAnimeDetails(
            anidbIds
          );

          if (!similarAnimeDetails || similarAnimeDetails.length === 0) {
            return res.send({
              success: false,
              message: "No similar anime found.",
            });
          }
          return res.send({ success: true, data: similarAnimeDetails });
        } catch (error) {
          return res.status(500).send({
            success: false,
            message: "Error fetching similar anime details.",
          });
        }
      } catch (error) {
        return res.status(500).send({
          success: false,
          message: "Could not find similar anime.",
        });
      }
    } catch (error) {
      return res.status(500).send({
        success: false,
        message: "Could not find similar anime.",
      });
    }
  }

  const similarAnimeDetailsPromises = similarAnimeObjects.map((similar) =>
    getSimilarAnimeDetails(similar.similar_id)
  );

  try {
    const similarAnimeDetails = await Promise.all(similarAnimeDetailsPromises);
    res.send({ success: true, data: similarAnimeDetails });
  } catch (error) {
    console.error("Error fetching similar anime details:", error);
    res.status(500).send({
      success: false,
      message: "Error fetching similar anime details.",
    });
  }
}

async function checkAndInsertTMDBId(id) {
  const { data, error } = await supabase
    .from("anidb_tvdb_tmdb_mapping")
    .select("*")
    .eq("tmdb_id", id)
    .limit(1);

  if (data) {
    return;
  }

  if (error && error.code !== "PGRST116") {
    return {
      success: false,
      message: "Error querying anidb_tvdb_tmdb_mapping.",
      error,
    };
  }

  if (error.code === "PGRST116") {
    const url = `https://api.themoviedb.org/3/tv/${id}/external_ids?api_key=${process.env.TMDB_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      const tvdbId = data.tvdb_id;

      if (!tvdbId) {
        return {
          success: false,
          message: "TVDB ID not found.",
        };
      }

      if (tvdbId) {
        const { data, error } = await supabase
          .from("anidb_tvdb_tmdb_mapping")
          .select("*")
          .eq("tvdb_id", tvdbId);

        if (error) {
          return {
            success: false,
            message: "Error querying anidb_tvdb_tmdb_mapping.",
            error,
          };
        }

        if (data.length > 0) {
          const { error } = await supabase
            .from("anidb_tvdb_tmdb_mapping")
            .update({ tmdb_id: id })
            .eq("tvdb_id", tvdbId);

          if (error) {
            return {
              success: false,
              message: "Error updating anidb_tvdb_tmdb_mapping.",
              error,
            };
          }
        }
      }
      return { success: true, message: "TVDB ID added." };
    } catch (error) {
      return {
        success: false,
        message: "Error querying anidb_tvdb_tmdb_mapping.",
        error,
      };
    }
  }

  if (data) {
    return { success: true, data };
  }
}

async function searchAnime(query) {
  const { data: searchResults, error } = await supabase.rpc(
    "search_anime_by_title",
    {
      prefix: query,
    }
  );

  if (error) {
    console.error("Error searching anime:", error);
    return res.status(500).send({
      ok: false,
      message: "Error searching anime.",
      error,
    });
  }

  return searchResults.map((result) => {
    if (result.rating === null) {
      result.rating = 0;
    }
    return result;
  });
}

module.exports = {
  fetchAnime,
  checkAnimeInLibrary,
  fetchAnimeChain,
  fetchTmdbId,
  fetchAnimeImagesFromTMDB,
  fetchRelations,
  fetchRelationsInfo,
  fetchAnimeEpisodes,
  fetchSimilarAnime,
  searchAnime,
};
