import {
  getAnime,
  getAnimeChain,
  getMapping,
  getRelations,
  getRelatedAnimeInfo,
  getSimilarAnimeDetails,
  getMultipleSimilarAnimeDetails,
} from "../models/animeModel.js";

import supabase from "../supabaseClient.js";
import redis from "../ioredisClient.js";
import axios from "axios";

async function fetchAnime(req, res) {
  const id = req.params.id;

  const animeData = await getAnime(id);

  if (!animeData) {
    return res.status(404).send({ message: "Anime not found." });
  }

  const { data: fetchImdbID, error: fetchImdbIDError } = await supabase
    .from("anidb_tvdb_tmdb_mapping")
    .select("imdb_id")
    .eq("anidb_id", id)
    .maybeSingle();

  if (fetchImdbIDError) {
    return res.json(animeData);
  }

  if (animeData[0].anime[0].type === "Movie") {
    return res.json(animeData);
  }

  try {
    const nextEpisodeResponse = await axios.get(
      `https://api.trakt.tv/shows/${fetchImdbID.imdb_id}/next_episode?extended=full`,
      {
        headers: {
          "Content-Type": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": process.env.TRAKT_CLIENT_ID,
        },
      }
    );

    const next_episode = {
      season: nextEpisodeResponse.data.season,
      number: nextEpisodeResponse.data.number,
      title: nextEpisodeResponse.data.title,
      overview: nextEpisodeResponse.data.overview,
      runtime: nextEpisodeResponse.data.runtime,
      episode_type: nextEpisodeResponse.data.episode_type,
      first_aired:
        new Date(nextEpisodeResponse.data.first_aired).getTime() / 1000,
    };

    const lastEpisodeResponse = await axios.get(
      `https://api.trakt.tv/shows/${fetchImdbID.imdb_id}/last_episode?extended=full`,
      {
        headers: {
          "Content-Type": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": process.env.TRAKT_CLIENT_ID,
        },
      }
    );

    const previous_episode = {
      season: lastEpisodeResponse.data.season,
      number: lastEpisodeResponse.data.number,
      title: lastEpisodeResponse.data.title,
      overview: lastEpisodeResponse.data.overview,
      runtime: lastEpisodeResponse.data.runtime,
      episode_type: lastEpisodeResponse.data.episode_type,
      first_aired:
        new Date(lastEpisodeResponse.data.first_aired).getTime() / 1000,
    };
    res.json({ ...animeData, next_episode, previous_episode });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Error fetching episode data.",
      error,
    });
  }
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
  const cacheKey = `anime:${id}:chain`;

  const cachedAnimeChain = await redis.get(cacheKey);
  if (cachedAnimeChain) {
    return res.json(JSON.parse(cachedAnimeChain));
  }

  const animeChain = await getAnimeChain(id);

  if (!animeChain) {
    return res
      .status(404)
      .send({ success: false, message: "Anime chain not found." });
  }

  await redis.set(
    cacheKey,
    JSON.stringify({ success: true, data: animeChain }),
    "EX",
    900
  );

  res.json({ success: true, data: animeChain });
}

