const fs = require("fs");

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

module.exports = {
  checkForAnime,
  animeListCache,
};
