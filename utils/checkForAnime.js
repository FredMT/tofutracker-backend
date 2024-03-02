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

module.exports = {
  animeListCache,
};
