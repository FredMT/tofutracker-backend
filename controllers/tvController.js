const supabase = require("../supabaseClient");
const {
  fetchTVDataFromSupabase,
  insertTVDataIntoSupabase,
  fetchSeasonDataFromDB,
  insertSeasonDataIntoDB,
} = require("../models/tvModel");
const { checkIfAnime } = require("../models/animeModel");
const {
  fetchTVDataFromTMDB,
  fetchSeasonDataFromAPI,
} = require("../services/tmdbServices");

async function getTV(req, res) {
  const { id } = req.params;

  let tvData = await fetchTVDataFromSupabase(id);
  if (!tvData) {
    tvData = await fetchTVDataFromTMDB(id);
    if (tvData.external_ids.tvdb_id) {
      const isAnime = await checkIfAnime(tvData.external_ids.tvdb_id);

      if (isAnime) {
        res.send({ message: "This is an anime.", data: isAnime });
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
        await insertTVDataIntoSupabase(id, tvData);
      }
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
      await insertTVDataIntoSupabase(id, tvData);
    }
  } else {
    res.status(200).send(tvData);
  }
}

async function getTVSeason(req, res) {
  const { id, season_number } = req.params;

  try {
    let { seasonData, seasonDataError } = await fetchSeasonDataFromDB(
      id,
      season_number
    );

    if (seasonData) {
      return res.status(200).send(seasonData.json);
    }

    if (seasonDataError && seasonDataError.code === "PGRST116") {
      seasonData = await fetchSeasonDataFromAPI(id, season_number);
      res.status(200).send(seasonData);
      await insertSeasonDataIntoDB(id, season_number, seasonData);
    } else if (seasonDataError) {
      console.log(seasonDataError);
      res
        .status(500)
        .send(
          "An error occurred while trying to fetch the TV show season data"
        );
    }
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .send("An error occurred while trying to fetch the TV show season data");
  }
}

module.exports = {
  getTV,
  getTVSeason,
};
