const supabase = require("../supabaseClient");
const axios = require("axios");

async function fetchPosters(id) {
  let posters = [];
  const { data: activityList, error } = await supabase
    .from("item_lists")
    .select("*")
    .eq("user_id", id);

  if (error) {
    console.error("Error fetching data from Supabase:", error);
    return { success: false, error };
  }

  for (const item of activityList) {
    if (item.item_type === "anime") {
      const { data: animeData, error: animeError } = await supabase
        .from("anidb_anime")
        .select("*")
        .eq("id", item.item_id)
        .maybeSingle();

      posters.push({
        item_id: item.item_id,
        item_type: "anime",
        item_poster: `https://cdn.anidb.net/images/main/${animeData.poster}`,
        item_title: animeData.title,
        activity_id: item.id,
      });
    } else {
      const url = `https://api.themoviedb.org/3/${item.item_type}/${item.item_id}?api_key=${process.env.TMDB_API_KEY}`;
      const response = await axios.get(url);
      const posterPath = `https://image.tmdb.org/t/p/original${response.data.poster_path}`;
      posters.push({
        item_id: item.item_id,
        item_type: item.item_type,
        item_poster: posterPath,
        item_title:
          item.item_type === "movie" ? response.data.title : response.data.name,
        activity_id: item.id,
      });
    }
  }

  return { success: true, posters };
}

async function getActivityItemData(id) {
  const { data: activityItem, error } = await supabase
    .from("item_lists")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching data from Supabase:", error);
    return { ok: false, error };
  }

  if (activityItem.item_type === "anime") {
    const { data: animeData, error: animeError } = await supabase
      .from("anidb_anime")
      .select("*")
      .eq("id", activityItem.item_id)
      .maybeSingle();

    if (animeError) {
      console.error("Error fetching data from Supabase:", animeError);
      return { ok: false, animeError };
    }

    const activityItemData = {
      item_type: activityItem.item_type,
      item_id: activityItem.item_id,
      item_poster: `https://cdn.anidb.net/images/main/${animeData.poster}`,
      item_title: animeData.title,
    };

    return { ok: true, data: activityItemData };
  } else {
    try {
      const url = `https://api.themoviedb.org/3/${activityItem.item_type}/${activityItem.item_id}?api_key=${process.env.TMDB_API_KEY}`;
      const response = await axios.get(url);

      if (error) {
        console.error("Error fetching data from TMDB:", error);
        return { ok: false, error };
      }

      const activityItemData = {
        item_type: activityItem.item_type,
        item_id: activityItem.item_id,
        item_poster: `https://image.tmdb.org/t/p/original${response.data.poster_path}`,
        item_title:
          activityItem.item_type === "movie"
            ? response.data.title
            : response.data.name,
      };

      return { ok: true, data: activityItemData };
    } catch (error) {
      console.error("Error fetching data from TMDB:", error);
      return { ok: false, error };
    }
  }
}

module.exports = { fetchPosters, getActivityItemData };
