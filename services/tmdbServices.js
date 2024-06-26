import axios from "axios";
import supabase from "../supabaseClient.js";
import redis from "../ioredisClient.js";

async function fetchTrending(type) {
  const url = `https://api.themoviedb.org/3/trending/${type}/day?api_key=${process.env.TMDB_API_KEY}`;
  const response = await axios.get(url);
  let results = response.data.results;

  results = await Promise.all(
    results.map(async (item) => {
      if (item.media_type === "movie") {
        return await fetchMovieDataFromAPI(item.id);
      } else if (item.media_type === "tv") {
        return await fetchTVDataFromTMDB(item.id);
      }
      return item;
    })
  );

  return results.sort((a, b) => b.popularity - a.popularity).slice(0, 10);
}

async function fetchMovieDataFromAPI(movieId) {
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,keywords,images,similar,videos,watch/providers,release_dates,external_ids`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching movie data from API:", error);
    throw error;
  }
}

async function fetchTVDataFromTMDB(id) {
  const response = await axios.get(
    `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=aggregate_credits,content_ratings,images,recommendations,videos,watch/providers,external_ids,credits,keywords`
  );
  const tvData = response.data;

  return tvData;
}

async function fetchSeasonDataFromAPI(id, season_number) {
  const response = await axios.get(
    `https://api.themoviedb.org/3/tv/${id}/season/${season_number}?api_key=${process.env.TMDB_API_KEY}`
  );
  return response.data;
}

async function searchMovies(query) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${
    process.env.TMDB_API_KEY
  }&query=${encodeURIComponent(query)}`;
  const response = await axios.get(url);
  return response.data;
}

async function searchTV(query) {
  const url = `https://api.themoviedb.org/3/search/tv?api_key=${
    process.env.TMDB_API_KEY
  }&query=${encodeURIComponent(query)}`;
  const response = await axios.get(url);
  return response.data;
}

async function getBackdropImage(type, id) {
  const cacheKey = `backdrop:${type}:${id}`;
  const cachedBackdrop = await redis.get(cacheKey);
  if (cachedBackdrop) {
    return JSON.parse(cachedBackdrop);
  }

  let url;
  if (type !== "anime") {
    url = `https://api.themoviedb.org/3/${type}/${id}/images?api_key=${process.env.TMDB_API_KEY}`;
  } else if (type === "anime") {
    const { data: animeData, error: animeError } = await supabase
      .from("anidb_anime")
      .select("type")
      .eq("id", id)
      .single();

    if (animeError) {
      console.error("Error fetching anime type from database:", animeError);
      return { ok: false, error: animeError };
    }

    const animeType = animeData.type === "Movie" ? "movie" : "tv";

    const { data, error } = await supabase
      .from("anidb_tvdb_tmdb_mapping")
      .select("tmdb_id, tvdb_id")
      .eq("anidb_id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching mapping data from database:", error);
      return { ok: false, error: error };
    }

    if (data.tvdb_id) {
      // Fetch TMDB ID using TVDB ID
      const findResponse = await axios.get(
        `https://api.themoviedb.org/3/find/${data.tvdb_id}?external_source=tvdb_id&api_key=${process.env.TMDB_API_KEY}`
      );
      const tmdbId = findResponse.data[`${animeType}_results`][0]?.id;
      if (!tmdbId) {
        // If no TMDB ID found for the initial type, try the other type
        const alternateType = animeType === "movie" ? "tv" : "movie";
        const alternateFindResponse = await axios.get(
          `https://api.themoviedb.org/3/find/${data.tvdb_id}?external_source=tvdb_id&api_key=${process.env.TMDB_API_KEY}`
        );
        const alternateTmdbId =
          alternateFindResponse.data[`${alternateType}_results`][0]?.id;

        if (!alternateTmdbId) {
          return {
            ok: false,
            error: "No TMDB ID found using TVDB ID for both types",
          };
        }
        url = `https://api.themoviedb.org/3/${alternateType}/${alternateTmdbId}/images?api_key=${process.env.TMDB_API_KEY}`;

        const { error: updateError } = await supabase
          .from("anidb_tvdb_tmdb_mapping")
          .update({ tmdb_id: alternateTmdbId })
          .eq("anidb_id", id);

        if (updateError) {
          console.error(
            "Error updating mapping data in database:",
            updateError
          );
          return { ok: false, error: updateError };
        }
      } else {
        url = `https://api.themoviedb.org/3/${animeType}/${tmdbId}/images?api_key=${process.env.TMDB_API_KEY}`;

        const { error: updateError } = await supabase
          .from("anidb_tvdb_tmdb_mapping")
          .update({ tmdb_id: tmdbId })
          .eq("anidb_id", id);

        if (updateError) {
          console.error(
            "Error updating mapping data in database:",
            updateError
          );
          return { ok: false, error: updateError };
        }
      }
    } else {
      return { ok: false, error: "No valid ID found for fetching images" };
    }
  } else {
    return { ok: false, error: "Invalid type specified" };
  }

  const response = await axios.get(url);
  const backdrops = response.data.backdrops;

  if (!backdrops || backdrops.length === 0) {
    return { ok: false, error: "No images found" };
  }

  const sortedBackdrops = backdrops.sort(
    (a, b) => b.vote_average - a.vote_average
  );

  const highestVoteCountImage =
    sortedBackdrops[0].vote_average === 0
      ? sortedBackdrops[0]
      : sortedBackdrops.find((img) => img.vote_average !== 0);

  await redis.set(
    cacheKey,
    JSON.stringify(highestVoteCountImage.file_path),
    "EX",
    900
  );

  return (
    highestVoteCountImage.file_path || {
      ok: false,
      error: "No valid images found",
    }
  );
}

