const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();
const fs = require("fs");
const xml2js = require("xml2js");
const supabase = require("./supabaseClient");
const movieRoutes = require("./routes/movieRoutes");
const trendingRoutes = require("./routes/trendingRoutes");
const app = express();
app.use(cors());

const port = process.env.PORT || 8080;

// Load the anime list into cache before starting the server
const animeListCache = {};

const loadAnimeListToCache = () => {
  fs.readFile("anime-list.json", "utf8", (err, data) => {
    if (err) {
      console.log("Error reading anime-list.json:", err);
      return;
    }
    try {
      const animeList = JSON.parse(data);
      animeListCache["animeList"] = animeList["anime-list"]["anime"];
      console.log("Anime list loaded to cache successfully.");
    } catch (parseError) {
      console.log("Error parsing anime-list.json:", parseError);
    }
  });
};

loadAnimeListToCache();

const animeTitlesCache = {};

const loadAnimeTitlesToCache = () => {
  fs.readFile("anime-titles.xml", "utf8", (err, data) => {
    if (err) {
      console.log("Error reading anime-titles.xml:", err);
      return;
    }
    xml2js.parseString(data, (err, result) => {
      if (err) {
        console.log("Error parsing anime-titles.xml:", err);
        return;
      }
      animeTitlesCache["animeTitles"] = result.animetitles.anime;
      console.log("Anime titles loaded to cache successfully.");
    });
  });
};

loadAnimeTitlesToCache();

let tvdbTmdbAnidbListCache = [];

const loadTvdbTmdbAnidbListToCache = () => {
  fs.readFile("tvdb-tmdb-anidb-list.json", "utf8", (err, data) => {
    if (err) {
      console.log("Error reading tvdb-tmdb-anidb-list.json:", err);
      return;
    }
    try {
      tvdbTmdbAnidbListCache = JSON.parse(data);
      console.log("TVDB TMDB AniDB list loaded to cache successfully.");
    } catch (parseError) {
      console.log("Error parsing tvdb-tmdb-anidb-list.json:", parseError);
    }
  });
};

loadTvdbTmdbAnidbListToCache();

async function fetchTVDataFromSupabase(id) {
  let { data, error } = await supabase
    .from("tmdb_tv_json")
    .select("tv_data")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code !== "PGRST116") console.log(error);
    return null;
  }

  return data.tv_data;
}

async function fetchTVDataFromTMDB(id) {
  const response = await axios.get(
    `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=aggregate_credits,content_ratings,images,recommendations,videos,watch/providers,external_ids,credits,keywords`
  );
  const tvData = response.data;

  if (checkForAnime(tvData)) {
    throw new Error("This is an anime.");
  }

  return tvData;
}

function checkForAnime(tvData) {
  if (tvData.external_ids) {
    return animeListCache["animeList"].some((anime) => {
      const animeTvdbId = String(anime._tvdbid);
      const externalTvdbId = String(tvData.external_ids.tvdb_id);
      return animeTvdbId === externalTvdbId;
    });
  }
  return false;
}

async function processAndTrimTVData(tvData) {
  if (tvData.external_ids) {
    const animeFound = animeListCache["animeList"].some((anime) => {
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
    }
  }
}

async function insertTVDataIntoSupabase(id, tvData) {
  const { error } = await supabase
    .from("tmdb_tv_json")
    .insert([{ id, tv_data: tvData }]);
  if (error) {
    console.error(`Error inserting TV show details into database: ${error}`);
  }
}

async function fetchSeasonDataFromDB(id, season_number) {
  let { data: seasonData, error: seasonDataError } = await supabase
    .from("tmdb_tv_seasons_json")
    .select("json")
    .eq("tv_id", id)
    .eq("season_number", season_number)
    .single();

  return { seasonData, seasonDataError };
}

async function fetchSeasonDataFromAPI(id, season_number) {
  const response = await axios.get(
    `https://api.themoviedb.org/3/tv/${id}/season/${season_number}?api_key=${process.env.TMDB_API_KEY}`
  );
  return response.data;
}

async function insertSeasonDataIntoDB(id, season_number, seasonData) {
  const { error } = await supabase
    .from("tmdb_tv_seasons_json")
    .insert([
      { id: seasonData._id, tv_id: id, season_number, json: seasonData },
    ]);
  if (error) {
    console.log(
      `Error inserting TV show season details into database: ${error}`
    );
    throw new Error(error.message);
  }
}

app.use("/api", movieRoutes);
app.use("/api", trendingRoutes);

app.get("/api/search/:query", async (req, res) => {
  try {
    const searchResponse = await axios.get(
      `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${req.params.query}`
    );
    res.send(searchResponse.data);
  } catch (error) {
    console.log(`Error: ${error}`);
    res
      .status(500)
      .send("An error occurred while trying to fetch the search results");
  }
});

app.get("/api/gettv/:id", async (req, res) => {
  const { id } = req.params;

  try {
    let tvData = await fetchTVDataFromSupabase(id);
    if (!tvData) {
      tvData = await fetchTVDataFromTMDB(id);
      await processAndTrimTVData(tvData);
      await insertTVDataIntoSupabase(id, tvData);
    }
    res.status(200).send(tvData);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("An error occurred while processing the request.");
  }
});

app.get("/api/gettvseason/:id/:season_number", async (req, res) => {
  const { id, season_number } = req.params;

  try {
    let { seasonData, seasonDataError } = await fetchSeasonDataFromDB(
      id,
      season_number
    );

    if (seasonData) {
      return res.status(200).send(seasonData.json);
    }

    if (seasonDataError && seasonDataError.code !== "PGRST116") {
      console.log(seasonDataError);
    }

    if (seasonDataError && seasonDataError.code === "PGRST116") {
      seasonData = await fetchSeasonDataFromAPI(id, season_number);
      res.status(200).send(seasonData);
      await insertSeasonDataIntoDB(id, season_number, seasonData);
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .send("An error occurred while trying to fetch the TV show season data");
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
