import { checkIfAnime } from "../models/animeModel.js";
import {
  fetchTVDataFromTMDB,
  fetchSeasonDataFromAPI,
} from "../services/tmdbServices.js";
import redis from "../ioredisClient.js";

function processTVData(tvData) {
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

  if (tvData.credits && tvData.credits.cast) {
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
      .map((language) => language.english_name)
      .filter((name) => name != null);
  }
}

async function getTV(req, res) {
  const { id } = req.params;
  const cacheKey = `tv:${id}`;

  const cachedTV = await redis.get(cacheKey);
  if (cachedTV) {
    return res.json(JSON.parse(cachedTV));
  }

  const tvData = await fetchTVDataFromTMDB(id);
  if (tvData.external_ids.tvdb_id) {
    const isAnime = await checkIfAnime(tvData.external_ids.tvdb_id);
    if (isAnime) {
      res.send({ message: "This is an anime.", data: isAnime });
      return;
    }
  }

  processTVData(tvData);
  res.status(200).send(tvData);

  await redis.set(cacheKey, JSON.stringify(tvData), "EX", 900);
}

async function getTVSeason(req, res) {
  const { id, season_number } = req.params;
  const cacheKey = `tv:${id}:season:${season_number}`;

  const cachedSeason = await redis.get(cacheKey);
  if (cachedSeason) {
    return res.json(JSON.parse(cachedSeason));
  }

  try {
    const seasonData = await fetchSeasonDataFromAPI(id, season_number);
    res.status(200).send(seasonData);
    await redis.set(cacheKey, JSON.stringify(seasonData), "EX", 900);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .send("An error occurred while trying to fetch the TV show season data");
  }
}

export { getTV, getTVSeason };