async function getTopTenBackdrops(type, id) {
  const cacheKey = `toptenbackdrops:${type}:${id}`;
  const cachedBackdrop = await redis.get(cacheKey);
  if (cachedBackdrop) {
    return JSON.parse(cachedBackdrop);
  }

  let url = "";

  if (type === "anime") {
    const { data: fetchAnimeData, error: fetchAnimeError } = await supabase
      .from("anidb_anime")
      .select("type")
      .eq("id", id)
      .maybeSingle();

    if (fetchAnimeError) {
      console.error(
        "Error fetching anime type from database:",
        fetchAnimeError
      );
      return { ok: false, error: fetchAnimeError };
    }

    const animeType = fetchAnimeData.type === "Movie" ? "movie" : "tv";

    const { data: fetchMappingData, error: fetchMappingError } = await supabase
      .from("anidb_tvdb_tmdb_mapping")
      .select("tmdb_id, tvdb_id")
      .eq("anidb_id", id)
      .maybeSingle();

    if (fetchMappingError) {
      console.error(
        "Error fetching mapping data from database:",
        fetchMappingError
      );
      return { ok: false, error: fetchMappingError };
    }

    if (fetchMappingData.tmdb_id) {
      url = `https://api.themoviedb.org/3/${animeType}/${fetchMappingData.tmdb_id}/images?api_key=${process.env.TMDB_API_KEY}`;
    } else if (!fetchMappingData.tmdb_id && fetchMappingData.tvdb_id) {
      const findResponse = await axios.get(
        `https://api.themoviedb.org/3/find/${fetchMappingData.tvdb_id}?external_source=tvdb_id&api_key=${process.env.TMDB_API_KEY}`
      );
      const tmdbId = findResponse.data[`${animeType}_results`][0]?.id;
      if (!tmdbId) {
        return { ok: false, error: "No TMDB ID found" };
      }
      url = `https://api.themoviedb.org/3/${animeType}/${tmdbId}/images?api_key=${process.env.TMDB_API_KEY}`;
    } else {
      return { ok: false, error: "No valid ID found for fetching images" };
    }
    const response = await axios.get(url);
    const backdrops = response.data.backdrops;

    if (backdrops.length === 0) {
      return { ok: false, error: "No backdrops found" };
    }

    const topTenBackdrops = backdrops
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, 10);

    await redis.set(
      cacheKey,
      JSON.stringify({ ok: true, data: topTenBackdrops }),
      "EX",
      900
    );

    return { ok: true, data: topTenBackdrops };
  } else {
    url = `https://api.themoviedb.org/3/${type}/${id}/images?api_key=${process.env.TMDB_API_KEY}`;
    const response = await axios.get(url);
    const backdrops = response.data.backdrops;
    if (backdrops.length === 0) {
      return { ok: false, error: "No backdrops found" };
    }
    const topTenBackdrops = backdrops
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, 10);

    await redis.set(
      cacheKey,
      JSON.stringify({ ok: true, data: topTenBackdrops }),
      "EX",
      900
    );
    return { ok: true, data: topTenBackdrops };
  }
}

export {
  fetchTrending,
  fetchMovieDataFromAPI,
  fetchTVDataFromTMDB,
  fetchSeasonDataFromAPI,
  searchMovies,
  searchTV,
  getBackdropImage,
  getTopTenBackdrops,
};