async function fetchTmdbId(id) {
  const cacheKey = `anime:${id}:mapping`;
  const cachedAnimeMapping = await redis.get(cacheKey);
  if (cachedAnimeMapping) {
    return JSON.parse(cachedAnimeMapping);
  }
  const data = await getMapping(id);

  if (!data) {
    return { success: false, status: 404, message: "Anime mapping not found." };
  }

  if (!data.tmdb_id && !data.tvdb_id) {
    return { success: false, status: 404, message: "Anime mapping not found." };
  }

  if (data && data.tmdb_id) {
    await redis.set(
      cacheKey,
      JSON.stringify({ success: true, tmdb_id: data.tmdb_id }),
      "EX",
      900
    );
    return { success: true, tmdb_id: data.tmdb_id };
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

          await redis.set(
            cacheKey,
            JSON.stringify({
              success: true,
              tmdb_id: tvResult.id,
            }),
            "EX",
            900
          );
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
  const cacheKey = `anime:${id}:images`;

  const cachedAnimeImages = await redis.get(cacheKey);
  if (cachedAnimeImages) {
    return res.json(JSON.parse(cachedAnimeImages));
  }

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
    await redis.set(
      cacheKey,
      JSON.stringify({ success: true, data }),
      "EX",
      900
    );
    return res.json({ success: true, data });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
}

async function fetchRelations(req, res) {
  const id = req.params.id;
  const cacheKey = `anime:${id}:relations`;
  const cachedAnimeRelations = await redis.get(cacheKey);
  if (cachedAnimeRelations) {
    return res.json(JSON.parse(cachedAnimeRelations));
  }
  const relations = await getRelations(id);
  if (!relations || relations.length === 0) {
    return res.status(200).send({
      success: false,
      message: "Anime relations not found.",
      data: "No relations available for this anime.",
    });
  }
  await redis.set(
    cacheKey,
    JSON.stringify({
      success: true,
      message: "Anime relations found",
      data: relations,
    }),
    "EX",
    900
  );
  res.json({
    success: true,
    message: "Anime relations found",
    data: relations,
  });
}

async function fetchRelationsInfo(req, res) {
  const id = req.params.id;
  const cacheKey = `anime:${id}:relationsInfo`;
  const cachedAnimeRelationsInfo = await redis.get(cacheKey);
  if (cachedAnimeRelationsInfo) {
    return res.json(JSON.parse(cachedAnimeRelationsInfo));
  }

  const data = await getRelatedAnimeInfo(id);

  if (!data.success) {
    return res
      .status(data.status)
      .send({ success: false, message: data.message });
  }

  await redis.set(
    cacheKey,
    JSON.stringify({ success: true, data: data.data }),
    "EX",
    900
  );

  return res.json({ success: true, data: data.data });
}

async function fetchAnimeEpisodes(req, res) {
  const { id, start_date, end_date } = req.params;
  const cacheKey = `anime:${id}:episodes`;
  const cachedAnimeEpisodes = await redis.get(cacheKey);
  if (cachedAnimeEpisodes) {
    return res.json(JSON.parse(cachedAnimeEpisodes));
  }
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

    const startDate = new Date(start_date);
    const endDate =
      end_date === "null"
        ? new Date(new Date().toISOString().split("T")[0])
        : new Date(end_date);

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
            episode_name: episode.name,
            episode_overview: episode.overview,
            runtime: episode.runtime,
            still_path: episode.still_path,
          }));
        episodesWithinDateRange.push(...filteredEpisodes);
      }
    }

    await redis.set(
      cacheKey,
      JSON.stringify({ success: true, data: episodesWithinDateRange }),
      "EX",
      900
    );

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
  const cacheKey = `anime:${id}:similarAnime`;
  const cachedAnimeSimilar = await redis.get(cacheKey);
  if (cachedAnimeSimilar) {
    return res.json(JSON.parse(cachedAnimeSimilar));
  }
  const animeData = await getAnime(id);

  if (!animeData) {
    return res
      .status(404)
      .send({ success: false, message: "Anime not found." });
  }

  const similarAnimeObjects = animeData[0].anime_similar;

  if (similarAnimeObjects) {
    try {
      const similarAnimeDetails = await Promise.all(
        similarAnimeObjects.map((similar) =>
          getSimilarAnimeDetails(similar.similar_id)
        )
      );
      return res.send({ success: true, data: similarAnimeDetails });
    } catch (error) {
      console.error("Error fetching similar anime details:", error);
      return res.status(500).send({
        success: false,
        message: "Error fetching similar anime details.",
      });
    }
  }

  try {
    const tmdbIdResult = await fetchTmdbId(id);
    if (!tmdbIdResult.success) {
      return res
        .status(500)
        .send({ success: false, message: "TMDB ID not found." });
    }

    const url = `https://api.themoviedb.org/3/${type}/${tmdbIdResult.tmdb_id}/recommendations?api_key=${process.env.TMDB_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    const similarAnimeIds = data.results
      .filter(
        (anime) =>
          anime.genre_ids.includes(16) && anime.origin_country.includes("JP")
      )
      .map((anime) => anime.id);

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
    const similarAnimeDetails = await getMultipleSimilarAnimeDetails(anidbIds);

    if (!similarAnimeDetails || similarAnimeDetails.length === 0) {
      return res.send({ success: false, message: "No similar anime found." });
    }

    await redis.set(
      cacheKey,
      JSON.stringify({ success: true, data: similarAnimeDetails }),
      "EX",
      900
    );

    return res.send({ success: true, data: similarAnimeDetails });
  } catch (error) {
    return res
      .status(500)
      .send({ success: false, message: "Could not find similar anime." });
  }
}

async function searchAnime(query) {
  let response = await fetch(
    `https://api.themoviedb.org/3/discover/tv?api_key=${process.env.TMDB_API_KEY}&language=en-US&page=1&with_genres=16&with_keywords=210024|287501&include_adult=true&with_text_query=${query}`
  );
  const tvAnimeData = await response.json();
  response = await fetch(
    `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&language=en-US&page=1&with_genres=16&with_keywords=210024|287501&include_adult=true&with_text_query=${query}`
  );
  const movieAnimeData = await response.json();
  const tvAnimeIds = tvAnimeData.results.map((item) => item.id);
  const movieAnimeIds = movieAnimeData.results.map((item) => item.id);
  const combinedAnimeIds = [...tvAnimeIds, ...movieAnimeIds];

  const { data: animeMappingData, error } = await supabase
    .from("anidb_tvdb_tmdb_mapping")
    .select("anidb_id")
    .in("tmdb_id", combinedAnimeIds);

  if (error) {
    return { success: false, message: "Error fetching anime mapping data." };
  }

  const anidbIds = animeMappingData.map((item) => item.anidb_id);

  const { data: animeAnidbFinalSearchData, error: animeAnidbFinalSearchError } =
    await supabase.from("anidb_anime").select("*").in("id", anidbIds);

  if (animeAnidbFinalSearchError) {
    return {
      success: false,
      message: "Error fetching final anime search data.",
    };
  }

  return { success: true, data: animeAnidbFinalSearchData };
}

export {
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
