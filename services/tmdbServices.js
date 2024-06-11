const axios = require("axios");
const supabase = require("../supabaseClient");

async function fetchLogos(type, id) {
  const url = `https://api.themoviedb.org/3/${type}/${id}/images?api_key=${process.env.TMDB_API_KEY}&include_image_language=en`;
  const response = await axios.get(url);
  return response.data.logos;
}

async function fetchTrending(type) {
  const url = `https://api.themoviedb.org/3/trending/${type}/day?api_key=${process.env.TMDB_API_KEY}`;
  const response = await axios.get(url);
  let results = response.data.results;

  if (type === "tv") {
    results = results.map((item) => {
      if (item.name) {
        item.title = item.name;
        delete item.name;
      }
      return item;
    });
  }

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
  let url;
  if (type === "movie" || type === "tv") {
    url = `https://api.themoviedb.org/3/${type}/${id}/images?api_key=${process.env.TMDB_API_KEY}`;
  } else if (type === "anime") {
    // Fetch the anime type and TMDB/TVDB ID from the database
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

  return (
    highestVoteCountImage.file_path || {
      ok: false,
      error: "No valid images found",
    }
  );
}

module.exports = {
  fetchLogos,
  fetchTrending,
  fetchMovieDataFromAPI,
  fetchTVDataFromTMDB,
  fetchSeasonDataFromAPI,
  searchMovies,
  searchTV,
  getBackdropImage,
};
