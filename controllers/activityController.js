const supabase = require("../supabaseClient");
const axios = require("axios");

async function fetchPosters(id) {
  const { data: activityPrivacy, error: activityPrivacyError } = await supabase
    .from("profile")
    .select("activity_is_private")
    .eq("id", id)
    .maybeSingle();

  if (activityPrivacyError) {
    console.error("Error fetching data from Supabase:", activityPrivacyError);
    return { success: false, message: "Unable to access user settings" };
  }

  if (activityPrivacy.activity_is_private === true) {
    return { success: false, message: "Unauthorized" };
  }

  let posters = [];
  const { data: activityList, error } = await supabase
    .from("item_lists")
    .select("*")
    .eq("user_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching data from Supabase:", error);
    return { success: false, error };
  }

  const itemIds = activityList.map((item) => item.id);

  const { data: likesData, error: likesError } = await supabase
    .from("activity")
    .select("reference_id, likes")
    .in("reference_id", itemIds);

  if (likesError) {
    console.error("Error fetching likes data from Supabase:", likesError);
    return { success: false, error: likesError };
  }

  const likesMap = new Map(
    likesData.map((like) => [like.reference_id, like.likes])
  );

  for (const item of activityList) {
    const likes = likesMap.get(item.id) || 0;
    if (item.item_type === "anime") {
      const { data: animeData, error: animeError } = await supabase
        .from("anidb_anime")
        .select("*")
        .eq("id", item.item_id)
        .maybeSingle();

      if (animeError) {
        console.error("Error fetching data from Supabase:", animeError);
        return { success: false, error: animeError };
      }

      posters.push({
        item_id: item.item_id,
        item_created_at: item.created_at,
        item_type: "anime",
        item_poster: `https://tofutrackeranime2.b-cdn.net/posters/${animeData.poster}`,
        item_title: animeData.title,
        activity_id: item.id,
        likes,
      });
    } else {
      const url = `https://api.themoviedb.org/3/${item.item_type}/${item.item_id}?api_key=${process.env.TMDB_API_KEY}`;
      const response = await axios.get(url);
      const posterPath = `https://image.tmdb.org/t/p/original${response.data.poster_path}`;
      posters.push({
        item_id: item.item_id,
        item_created_at: item.created_at,
        item_type: item.item_type,
        item_poster: posterPath,
        item_title:
          item.item_type === "movie" ? response.data.title : response.data.name,
        activity_id: item.id,
        likes,
      });
    }
  }

  return { success: true, posters };
}

async function fetchPostersLoggedInUser(id, userId) {
  let posters = [];

  const { data: activityPrivacy, error: activityPrivacyError } = await supabase
    .from("profile")
    .select("activity_is_private, id")
    .eq("id", id)
    .maybeSingle();

  if (activityPrivacyError) {
    console.error("Error fetching data from Supabase:", activityPrivacyError);
    return { success: false, message: "Unable to access user settings" };
  }

  if (activityPrivacy.activity_is_private === true) {
    if (userId !== activityPrivacy.id) {
      return { success: false, message: "Unauthorized" };
    }
  }

  const { data: activityList, error } = await supabase
    .from("item_lists")
    .select("*")
    .eq("user_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching data from Supabase:", error);
    return { success: false, error };
  }

  const itemIds = activityList.map((item) => item.id);

  const { data: totalLikesData, error: totalLikesError } = await supabase
    .from("activity")
    .select("reference_id, likes")
    .in("reference_id", itemIds);

  if (totalLikesError) {
    console.error("Error fetching likes data from Supabase:", totalLikesError);
    return { success: false, error: totalLikesError };
  }

  const totalLikesMap = new Map(
    totalLikesData.map((like) => [like.reference_id, like.likes])
  );

  const { data: likesData, error: likesError } = await supabase
    .from("likes")
    .select("reference_id")
    .eq("user_id", userId);

  if (likesError) {
    console.error("Error fetching likes data from Supabase:", likesError);
    return { success: false, error: likesError };
  }

  const likedActivityIds = new Set(likesData.map((like) => like.reference_id));

  for (const item of activityList) {
    const likes = totalLikesMap.get(item.id) || 0;
    const hasLiked = likedActivityIds.has(item.id);
    if (item.item_type === "anime") {
      const { data: animeData, error: animeError } = await supabase
        .from("anidb_anime")
        .select("*")
        .eq("id", item.item_id)
        .maybeSingle();

      if (animeError) {
        console.error("Error fetching data from Supabase:", animeError);
        return { success: false, error: animeError };
      }

      posters.push({
        item_id: item.item_id,
        item_created_at: item.created_at,
        item_type: "anime",
        item_poster: `https://tofutrackeranime2.b-cdn.net/posters/${animeData.poster}`,
        item_title: animeData.title,
        activity_id: item.id,
        hasLiked: hasLiked,
        likes,
      });
    } else {
      const url = `https://api.themoviedb.org/3/${item.item_type}/${item.item_id}?api_key=${process.env.TMDB_API_KEY}`;
      const response = await axios.get(url);
      const posterPath = `https://image.tmdb.org/t/p/original${response.data.poster_path}`;
      posters.push({
        item_id: item.item_id,
        item_created_at: item.created_at,
        item_type: item.item_type,
        item_poster: posterPath,
        item_title:
          item.item_type === "movie" ? response.data.title : response.data.name,
        activity_id: item.id,
        hasLiked: hasLiked,
        likes,
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
      item_poster: `https://tofutrackeranime2.b-cdn.net/posters/${animeData.poster}`,
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

async function getNumOfLikes(id) {
  const { data: likes, error } = await supabase
    .from("activity")
    .select("likes")
    .eq("reference_id", id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching likes data from Supabase:", error);
    return { success: false, error };
  }

  return likes;
}

module.exports = {
  fetchPosters,
  getActivityItemData,
  fetchPostersLoggedInUser,
  getNumOfLikes,
};
