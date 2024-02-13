const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs").promises;

const app = express();
app.use(cors());
const port = process.env.PORT || 8080;
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

let animeListCache = []; // This will hold the anime list in memory

// Function to load the anime list from file
async function loadAnimeList() {
  try {
    const data = await fs.readFile("anime-list.json", "utf8");
    const animeList = JSON.parse(data)["anime-list"].anime;
    animeListCache = animeList; // Store the anime list in the cache
    console.log("Anime list loaded into cache.");
  } catch (err) {
    console.error("Error loading anime list from file:", err);
  }
}

// Load the anime list at application startup
loadAnimeList();

app.get("/favicon.ico", (req, res) => res.status(204).end());

//To be changed as it makes a new request everytime
app.get("/api/trending", async (req, res) => {
  try {
    const trendingResponse = await axios.get(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${process.env.TMDB_API_KEY}`
    );

    const moviesWithLogos = await Promise.all(
      trendingResponse.data.results.map(async (movie) => {
        try {
          const imagesResponse = await axios.get(
            `https://api.themoviedb.org/3/movie/${movie.id}/images?api_key=${process.env.TMDB_API_KEY}&include_image_language=en,null`
          );
          const logos = imagesResponse.data.logos;
          if (logos && logos.length > 0) {
            movie.logo_path = logos[0].file_path; // Append the first logo's file path
          }
          return movie;
        } catch (imageError) {
          console.error(
            `Error fetching images for movie ID ${movie.id}: ${imageError}`
          );
          return movie; // Return the movie without a logo if the images request fails
        }
      })
    );

    // Replace the original results with the updated moviesWithLogos
    trendingResponse.data.results = moviesWithLogos;
    res.send(trendingResponse.data);
  } catch (error) {
    console.error(`Error: ${error}`);
    res
      .status(500)
      .send("An error occurred while trying to fetch trending movies");
  }
});

app.get("/api/getmovie/:id", async (req, res) => {
  try {
    const movieId = req.params.id;

    // First, check if the movie already exists in the Supabase database
    const { data: existingMovie, error: existingMovieError } = await supabase
      .from("tmdb_movies_json")
      .select("movies_data")
      .eq("id", movieId)
      .single();

    if (existingMovieError && existingMovieError.code !== "PGRST116") {
      console.error("Error fetching existing movie:", existingMovieError);
      return res
        .status(500)
        .send("An error occurred while trying to fetch the movie data");
    }

    // Return movie from database if it already exists
    if (existingMovie) {
      return res.json({
        ...existingMovie.movies_data,
      });
    }

    // If the movie does not exist in the database, proceed with the TMDB API call
    const movieResponse = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,keywords,images,similar,videos,watch/providers,release_dates,external_ids`
    );

    const found = animeListCache.some((anime) => {
      const imdbId = anime._imdbid;
      const tvdbId = anime._tvdbid;
      return (
        movieResponse.data.external_ids.imdb_id === imdbId ||
        movieResponse.data.external_ids.tvdb_id === tvdbId
      );
    });

    try {
      if (found) {
        return res.status(403).send("This is an anime.");
      } else {
        logos = movieResponse.data.images.logos;
        let highestVotedLogo;
        if (logos.length > 0) {
          highestVotedLogo = logos.reduce(
            (max, logo) => (logo.vote_count > max.vote_count ? logo : max),
            logos[0]
          );
        }

        const logo_path = highestVotedLogo ? highestVotedLogo.file_path : null;
        const genres = movieResponse.data.genres;
        let certification;
        const usReleaseDates = movieResponse.data.release_dates.results.filter(
          (release) => release.iso_3166_1 === "US"
        );
        if (
          usReleaseDates.length > 0 &&
          usReleaseDates[0].release_dates.length > 0
        ) {
          certification = usReleaseDates[0].release_dates[0].certification;
        }

        // Create an array of objects for batch insertion
        const movieGenreRows = genres.map((genre) => ({
          movie_id: movieId,
          genre_id: genre.id,
        }));

        const { error } = await supabase.from("tmdb_movies").upsert(
          [
            {
              id: movieId,
              title: movieResponse.data.title,
              overview: movieResponse.data.overview,
              poster_path: movieResponse.data.poster_path
                ? `https://image.tmdb.org/t/p/original${movieResponse.data.poster_path}`
                : null,
              backdrop_path: movieResponse.data.backdrop_path
                ? `https://image.tmdb.org/t/p/original${movieResponse.data.backdrop_path}`
                : null,
              release_date: movieResponse.data.release_date,
              runtime: movieResponse.data.runtime,
              vote_average: movieResponse.data.vote_average,
              vote_count: movieResponse.data.vote_count,
              tagline: movieResponse.data.tagline,
              status: movieResponse.data.status,
              adult: movieResponse.data.adult,
              budget: movieResponse.data.budget,
              revenue: movieResponse.data.revenue,
              homepage: movieResponse.data.homepage,
              imdb_id: movieResponse.data.imdb_id,
              original_language: movieResponse.data.original_language,
              original_title: movieResponse.data.original_title,
              popularity: movieResponse.data.popularity,
              logo_path: logo_path,
              certification: certification,
            },
          ],
          {
            onConflict: "id",
            ignoreDuplicates: true,
            defaultToNull: true,
          }
        );

        if (error) {
          console.error(
            `Error inserting ${movieId}data to tmdb_movies: ${error.message}`
          );
          return;
        }

        // Insert all genre rows in a single batch
        const { error: movies_genres_error } = await supabase
          .from("tmdb_movies_genres")
          .insert(movieGenreRows);

        // Handle any errors
        if (movies_genres_error) {
          console.error(
            `Error inserting ${movieId} to tmdb_movies_genres junction table: ${movies_genres_error}`
          );
          return;
        }

        //Add movie response directly to supabase table with json data for denormalized data retrieval
        const { error: movieResponseError } = await supabase
          .from("tmdb_movies_json")
          .upsert({
            id: movieId,
            movies_data: movieResponse.data,
          });

        if (movieResponseError) {
          console.error(
            `Error inserting ${movieId}data to tmdb_movies_json: ${movieResponseError}`
          );
          return;
        }

        res.send(movieResponse.data);
      }
    } catch (err) {
      console.error("Error reading JSON file:", err);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    res
      .status(500)
      .send("An error occurred while trying to fetch the movie data");
  }
});

