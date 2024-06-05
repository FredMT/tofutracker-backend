const axios = require("axios");
const supabase = require("../supabaseClient");

async function fetchLogos(type, id) {
  const url = `https://api.themoviedb.org/3/${type}/${id}/images?api_key=${process.env.TMDB_API_KEY}&include_image_language=en`;
  const response = await axios.get(url);
  return response.data.logos;
}

async function fetchPoster(id) {
  const { data, error } = await supabase
    .from("item_lists")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching data from Supabase:", error);
    return;
  }

  if (data.item_type === "anime") {
    const { data: animeData, error: animeError } = await supabase
      .from("anidb_anime")
      .select("*")
      .eq("id", data.item_id)
      .single();

    if (animeError) {
      console.error("Error fetching data from Supabase:", animeError);
      return;
    }

    return {
      item_id: data.item_id,
      item_type: data.item_type,
      item_poster: `https://cdn.anidb.net/images/main/${animeData.poster}`,
      item_title: animeData.english_title,
      activity_id: id,
    };
  }

  const url = `https://api.themoviedb.org/3/${data.item_type}/${data.item_id}?api_key=${process.env.TMDB_API_KEY}`;
  const response = await axios.get(url);
  const posterPath = `https://image.tmdb.org/t/p/original${response.data.poster_path}`;
  return {
    item_id: data.item_id,
    item_type: data.item_type,
    item_poster: posterPath,
    item_title:
      data.item_type === "movie" ? response.data.title : response.data.name,
    activity_id: data.id,
  };
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

module.exports = {
  fetchLogos,
  fetchPoster,
  fetchTrending,
  fetchMovieDataFromAPI,
  fetchTVDataFromTMDB,
  fetchSeasonDataFromAPI,
  searchMovies,
};
