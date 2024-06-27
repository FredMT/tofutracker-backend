import { fetchTrending } from "../services/tmdbServices.js";
import { fetchAnidbTrending } from "../services/anidbServices.js";
import supabase from "../supabaseClient.js";
import redis from "../ioredisClient.js";

function getBestLogo(logos) {
  const englishLogos = logos.filter((logo) => logo.iso_639_1 === "en");
  const sortedLogos = (englishLogos.length > 0 ? englishLogos : logos).sort(
    (a, b) => b.vote_average - a.vote_average
  );
  return sortedLogos.length > 0 ? sortedLogos[0].file_path : "";
}

const yearExtractor = (item) => {
  if ("release_date" in item) {
    return item.release_date.split("-")[0];
  } else if ("first_air_date" in item) {
    return item.first_air_date.split("-")[0];
  } else if ("start_date" in item) {
    return item.start_date.split("-")[0];
  }
  return "";
};

const ratingExtractor = (item) => {
  if ("vote_average" in item) {
    return parseFloat(item.vote_average.toFixed(2));
  } else if ("rating" in item) {
    return parseFloat(item.rating.toFixed(2));
  }
  return 0;
};

async function getTrending(_, res) {
  let cachedData = await redis.get("trendingData");
  if (cachedData) {
    return res.json(JSON.parse(cachedData));
  }
  const { data, error } = await supabase
    .from("trending")
    .select("movies, tvShows, anime")
    .eq("id", 1);

  if (error) {
    console.error("Supabase error:", error);
    return res.status(500).json({ error: error.message });
  }

  await redis.set("trendingData", JSON.stringify(data[0]), "EX", 86400);
  return res.json(data[0]);
}

// async function getTrendingByID(req, res) {
//   const { id } = req.params;

//   const { data, error } = await supabase
//     .from("trending")
//     .select("movies, tvShows, anime")
//     .eq("id", 1);

//   if (error) {
//     console.error("Supabase error:", error);
//     return res.status(500).json({ error: error.message });
//   }

//   const { data: itemListData, error: itemListError } = await supabase
//     .from("item_lists")
//     .select("item_id, list_type")
//     .eq("user_id", id);

//   if (itemListError) {
//     console.error("Supabase error:", itemListError);
//     return res.status(500).json({ error: itemListError.message });
//   }

//   const itemSet = itemListData.reduce((acc, item) => {
//     acc[item.item_id] = acc[item.item_id] || {
//       isInLibrary: false,
//       isInWatchlist: false,
//     };
//     if (item.list_type === "Library") acc[item.item_id].isInLibrary = true;
//     if (item.list_type === "Watchlist") acc[item.item_id].isInWatchlist = true;
//     return acc;
//   }, {});

//   // Enrich movies, tvShows, and anime with isInLibrary and isInWatchlist
//   const enrichItems = (items) =>
//     items.map((item) => ({
//       ...item,
//       isInLibrary: itemSet[item.id]?.isInLibrary || false,
//       isInWatchlist: itemSet[item.id]?.isInWatchlist || false,
//     }));

//   const movies = enrichItems(data[0].movies);
//   const tvShows = enrichItems(data[0].tvShows);
//   const anime = enrichItems(data[0].anime);

//   const enrichedData = { ...data[0], movies, tvShows, anime };

//   return res.json(enrichedData);
// }