app.get("/api/search/:query", async (req, res) => {
  try {
    const searchResponse = await axios.get(
      `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${req.params.query}`
    );
    res.send(searchResponse.data);
  } catch (error) {
    console.error(`Error: ${error}`);
    res
      .status(500)
      .send("An error occurred while trying to fetch the search results");
  }
});

app.get("/api/gettv/:id", async (req, res) => {
  const { id } = req.params;
  let { data: tvData, error: tvDataError } = await supabase
    .from("tmdb_tv_json")
    .select("tv_data")
    .eq("id", id)
    .single();

  if (tvData) {
    return res.status(200).send(tvData.tv_data);
  }

  if (tvDataError && tvDataError.code !== "PGRST116")
    console.error(tvDataError);

  if (tvDataError.code === "PGRST116") {
    try {
      const response = await axios.get(
        `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=aggregate_credits,content_ratings,images,recommendations,videos,watch/providers,external_ids,credits,keywords`
      );
      tvData = response.data;

      if (tvData.external_ids) {
        const animeFound = animeListCache.some((anime) => {
          const animeTvdbId = String(anime._tvdbid);
          const externalTvdbId = String(tvData.external_ids.tvdb_id);

          return animeTvdbId === externalTvdbId;
        });

        if (animeFound) {
          return res.status(403).send("This is an anime.");
        } else {
          if (tvData.aggregate_credits && tvData.aggregate_credits.cast) {
            tvData.aggregate_credits.cast = tvData.aggregate_credits.cast
              .sort((a, b) => a.order - b.order)
              .slice(0, 50);
          }

          if (tvData.aggregate_credits && tvData.aggregate_credits.crew) {
            tvData.aggregate_credits.crew = tvData.aggregate_credits.crew
              .sort((a, b) => b.popularity - a.popularity)
              .slice(0, 50);
          }

          if (tvData.credits.cast && tvData.credits.cast) {
            tvData.credits.cast = tvData.credits.cast
              .sort((a, b) => a.order - b.order)
              .slice(0, 50);
          }

          if (tvData.credits && tvData.credits.crew) {
            tvData.credits.crew = tvData.credits.crew
              .sort((a, b) => b.popularity - a.popularity)
              .slice(0, 50);
          }

          if (tvData.content_ratings && tvData.content_ratings.results) {
            const usRating = tvData.content_ratings.results.find(
              (rating) => rating.iso_3166_1 === "US"
            );
            tvData.content_ratings = usRating ? usRating.rating : null;
          }

          if (tvData.spoken_languages) {
            tvData.spoken_languages = tvData.spoken_languages
              .map(function (language) {
                return language.english_name;
              })
              .filter(function (name) {
                return name != null;
              });
          }

          res.status(200).send(tvData);
          const { error } = await supabase
            .from("tmdb_tv_json")
            .insert([{ id, tv_data: tvData }]);
          if (error) {
            console.error(
              `Error inserting TV show details into database: ${error}`
            );
          }
        }
      }
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .send("An error occurred while trying to fetch the TV show data");
    }
  }
});

app.get("/api/gettvseason/:id/:season_number", async (req, res) => {
  const { id, season_number } = req.params;
  let { data: seasonData, error: seasonDataError } = await supabase
    .from("tmdb_tv_seasons_json")
    .select("json")
    .eq("tv_id", id)
    .eq("season_number", season_number)
    .single();

  if (seasonData) {
    return res.status(200).send(seasonData.json);
  }

  if (seasonDataError && seasonDataError.code !== "PGRST116")
    console.error(seasonDataError);

  if (seasonDataError.code === "PGRST116") {
    try {
      const response = await axios.get(
        `https://api.themoviedb.org/3/tv/${id}/season/${season_number}?api_key=${process.env.TMDB_API_KEY}`
      );
      seasonData = response.data;

      res.status(200).send(seasonData);
      const { error } = await supabase
        .from("tmdb_tv_seasons_json")
        .insert([
          { id: seasonData._id, tv_id: id, season_number, json: seasonData },
        ]);
      if (error) {
        console.error(
          `Error inserting TV show season details into database: ${error}`
        );
      }
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .send(
          "An error occurred while trying to fetch the TV show season data"
        );
    }
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
