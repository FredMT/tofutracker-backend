const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const xml2js = require("xml2js");

const app = express();
app.use(cors());
const port = process.env.PORT || 8080;
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.get("/api/trending", async (req, res) => {
  try {
    const trendingResponse = await axios.get(
      `https://api.themoviedb.org/3/trending/movie/day?api_key=${process.env.TMDB_API_KEY}`
    );

    const moviesWithLogos = await Promise.all(
      trendingResponse.data.results.map(async (movie) => {
        try {
          const imagesResponse = await axios.get(
            `https://api.themoviedb.org/3/movie/${movie.id}/images?api_key=${process.env.TMDB_API_KEY}&include_image_language=en,null`
          );
          const logos = imagesResponse.data.logos;
          if (logos && logos.length > 0) {
            movie.logo_path = logos[0].file_path;
          }
          return movie;
        } catch (imageError) {
          console.error(
            `Error fetching images for movie ID ${movie.id}: ${imageError}`
          );
          return movie;
        }
      })
    );

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

    if (existingMovie) {
      return res.json({
        ...existingMovie.movies_data,
      });
    }

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

        const { error: movies_genres_error } = await supabase
          .from("tmdb_movies_genres")
          .insert(movieGenreRows);

        if (movies_genres_error) {
          console.error(
            `Error inserting ${movieId} to tmdb_movies_genres junction table: ${movies_genres_error}`
          );
          return;
        }

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

function delay(ms) {
  console.log(`Delaying for ${ms} milliseconds`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkIfIDExists(id) {
  const xml = fs.readFileSync("anime-titles.xml", "utf8");
  const result = await new Promise((resolve, reject) => {
    xml2js.parseString(xml, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  const animeExists = result.animetitles.anime.some(
    (anime) => anime.$.aid === id.toString()
  );
  return animeExists;
}

async function checkIfIDExistsInDatabase(id) {
  const { error } = await supabase
    .from("anidb_anime")
    .select("id")
    .eq("id", id)
    .single();

  if (error && error.code === "PGRST116") {
    console.error(`Anime with id ${id} does not exist in database.`);
    return false;
  }

  if (error) {
    console.error("Error fetching anime data:", error);
    return false;
  }

  return true;
}

async function fetchAnimeDetailsFromDatabase(id) {
  const { data, error } = await supabase
    .from("anidb_anime")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching anime data:", error);
    return null;
  }
  return data;
}

async function fetchAnimeDetailsFromAnidb(id) {
  const url = `http://api.anidb.net:9001/httpapi?request=anime&client=shortness&clientver=1&protover=1&aid=${id}`;

  try {
    await delay(2100);
    const response = await fetch(url);
    const xml = await response.text();

    const result = await new Promise((resolve, reject) => {
      xml2js.parseString(xml, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const { anime } = result;
    return anime;
  } catch (error) {
    console.error("Failed to fetch or save anime details:", error);
    return;
  }
}

async function insertAnimeDetailsAndRelations(
  anime_id,
  animeDetails,
  relatedAnime
) {
  console.log(`Inserting anime details for ID: ${anime_id} into database...`);

  const { error } = await supabase.from("anidb_anime").insert([animeDetails]);

  if (error) {
    console.error("Failed to insert anime details:", error);
    return;
  }

  console.log(`Inserted anime details for ID: ${anime_id} into database.`);

  console.log(`Checking if related anime exists for ID: ${anime_id}...`);
  if (relatedAnime && relatedAnime.length > 0) {
    console.log(`Inserting related anime for ID: ${anime_id} into database...`);
    const { error: relatedError } = await supabase
      .from("anidb_relations")
      .insert(relatedAnime);

    if (relatedError) {
      console.error("Failed to insert related anime:", relatedError);
    } else {
      console.log(`Inserted related anime for ID: ${anime_id} into database.`);
    }
  } else {
    console.log(`No related anime found for ID: ${anime_id}`);
  }
}

////////////////////////
// Extract functions //
//////////////////////

async function extractTitles(anime) {
  const { title, english_title, japanese_title } = anime.titles.reduce(
    (acc, titleGroup) => {
      acc.title = titleGroup.title
        .filter((title) => title.$.type === "main")
        .map((title) => title._)[0];
      acc.english_title = titleGroup.title
        .filter((title) => title.$["xml:lang"] === "en")
        .map((title) => title._)[0];
      acc.japanese_title = titleGroup.title
        .filter((title) => title.$["xml:lang"] === "ja")
        .map((title) => title._)[0];

      return acc;
    },
    { title: "", english_title: "", japanese_title: "" }
  );

  return { title, english_title, japanese_title };
}

async function extractCoreInfo(anime) {
  const type = anime.type?.[0];
  const episode_count = anime.episodecount?.[0];
  const start_date = anime.startdate?.[0];
  const end_date = anime.enddate?.[0];
  const homepage = anime.url?.[0];

  return { type, episode_count, start_date, end_date, homepage };
}

async function extractStudios(anime) {
  const studios = anime.creators?.[0].name.reduce(function (acc, creator) {
    if (creator.$.type === "Work" || creator.$.type === "Animation Work") {
      acc.push(creator._);
    }
    return acc;
  }, []);

  if (studios) {
    return studios.join(", ");
  }
  return null;
}

async function extractAuthors(anime) {
  const author = anime.creators?.[0].name.reduce(function (acc, creator) {
    if (creator.$.type === "Original Work") {
      acc.push(creator._);
    }
    return acc;
  }, []);

  if (author) {
    return author.join(", ");
  }
  return null;
}

async function extractDescription(anime) {
  const description = anime.description?.[0]
    .replace(/\[|\]/g, "")
    .replace(/http:\/\/anidb\.net\/ch\d+\s/g, "");

  return description;
}

async function extractRating(anime) {
  const rating = anime.ratings?.[0]?.permanent?.[0]._;

  return rating;
}

async function extractPoster(anime) {
  let poster = anime.picture?.[0];
  if (poster) {
    poster = `https://anidb.net/images/main/${anime.picture?.[0]}`;
  }
  return poster;
}

async function extractCharacters(anime) {
  const characters = anime.characters?.[0].character.reduce(function (
    acc,
    character
  ) {
    // Check if `seiyuu` exists and has at least one entry with known name and picture
    if (
      character.name &&
      character.name.length > 0 &&
      character.picture &&
      character.picture.length > 0 &&
      character.seiyuu &&
      character.seiyuu.length > 0 &&
      character.seiyuu[0]._ &&
      character.seiyuu[0].$.picture
    ) {
      const characterData = {
        name: character.name[0],
        picture: `https://anidb.net/images/main/${character.picture[0]}`,
        seiyuu: {
          name: character.seiyuu[0]._,
          picture: `https://anidb.net/images/main/${character.seiyuu[0].$.picture}`,
        },
      };
      acc.push(characterData);
    }
    return acc;
  },
  []);

  if (characters && characters.length > 0) {
    return characters;
  }
  return;
}

async function extractExternalLinks(anime) {
  const external_links = anime.resources?.[0]?.resource.reduce(function (
    acc,
    resource
  ) {
    const linkTypes = {
      23: `https://twitter.com/${resource.externalentity?.[0]?.identifier?.[0]}`,
      32: `https://amazon.com/dp/${resource.externalentity?.[0]?.identifier?.[0]}`,
      28: `https://crunchyroll.com/series/${resource.externalentity?.[0]?.identifier?.[0]}`,
      42: `https://hidive.com/${resource.externalentity?.[0]?.identifier?.[0]}`,
      41: `https://netflix.com/title/${resource.externalentity?.[0]?.identifier?.[0]}`,
      48: `https://www.primevideo.com/detail/${resource.externalentity?.[0]?.identifier?.[0]}`,
    };
    const linkNames = {
      23: "Twitter",
      32: "Amazon",
      28: "Crunchyroll",
      42: "HiDive",
      41: "Netflix",
      48: "Amazon Prime Video",
    };
    const link = linkTypes[resource?.$?.type];
    if (link) {
      const linkName = linkNames[resource?.$?.type];
      acc.push({ name: linkName, url: link });
    }
    return acc;
  },
  []);

  if (external_links && external_links.length > 0) {
    return external_links;
  }
  return;
}

async function extractRelatedAnime(anime) {
  const relatedAnime = anime.relatedanime?.[0].anime.map((related) => ({
    anime_id: anime.$.id,
    related_id: related.$["id"],
    type: related.$["type"],
  }));
  return relatedAnime;
}

//////////////////////////////
// End of Extract functions //
//////////////////////////////

async function fetchAnime(
  id,
  fetchedAnimeIds = new Set(),
  respond = true,
  res = null
) {
  if (fetchedAnimeIds.has(id)) {
    console.log(`Anime with ID: ${id} has already been fetched.`);
    return;
  }
  fetchedAnimeIds.add(id);

  const animeExistsInDatabase = await checkIfIDExistsInDatabase(id);
  if (animeExistsInDatabase) {
    console.log(
      `Anime with ID: ${id} already exists in database, returning data from database.`
    );
    const anime = await fetchAnimeDetailsFromDatabase(id);
    if (respond && res) res.status(200).send(anime);
    return anime;
  } else {
    console.log(
      `Anime with ID: ${id} does not exist in database, checking if ID is valid.`
    );
  }

  console.log(`Checking if anime ${id} exists in AniDB...`);
  const animeExists = await checkIfIDExists(id);
  if (!animeExists) {
    console.error(`Anime with ID: ${id} does not exist in AniDB.`);
    if (respond && res)
      res.status(404).send(`Anime with ID: ${id} does not exist.`);
    return;
  }
  console.log(`Anime with ID: ${id} exists in AniDB, fetching details...`);
  const anime = await fetchAnimeDetailsFromAnidb(id);
  if (!anime) {
    console.error(`Failed to fetch details for anime ID: ${id} from AniDB.`);
    if (respond && res)
      res.status(500).send("Failed to fetch anime details from AniDB.");
    return;
  }

  const anime_id = anime.$.id;
  const { title, english_title, japanese_title } = await extractTitles(anime);
  const { type, episode_count, start_date, end_date, homepage } =
    await extractCoreInfo(anime);
  const studios = await extractStudios(anime);
  const authors = await extractAuthors(anime);
  const description = await extractDescription(anime);
  const rating = await extractRating(anime);
  const poster_path = await extractPoster(anime);
  const characters = await extractCharacters(anime);
  const external_links = await extractExternalLinks(anime);
  const relatedAnime = await extractRelatedAnime(anime);

  const animeDetails = {
    id: anime_id,
    title,
    english_title,
    japanese_title,
    type,
    episode_count,
    start_date,
    end_date,
    homepage,
    studios,
    authors,
    description,
    rating,
    poster_path,
    characters,
    external_links,
  };

  if (respond && res) {
    res.status(200).send(animeDetails); // Send the fetched details immediately
  }

  await insertAnimeDetailsAndRelations(id, animeDetails, relatedAnime);

  // Recursively fetch related anime in the background without sending responses
  if (relatedAnime) {
    for (const related of relatedAnime) {
      await fetchAnime(related.related_id, fetchedAnimeIds, false);
    }
  }
}

app.get("/api/getanime/:id", async (req, res) => {
  const { id } = req.params;
  await fetchAnime(id, new Set(), true, res);
});

app.get("/api/getanimechain/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase.rpc("get_complete_anime_chain", {
    start_id: id,
  });

  if (error) {
    console.error("Error fetching anime chain:", error);
    res.status(500).send("Failed to fetch anime chain");
    return;
  }
  res.status(200).send(data);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
