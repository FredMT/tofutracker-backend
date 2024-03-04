const axios = require("axios");
const xml2js = require("xml2js");

async function fetchAnidbTrending() {
  const url = `http://api.anidb.net:9001/httpapi?client=${process.env.ANIDB_CLIENT_NAME}&clientver=${process.env.ANIDB_CLIENT_VERSION}&protover=1&request=hotanime`;
  const response = await axios.get(url);

  const formattedResult = await new Promise((resolve, reject) => {
    xml2js.parseString(response.data, (err, result) => {
      if (err) {
        reject(err);
      } else {
        const formattedResult = result.hotanime.anime.map((anime) => ({
          id: anime.$.id,
          title: anime.title[0]._,
          rating: anime.ratings[0]?.permanent[0]
            ? anime.ratings[0].permanent[0]._
            : null,
          start_date: anime.startdate ? anime.startdate[0] : null,
          end_date: anime.enddate ? anime.enddate[0] : null,
          poster_path: anime.picture[0],
          media_type: "anime",
        }));
        resolve(formattedResult);
      }
    });
  });

  return formattedResult;
}

module.exports = { fetchAnidbTrending };