async function getTrendingByID(req, res) {
  const { id } = req.params;

  try {
    const [{ data, error }, { data: itemListData, error: itemListError }] =
      await Promise.all([
        supabase.from("trending").select("movies, tvShows, anime").eq("id", 1),
        supabase
          .from("item_lists")
          .select("item_id, list_type")
          .eq("user_id", id),
      ]);

    if (error || itemListError) {
      console.error("Supabase error:", error || itemListError);
      const errorMessage = `${error?.message || ""} ${
        itemListError?.message || ""
      }`;
      return res.status(500).json({ error: errorMessage });
    }

    const enrichItems = (items) =>
      items.map((item) => ({
        ...item,
        isInLibrary: itemListData.some(
          ({ item_id, list_type }) =>
            item_id === item.id && list_type === "Library"
        ),
        isInWatchlist: itemListData.some(
          ({ item_id, list_type }) =>
            item_id === item.id && list_type === "Watchlist"
        ),
      }));

    const { movies, tvShows, anime } = data[0];
    const enrichedData = {
      movies: enrichItems(movies),
      tvShows: enrichItems(tvShows),
      anime: enrichItems(anime),
    };

    return res.json(enrichedData);
  } catch (error) {
    console.error("Error in getTrendingByID:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function fetchTrendingFromAPIS() {
  let movies = await fetchTrending("movie");
  movies = movies.map((movie) => {
    const {
      images,
      belongs_to_collection,
      production_countries,
      credits,
      keywords,
      imdb_id,
      similar,
      videos,
      homepage,
      release_dates,
      budget,
      external_ids,
      revenue,
      status,
      adult,
      video,
      original_language,
      vote_count,
      vote_average,
      ["watch/providers"]: watchProviers,
      production_companies,
      ...filteredMovie
    } = movie;
    return {
      ...filteredMovie,
      media_type: "movie",
      logo_path: getBestLogo(movie.images.logos),
      genres: movie.genres.map((genre) => genre.name),
      certification: movie.release_dates.results.find(
        (release) => release.iso_3166_1 === "US"
      )?.release_dates[0]?.certification,
      language: movie.original_language,
      year: yearExtractor(movie),
      rating: ratingExtractor(movie),
    };
  });

  let tvShows = await fetchTrending("tv");
  tvShows = tvShows.map((tvShow) => {
    const {
      adult,
      aggregate_credits,
      budget,
      created_by,
      content_ratings,
      credits,
      episode_run_time,
      external_ids,
      first_air_date,
      homepage,
      images,
      in_production,
      keywords,
      last_air_date,
      last_episode_to_air,
      languages,
      name,
      number_of_seasons,
      networks,
      next_episode_to_air,
      number_of_episodes,
      original_language,
      original_title,
      production_countries,
      production_companies,
      revenue,
      recommendations,
      seasons,
      spoken_languages,
      similar,
      status,
      type,
      videos,
      vote_count,
      vote_average,
      ["watch/providers"]: watchProviers,
      ...filteredTvShow
    } = tvShow;
    return {
      ...filteredTvShow,
      media_type: "tv",
      logo_path: getBestLogo(tvShow.images.logos),
      genres: tvShow.genres.map((genre) => genre.name),
      year: yearExtractor(tvShow),
      rating: ratingExtractor(tvShow),
      runtime: tvShow.episode_run_time[0] ?? null,
      language: tvShow.original_language,
      title: tvShow.name,
      certification: tvShow.content_ratings.results.find(
        (rating) => rating.iso_3166_1 === "US"
      )?.rating,
    };
  });

  let anime = await fetchAnidbTrending();
  anime = anime.map((animeItem) => ({ ...animeItem, media_type: "anime" }));

  let updated_at = new Date().toISOString();

  const trendingData = { movies, tvShows, anime, updated_at };

  return trendingData;
}

async function updateTrending(_, res) {
  console.log(
    "Running cron job every day at 12:59PM to fetch and update trending items"
  );
  const data = await fetchTrendingFromAPIS();

  const { error } = await supabase.from("trending").update([data]).eq("id", 1);

  if (error) {
    console.error("Supabase error:", error);
    throw new Error(error.message);
  }

  console.log("Cron job done");

  await redis.set("trendingData", JSON.stringify(data), "EX", 86400);

  return res.status(200).json({ message: "Trending items updated" });
}

export { getTrending, fetchTrendingFromAPIS, updateTrending, getTrendingByID };
