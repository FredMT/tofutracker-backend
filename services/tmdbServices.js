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

module.exports = { fetchMovieLogos, fetchTrendingMovies };
