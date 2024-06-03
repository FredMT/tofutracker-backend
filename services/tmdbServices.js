const axios = require("axios");

async function fetchLogos(type, id) {
  const url = `https://api.themoviedb.org/3/${type}/${id}/images?api_key=${process.env.TMDB_API_KEY}&include_image_language=en`;
  const response = await axios.get(url);
  return response.data.logos;
}

async function fetchPoster(type, id) {
  const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${process.env.TMDB_API_KEY}`;
  const response = await axios.get(url);
  const posterPath = `https://image.tmdb.org/t/p/w780${response.data.poster_path}`;
  return {
    item_id: id,
    item_type: type,
    item_poster: posterPath,
    item_title: response.data.title,
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
