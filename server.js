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
const ANILIST_API_URL = "https://graphql.anilist.co";

let animeListCache = [];
let animeMapTVDBIdCache = [];

async function loadAnimeListAndMap() {
  try {
    const animeListData = await fs.readFile("anime-list.json", "utf8");
    const animeList = JSON.parse(animeListData)["anime-list"].anime;
    animeListCache = animeList;

    const animeMapTVDBIdData = await fs.readFile("anilist_tvdb.json", "utf8");
    const animeMapTVDBId = JSON.parse(animeMapTVDBIdData);
    animeMapTVDBIdCache = animeMapTVDBId;
  } catch (err) {
    console.error("Error loading data from file:", err);
  }
}

loadAnimeListAndMap();

app.get("/favicon.ico", (req, res) => res.status(204).end());

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

async function fetchMediaData(mediaId, fetchedIds = new Set()) {
  if (fetchedIds.has(mediaId)) {
    return [];
  }

  fetchedIds.add(mediaId);

  const query = `
    query {
      Media(id: ${mediaId}, type: ANIME) {
        id
        title {
          userPreferred
        }
        type
        season
        seasonYear
        episodes
        duration
        source
        averageScore
        relations {
          edges {
            node {
              id
              type
              title {
                userPreferred
              }
            }
            relationType(version: 2)
          }
        }
      }
    }
  `;

  try {
    if (fetchedIds.size >= 20) {
      return [];
    }

    const response = await axios({
      url: ANILIST_API_URL,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: JSON.stringify({ query }),
    });

    const mediaData = response.data.data.Media;
    const currentMedia = {
      id: mediaData.id,
      title: mediaData.title.userPreferred,
      type: mediaData.type,
      season: mediaData.season,
      seasonYear: mediaData.seasonYear,
      episodes: mediaData.episodes,
      duration: mediaData.duration,
      source: mediaData.source,
      averageScore: mediaData.averageScore / 10,
      prequelId:
        mediaData.relations.edges.find(
          (edge) => edge.relationType === "PREQUEL"
        )?.node.id || null,
      sequelId:
        mediaData.relations.edges.find((edge) => edge.relationType === "SEQUEL")
          ?.node.id || null,
    };

    const results = [currentMedia];

    mediaData.relations.edges
      .filter((edge) => edge.relationType === "SIDE_STORY")
      .forEach((edge) => {
        const sideStory = {
          id: edge.node.id,
          title: edge.node.title.userPreferred,
          type: "SIDE STORY",
        };
        results.push(sideStory);
      });

    for (const edge of mediaData.relations.edges) {
      if (fetchedIds.size >= 20) {
        break;
      }

      const { relationType, node } = edge;
      if (
        (relationType === "PREQUEL" ||
          relationType === "SEQUEL" ||
          relationType === "SIDE_STORY") &&
        !fetchedIds.has(node.id)
      ) {
        const relatedMediaData = await fetchMediaData(node.id, fetchedIds);
        relatedMediaData.forEach((data) => {
          if (!results.some((result) => result.id === data.id)) {
            results.push(data);
          }
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Error fetching media data:", error);
    throw error;
  }
}

async function getAnimeChainData(animeID, tmdbId) {
  try {
    let animeChainData;
    // Check if animeID already exists in the database
    let { data: existingAnime, error: existingAnimeError } = await supabase
      .from("anilist_anime_seasons")
      .select("id, tmdb_id")
      .eq("id", animeID)
      .single();

    if (existingAnimeError) {
      // If animeID does not exist, fetch data and upsert into database
      let fetchedAnimeData = await fetchMediaData(animeID);

      let { error: upsertError } = await supabase
        .from("anilist_anime_seasons")
        .upsert(fetchedAnimeData);

      if (upsertError) {
        console.error("Error upserting anime data:", upsertError);
        throw upsertError;
      }

      // Order the newly inserted data
      const { error: orderError } = await supabase.rpc(
        "update_anime_chain_order",
        {
          anime_id: animeID,
          t_tmdbid: tmdbId,
        }
      );

      if (orderError) {
        console.error("Error ordering anime chain:", orderError);
        throw orderError;
      }

      let { data: relatedAnimeData, error: relatedAnimeError } = await supabase
        .from("anilist_anime_seasons")
        .select("*")
        .eq("tmdb_id", tmdbId);

      if (relatedAnimeError) {
        console.error("Error fetching related anime data:", relatedAnimeError);
        throw relatedAnimeError;
      }

      animeChainData = relatedAnimeData;
      return animeChainData;
    }

    if (existingAnime) {
      // If animeID exists, find all rows with the same tmdb_id
      let { data: relatedAnimeData, error: relatedAnimeError } = await supabase
        .from("anilist_anime_seasons")
        .select("*")
        .eq("tmdb_id", existingAnime.tmdb_id);

      if (relatedAnimeError) {
        console.error("Error fetching related anime data:", relatedAnimeError);
        throw relatedAnimeError;
      }

      animeChainData = relatedAnimeData;
      return animeChainData;
    }
  } catch (error) {
    console.error("Error in getAnimeChainData:", error);
    throw error;
  }
}

app.get("/api/getanime/:id", async function (req, res) {
  const animeId = parseInt(req.params.id);

  const tvdbId = animeMapTVDBIdCache.find(
    (item) => item.anilist_id === animeId
  )?.thetvdb_id;
  if (!tvdbId) {
    return res.status(404).json({
      error: `No matching TheTVDB ID found for AniList ID: ${animeId}`,
    });
  }

  const response = await axios.get(
    `https://api.themoviedb.org/3/find/${tvdbId}?external_source=tvdb_id&api_key=${process.env.TMDB_API_KEY}`
  );
  const tmdbId = response.data.tv_results[0].id;

  const animeChainData = await getAnimeChainData(animeId, tmdbId);

  try {
    tmdbData = await axios.get(
      `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=season/1,season/2,season/3,season/4,season/5,season/6,season/7,season/8,season/9,season/10,season/11,season/12,season/13,season/14,season/15,season/16,season/17,season/18,images`
    );
    const backdrop_path = tmdbData.data.backdrop_path
      ? `https://image.tmdb.org/t/p/original${tmdbData.data.backdrop_path}`
      : null;
    let highestVotedLogo;
    if (tmdbData.data.images.logos.length > 0) {
      highestVotedLogo = tmdbData.data.images.logos.reduce((max, logo) => {
        if (
          logo.iso_639_1 === "en" &&
          (!max.iso_639_1 ||
            max.iso_639_1 !== "en" ||
            logo.vote_count > max.vote_count)
        ) {
          return logo;
        } else if (!max.iso_639_1 || max.iso_639_1 !== "en") {
          if (
            logo.iso_639_1 === "ja" &&
            (!max.iso_639_1 ||
              max.iso_639_1 !== "ja" ||
              logo.vote_count > max.vote_count)
          ) {
            return logo;
          } else if (!max.iso_639_1 || logo.vote_count > max.vote_count) {
            return logo;
          }
        }
        return max;
      }, tmdbData.data.images.logos[0]);
    }
    const logo = highestVotedLogo
      ? `https://image.tmdb.org/t/p/original${highestVotedLogo.file_path}`
      : null;

    const query = `
    query {
      Media(id: ${animeId}, type: ANIME) {
        id
        siteUrl
        title {
          romaji
          english
          native
          userPreferred
        }
        format
        status
        description(asHtml: false)
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        season
        seasonYear
        seasonInt
        episodes
        duration
        source(version: 2)
        hashtag
        coverImage {
          extraLarge
        }
        trailer {
          id
          site
          thumbnail
        }
        updatedAt
        genres
        averageScore
        meanScore
        popularity
        characters(sort: [ROLE, RELEVANCE, ID]) {
          edges {
            node {
              id
              name {
                full
                native
              }
              image {
                large
                medium
              }
              description(asHtml: false)
            }
            role
            voiceActors(language: JAPANESE) {
              id
              name {
                full
                native
              }
              image {
                large
                medium
              }
              languageV2
            }
          }
        }
        staff(sort: [RELEVANCE, ID]) {
          edges {
            node {
              id
              name {
                full
                native
              }
              image {
                large
                medium
              }
              description(asHtml: false)
            }
            role
          }
        }
        studios {
          edges {
            isMain
            node {
              id
              name
              siteUrl
            }
          }
        }
        nextAiringEpisode {
          airingAt
          timeUntilAiring
          episode
        }
        airingSchedule {
          edges {
            node {
              airingAt
              timeUntilAiring
              episode
            }
          }
        }
        externalLinks {
          id
          url
          site
        }
        streamingEpisodes {
          title
          thumbnail
          url
          site
        }
        recommendations (sort:RATING_DESC) {
          edges {
            node {
              mediaRecommendation {
                id
                averageScore
                title {
                  userPreferred
                }
                season
                popularity
                seasonYear
                type
                format
                status
                coverImage {
                  extraLarge
                }
              }
            }
          }
        }
      }
    }`;

    let mediaData;
    try {
      const response = await axios({
        url: ANILIST_API_URL,
        method: "post",
        data: {
          query: query,
        },
      });
      mediaData = response.data;
    } catch (error) {
      console.error("Error fetching media data with axios:", error);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error while fetching media data",
      });
    }

    mediaData = mediaData.data.Media;
    res.json({
      mediaData,
      backdrop_path,
      poster_path: mediaData.coverImage.extraLarge,
      genres: mediaData.genres,
      logo,
      original_name: mediaData.title.userPreferred,
      romaji: mediaData.title.romaji,
      english: mediaData.title.english,
      native: mediaData.title.native,
      runtime: mediaData.duration,
      status: mediaData.status,
      seasons: animeChainData.length,
      episodes: animeChainData.reduce(function (total, anime) {
        return total + (anime.episodes ? anime.episodes : 0);
      }, 0),
      credits: {
        crew: mediaData.staff.edges
          .filter(function (edge) {
            return [
              "Director",
              "Assistant Director",
              "Character Design",
              "Main Animator",
              "Art Design",
            ].includes(edge.role);
          })
          .map(function (edge) {
            return {
              role: edge.role,
              name: edge.node.name.full,
            };
          }),
        cast: mediaData.characters.edges.map(function (edge) {
          return {
            character: {
              characterId: edge.node.id,
              name: edge.node.name.full,
              image: edge.node.image.large,
              role: edge.role,
            },
            voiceActors: edge.voiceActors.map(function (va) {
              return {
                id: va.id,
                name: va.name.full,
                image: va.image.large,
                language: va.languageV2,
                role: edge.role,
              };
            }),
          };
        }),
      },
      recommendations: {
        results: mediaData.recommendations.edges.map(function (edge) {
          return {
            id: edge.node.mediaRecommendation.id,
            original_name: edge.node.mediaRecommendation.title.userPreferred,
            poster_path: edge.node.mediaRecommendation.coverImage.extraLarge,
            popularity: edge.node.mediaRecommendation.popularity,
            release_date: `${edge.node.mediaRecommendation.season} ${edge.node.mediaRecommendation.seasonYear}`,
            vote_average: edge.node.mediaRecommendation.averageScore / 10,
          };
        }),
      },
      producers: mediaData.studios.edges
        .filter(function (edge) {
          return edge.isMain === false;
        })
        .map(function (edge) {
          return edge.node.name;
        }),
      created_by: mediaData.staff.edges.find(
        (edge) =>
          edge.role === "Original Story" || edge.role === "Original Creator"
      )?.node.name.full,
      release_date: `${mediaData.season} ${mediaData.seasonYear}`,
      vote_average: mediaData.averageScore / 10,
      format: mediaData.format,
      networks: mediaData.studios.edges.find(function (edge) {
        return edge.isMain === true;
      }).node.name,
      overview: mediaData.description,
      hashtag: mediaData.hashtag,
      website: mediaData.siteUrl,
    });
  } catch (error) {
    console.error("Error in /api/getanime/:id", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/api/getanimebackdrops/:id", async function (req, res) {
  const animeId = req.params.id;

  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/tv/${animeId}/images?api_key=${process.env.TMDB_API_KEY}`
    );
    const backdrops = response.data.backdrops;

    if (backdrops) {
      return res.status(200).send(backdrops);
    }
  } catch (error) {
    console.error("Error in /api/getanimebackdrops/:id", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/api/getanimeepisodes/:id", async function (req, res) {
  const animeId = parseInt(req.params.id);

  const { data, error } = await supabase
    .from("anilist_anime_episodes")
    .select("*")
    .eq("anime_id", animeId);

  if (data.length > 0) {
    return res.status(200).json(data);
  }

  if (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }

  const { data: tmdbIdData } = await supabase
    .from("anilist_anime_seasons")
    .select("tmdb_id")
    .eq("id", animeId)
    .single();

  const tmdbId = tmdbIdData.tmdb_id;

  try {
    tmdbData = await axios.get(
      `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=season/1,season/2,season/3,season/4,season/5,season/6,season/7,season/8,season/9,season/10,season/11,season/12,season/13,season/14,season/15,season/16,season/17,season/18,season/19`
    );

    let mediaData;
    try {
      const mediaQuery = `
        query {
          Media(id: ${animeId}, type: ANIME) {
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
          }
        }`;

      const mediaResponse = await axios({
        url: ANILIST_API_URL,
        method: "post",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        data: JSON.stringify({ query: mediaQuery }),
      });

      mediaData = mediaResponse.data.data.Media;
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error", error });
    }

    const filteredEpisodes = [];
    for (let i = 1; i <= 19; i++) {
      if (
        tmdbData.data[`season/${i}`] &&
        tmdbData.data[`season/${i}`].episodes
      ) {
        tmdbData.data[`season/${i}`].episodes.forEach((episode) => {
          let airDate = new Date(episode.air_date);
          if (
            airDate >=
              new Date(
                mediaData.startDate.year,
                mediaData.startDate.month - 1,
                mediaData.startDate.day - 10
              ) &&
            airDate <=
              new Date(
                mediaData.endDate.year,
                mediaData.endDate.month - 1,
                mediaData.endDate.day + 10
              )
          ) {
            filteredEpisodes.push({
              id: episode.id,
              anime_id: animeId,
              air_date: episode.air_date,
              number: episode.episode_number,
              name: episode.name,
              overview: episode.overview,
              runtime: episode.runtime,
              still_path: episode.still_path
                ? `https://image.tmdb.org/t/p/original${episode.still_path}`
                : null,
            });
          }
        });
      }
    }

    res.json(filteredEpisodes);

    const { error } = await supabase
      .from("anilist_anime_episodes")
      .insert(filteredEpisodes);

    if (error) {
      console.error("Error inserting anime episodes:", error);
    }
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
