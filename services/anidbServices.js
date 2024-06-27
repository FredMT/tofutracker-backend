import axios from "axios";
import xml2js from "xml2js";
import supabase from "../supabaseClient.js";

async function fetchAnidbTrending() {
  const url = `http://api.anidb.net:9001/httpapi?client=${process.env.ANIDB_CLIENT_NAME}&clientver=${process.env.ANIDB_CLIENT_VERSION}&protover=1&request=hotanime`;
  const response = await axios.get(url);

  const formattedResult = await xml2js
    .parseStringPromise(response.data)
    .then((result) => {
      return result.hotanime.anime.map((anime) => ({
        id: anime.$.id,
      }));
    })
    .catch((err) => {
      console.error("Error parsing XML:", err);
      return [];
    });

  const animeData = await Promise.all(
    formattedResult.map(async (anime) => {
      const { data, error } = await supabase
        .from("anidb_anime")
        .select("*")
        .eq("id", anime.id)
        .single();

      if (error) {
        console.error("Error fetching anime data:", error);
        return null;
      }

      return data;
    })
  );

  return animeData.filter((anime) => anime !== null);
}

export { fetchAnidbTrending };
