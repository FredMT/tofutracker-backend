const axios = require("axios");

async function fetchMovieLogos(movieId) {
  const url = `https://api.themoviedb.org/3/movie/${movieId}/images?api_key=${process.env.TMDB_API_KEY}&include_image_language=en,null`;
  const response = await axios.get(url);
  return response.data.logos;
}

async function fetchTrendingMovies() {
  const url = `https://api.themoviedb.org/3/trending/movie/day?api_key=${process.env.TMDB_API_KEY}`;
  const response = await axios.get(url);
  return response.data.results;
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

module.exports = {
  fetchMovieLogos,
  fetchTrendingMovies,
  fetchMovieDataFromAPI,
};
