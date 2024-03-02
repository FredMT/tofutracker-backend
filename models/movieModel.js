const axios = require("axios");
const supabase = require("../supabaseClient");
const { fetchMovieDataFromAPI } = require("../services/tmdbServices");

async function fetchExistingMovie(movieId) {
  try {
    const { data: existingMovie, error: existingMovieError } = await supabase
      .from("tmdb_movies_json")
      .select("movies_data")
      .eq("id", movieId)
      .single();

    if (existingMovieError && existingMovieError.code !== "PGRST116") {
      throw existingMovieError;
    }
    return existingMovie;
  } catch (error) {
    console.error("Error fetching existing movie:", error);
    throw error;
  }
}

const insertMovieData = async (movieResponse, movieId) => {
  try {
    // Extract logo path
    const logos = movieResponse.images.logos;
    let highestVotedLogo =
      logos.length > 0
        ? logos.reduce(
            (max, logo) => (logo.vote_count > max.vote_count ? logo : max),
            logos[0]
          )
        : null;
    const logo_path = highestVotedLogo ? highestVotedLogo.file_path : null;

    // Extract genres
    const genres = movieResponse.genres;
    const movieGenreRows = genres.map((genre) => ({
      movie_id: movieId,
      genre_id: genre.id,
    }));

    // Extract certification
    let certification;
    const usReleaseDates = movieResponse.release_dates.results.filter(
      (release) => release.iso_3166_1 === "US"
    );
    if (
      usReleaseDates.length > 0 &&
      usReleaseDates[0].release_dates.length > 0
    ) {
      certification = usReleaseDates[0].release_dates[0].certification;
    }

    const movieData = {
      id: movieId,
      title: movieResponse.title,
      overview: movieResponse.overview,
      poster_path: movieResponse.poster_path
        ? `https://image.tmdb.org/t/p/original${movieResponse.poster_path}`
        : null,
      backdrop_path: movieResponse.backdrop_path
        ? `https://image.tmdb.org/t/p/original${movieResponse.backdrop_path}`
        : null,
      release_date: movieResponse.release_date,
      runtime: movieResponse.runtime,
      vote_average: movieResponse.vote_average,
      vote_count: movieResponse.vote_count,
      tagline: movieResponse.tagline,
      status: movieResponse.status,
      adult: movieResponse.adult,
      budget: movieResponse.budget,
      revenue: movieResponse.revenue,
      homepage: movieResponse.homepage,
      imdb_id: movieResponse.external_ids.imdb_id,
      original_language: movieResponse.original_language,
      original_title: movieResponse.original_title,
      popularity: movieResponse.popularity,
      logo_path: logo_path,
      certification: certification,
    };

    const { error: insertMovieError } = await supabase
      .from("tmdb_movies")
      .upsert([movieData], {
        onConflict: "id",
        ignoreDuplicates: true,
        defaultToNull: true,
      });
    if (insertMovieError)
      throw new Error(
        `Error inserting movie data: ${insertMovieError.message}`
      );

    const { error: insertGenresError } = await supabase
      .from("tmdb_movies_genres")
      .insert(movieGenreRows);
    if (insertGenresError)
      throw new Error(
        `Error inserting movie genres: ${insertGenresError.message}`
      );

    const { error: insertMovieJsonError } = await supabase
      .from("tmdb_movies_json")
      .upsert({
        id: movieId,
        movies_data: movieResponse,
      });
    if (insertMovieJsonError)
      throw new Error(
        `Error inserting full movie JSON: ${insertMovieJsonError.message}`
      );

    return true;
  } catch (error) {
    console.error(`insertMovieData error: ${error}`);
    return false;
  }
};

exports.fetchMovieData = async (movieId) => {
  const existingMovie = await fetchExistingMovie(movieId);
  if (existingMovie) {
    return existingMovie.movies_data;
  }

  const movieResponse = await fetchMovieDataFromAPI(movieId);

  await insertMovieData(movieResponse, movieId);

  return movieResponse;
};
