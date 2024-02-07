const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
const port = process.env.PORT || 8080;
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,images,similar,videos,watch/providers,release_dates`
    );

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
    const spokenLanguages = movieResponse.data.spoken_languages;
    const production_companies = movieResponse.data.production_companies;
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

    // Create an array of objects for batch insertion
    const spokenLanguagesRows = spokenLanguages.map((language) => ({
      movie_id: movieId,
      name: language.english_name,
    }));

    const productionCompanies = production_companies.map((company) => ({
      id: company.id,
      name: company.name,
      logo_path: company.logo_path,
      origin_country: company.origin_country,
    }));

    const productionCompaniesRows = productionCompanies.map((company) => ({
      movie_id: movieId,
      company_id: company.id,
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

    const { error: spoken_languages_error } = await supabase
      .from("tmdb_spoken_languages")
      .insert(spokenLanguagesRows);

    // Handle any errors
    if (spoken_languages_error) {
      console.error(
        `Error inserting ${movieId} to tmdb_spoken_languages: ${spoken_languages_error}`
      );
      return;
    }

    // Fetch existing production company IDs from the database
    const {
      data: existingProductionCompanies,
      error: existing_production_companies_error,
    } = await supabase.from("tmdb_production_companies").select("id");

    if (existing_production_companies_error) {
      console.error(
        `Error fetching ${movieId}'s existing production companies: ${existing_production_companies_error}`
      );
      return;
    }

    // Extract existing IDs for comparison
    const existingIDs = existingProductionCompanies.map(
      (company) => company.id
    );

    // Filter out production companies already in the database
    const newProductionCompanies = productionCompanies.filter(
      (company) => !existingIDs.includes(company.id)
    );

    // Insert new production companies
    if (newProductionCompanies.length > 0) {
      const { error: new_production_companies_error } = await supabase
        .from("tmdb_production_companies")
        .insert(
          newProductionCompanies.map((company) => ({
            ...company,
            logo_path: `https://image.tmdb.org/t/p/original${company.logo_path}`,
          }))
        );

      if (new_production_companies_error) {
        console.error(
          `Error inserting ${movieId}'s new production companies: ${new_production_companies_error}`
        );
        return;
      }
    }

    const { error: production_companies_error } = await supabase
      .from("tmdb_movies_production_companies")
      .insert(productionCompaniesRows);

    if (production_companies_error) {
      console.error(
        `Error inserting tmdb_movies_production_companies junction table data: ${production_companies_error}`
      );
      return;
    }

    const castAndCrew = [
      ...movieResponse.data.credits.cast,
      ...movieResponse.data.credits.crew,
    ];
    const castAndCrewRows = castAndCrew.reduce((unique, person) => {
      if (!unique.some((obj) => obj.id === person.id)) {
        unique.push({
          id: person.id,
          gender:
            person.gender === 0
              ? "Not specified"
              : person.gender === 1
              ? "Female"
              : person.gender === 2
              ? "Male"
              : person.gender === 3
              ? "Non-binary"
              : "Unknown",
          known_for_department: person.known_for_department,
          name: person.name,
          original_name: person.original_name,
          popularity: person.popularity,
          profile_path: `https://image.tmdb.org/t/p/original${person.profile_path}`,
        });
      }
      return unique;
    }, []);

    const { error: castAndCrewError } = await supabase
      .from("tmdb_person")
      .upsert(castAndCrewRows, {
        onConflict: "id",
        ignoreDuplicates: true,
        defaultToNull: true,
      });

    if (castAndCrewError) {
      console.error(
        `Error inserting ${movieId} person data to tmdb_person: ${castAndCrewError}`
      );
      return;
    }

    const sortedCastByPopularity = movieResponse.data.credits.cast
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 100);
    const castRows = sortedCastByPopularity.map((cast) => ({
      id: cast.credit_id,
      person_id: cast.id,
      movie_id: movieId,
      character: cast.character,
      order: cast.order,
    }));

    const { error: castError } = await supabase
      .from("tmdb_cast")
      .insert(castRows, {
        onConflict: "id",
        ignoreDuplicates: true,
        defaultToNull: true,
      });

    if (castError) {
      console.error(
        `Error inserting ${movieId} cast data to tmdb_cast: ${castError}`
      );
      return;
    }

    const sortedCrewByPopularity = movieResponse.data.credits.crew
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 100);
    const crewRows = sortedCrewByPopularity.map((crew) => ({
      id: crew.credit_id,
      person_id: crew.id,
      movie_id: movieId,
      department: crew.department,
      job: crew.job,
    }));

    const { error: crewError } = await supabase
      .from("tmdb_crew")
      .insert(crewRows, {
        onConflict: "id",
        ignoreDuplicates: true,
        defaultToNull: true,
      });

    if (crewError) {
      console.error(
        `Error inserting ${movieId} crew data to tmdb_cast: ${crewError}`
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

// app.get("/api/gettv/:id", async (req, res) => {
//   try {
//     const tvId = req.params.id;

//     // First, check if the movie already exists in the Supabase database
//     const { data: existingTV, error: existingTVError } = await supabase
//       .from("tmdb_tv_json")
//       .select("tv_data")
//       .eq("id", tvId)
//       .single();

//     if (existingTVError && existingTVError.code !== "PGRST116") {
//       console.error("Error fetching existing movie:", existingTVError);
//       return res
//         .status(500)
//         .send("An error occurred while trying to fetch the movie data");
//     }

//     // Return movie from database if it already exists
//     if (existingTV) {
//       return res.json({
//         ...existingTV.tv_data,
//       });
//     }

//     // If the TV show does not exist in the database, proceed with the TMDB API call
//     const tvResponse = await axios.get(
//       `https://api.themoviedb.org/3/tv/${tvId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=aggregate_credits,content_ratings,images,recommendations,videos,watch/providers,external_ids,credits`
//     );

//     const numberOfSeasons = tvResponse.data.number_of_seasons;
//     let seasons = [];

//     // Function to fetch seasons in batches
//     async function fetchSeasonsBatch(tvId, startSeason, endSeason) {
//       let appendToResponse = Array.from(
//         { length: endSeason - startSeason },
//         (_, i) => `season/${i + startSeason}`
//       ).join(",");
//       try {
//         const response = await axios.get(
//           `https://api.themoviedb.org/3/tv/${tvId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=${appendToResponse}`
//         );
//         return Array.from(
//           { length: endSeason - startSeason },
//           (_, i) => response.data[`season/${i + startSeason}`]
//         ).filter(Boolean);
//       } catch (error) {
//         console.error(
//           `Error fetching seasons ${startSeason} to ${endSeason}:`,
//           error
//         );
//         return [];
//       }
//     }

//     // Fetch all seasons in parallel, considering the API's limit
//     const maxAppendEndpoints = 20;
//     for (let i = 0; i < numberOfSeasons; i += maxAppendEndpoints) {
//       const batch = await fetchSeasonsBatch(
//         tvId,
//         i,
//         Math.min(i + maxAppendEndpoints, numberOfSeasons)
//       );
//       seasons = seasons.concat(batch);
//     }

//     res.status(200).send(seasons);

//     // Insert the fetched TV details into the Supabase database
//     try {
//       const { error } = await supabase
//         .from("tmdb_tv_json")
//         .insert([{ id: tvId, tv_data: tvResponse.data }]);
//       if (error) throw error;
//     } catch (dbError) {
//       console.error(`Error inserting TV details into database: ${dbError}`);
//       return res
//         .status(500)
//         .send("An error occurred while trying to save the TV details");
//     }
//   } catch (error) {
//     console.error(`Error: ${error}`);
//     res
//       .status(500)
//       .send("An error occurred while trying to fetch the TV results");
//   }
// });

app.get("/api/gettv/:id", async (req, res) => {
  try {
    const tvId = req.params.id;

    // Check if the TV show already exists in the Supabase database
    const { data: existingTV, error: existingTVError } = await supabase
      .from("tmdb_tv_json")
      .select("tv_data")
      .eq("id", tvId)
      .single();

    if (existingTVError && existingTVError.code !== "PGRST116") {
      console.error("Error fetching existing TV show:", existingTVError);
      return res
        .status(500)
        .send("An error occurred while trying to fetch the TV show data");
    }

    // Return TV show from database if it already exists
    if (existingTV) {
      return res.json(existingTV.tv_data);
    }

    // If the TV show does not exist in the database, proceed with the TMDB API call
    const tvResponse = await axios.get(
      `https://api.themoviedb.org/3/tv/${tvId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=aggregate_credits,content_ratings,images,recommendations,videos,watch/providers,external_ids,credits`
    );

    // Insert the fetched TV show details into the Supabase database
    const { error: tvInsertError } = await supabase
      .from("tmdb_tv_json")
      .insert([{ id: tvId, tv_data: tvResponse.data }]);

    if (tvInsertError)
      return res
        .status(500)
        .send("An error occurred while trying to save the TV show details");

    const numberOfSeasons = tvResponse.data.number_of_seasons;
    let seasons = [];

    // Function to fetch seasons in batches
    async function fetchSeasonsBatch(startSeason, endSeason) {
      let appendToResponse = Array.from(
        { length: endSeason - startSeason + 1 },
        (_, i) => `season/${i + startSeason}`
      ).join(",");
      const response = await axios.get(
        `https://api.themoviedb.org/3/tv/${tvId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=${appendToResponse}`
      );
      return Array.from(
        { length: endSeason - startSeason + 1 },
        (_, i) => response.data[`season/${i + startSeason}`]
      ).filter(Boolean);
    }

    // Fetch all seasons in parallel, considering the API's limit
    const maxAppendEndpoints = 20;
    for (let i = 0; i <= numberOfSeasons; i += maxAppendEndpoints) {
      const endSeason = Math.min(i + maxAppendEndpoints - 1, numberOfSeasons);
      const batch = await fetchSeasonsBatch(i, endSeason);
      seasons = seasons.concat(batch);
    }

    // Insert seasons into Supabase
    const seasonInserts = seasons.map((season) => ({
      tv_id: tvId,
      season_number: season.season_number,
      season_json: season,
    }));

    const { error: seasonInsertError } = await supabase
      .from("tmdb_tv_seasons_json")
      .insert(seasonInserts);

    if (seasonInsertError)
      return res
        .status(500)
        .send("An error occurred while trying to save the TV show seasons");

    res.status(200).send({ tvDetails: tvResponse.data, seasons });
  } catch (error) {
    console.error(`Error: ${error}`);
    res
      .status(500)
      .send("An error occurred while trying to fetch the TV show details");
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
