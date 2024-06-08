const supabase = require("../supabaseClient");

async function getAnime(id) {
  const { data, error } = await supabase.rpc("get_anime_data", {
    anime_id_param: id,
  });

  if (error) {
    console.log(error);
    return;
  }

  return data;
}

async function getRelatedAnimeInfo(id) {
  const { data, error } = await supabase.rpc(
    "get_anime_relations_and_details",
    {
      anime_id: id,
    }
  );

  if (error && error.code !== "PGRST116") {
    console.error("Error querying anidb_anime:", error.message);
    return {
      sucess: false,
      status: 500,
      message: "Error querying anidb_anime.",
    };
  }

  return { success: true, data: data };
}

async function getAnimeChain(id) {
  const { data, error } = await supabase.rpc("get_complete_anime_chain", {
    start_id: id,
  });

  if (error) {
    console.log(error);
    return;
  }

  return data;
}

async function checkIfAnime(id) {
  const { data, error } = await supabase
    .from("anidb_tvdb_tmdb_mapping")
    .select("anidb_id")
    .eq("tvdb_id", id);

  if (error && error.code !== "PGRST116") {
    console.error("Error querying anidb_tvdb_tmdb_mapping:", error.message);
    return { status: 500, message: "Error querying anidb_tvdb_tmdb_mapping." };
  }

  if (data.length > 0) {
    return { status: true, message: "This is an anime.", data: data[0] };
  }
  return false;
}

async function getMapping(id) {
  const { data, error } = await supabase
    .from("anidb_tvdb_tmdb_mapping")
    .select("*")
    .eq("anidb_id", id);

  if (error && error.code !== "PGRST116") {
    console.error("Error querying anidb_tvdb_tmdb_mapping:", error.message);
    return { status: 500, message: "Error querying anidb_tvdb_tmdb_mapping." };
  }

  if (data.length > 0) {
    return data[0];
  }
}

async function getRelations(id) {
  const { data, error } = await supabase
    .from("anidb_relations")
    .select("anime_id, related_id, type")
    .eq("anime_id", id);

  if (error && error.code !== "PGRST116") {
    return { status: 500, message: "Error querying anidb_relations." };
  }

  return data;
}

async function getSimilarAnimeDetails(id) {
  const { data, error } = await supabase
    .from("anidb_anime")
    .select("id, title, rating, start_date, poster")
    .eq("id", id);

  if (error && error.code !== "PGRST116") {
    return { status: 500, message: "Error querying anidb_anime." };
  }

  return data[0];
}

async function getMultipleSimilarAnimeDetails(ids) {
  const { data, error } = await supabase
    .from("anidb_anime")
    .select("id, title, rating, start_date, poster, type")
    .in("id", ids);

  if (error && error.code !== "PGRST116") {
    return {
      status: 500,
      message: "Error querying multiple similar anime details.",
    };
  }

  data.sort((a, b) => b.rating - a.rating);
  const topRated = data.slice(0, 20);
  return topRated;
}

async function getAnidbIDFromTMDBId(id) {
  const { data, error } = await supabase
    .from("anidb_tvdb_tmdb_mapping")
    .select("anidb_id")
    .eq("tmdb_id", id);

  if (error && error.code !== "PGRST116") {
    return {
      success: false,
      message: "Error querying anidb_tvdb_tmdb_mapping.",
    };
  }

  if (data.length > 0) {
    return { success: true, anidb_id: data[0].anidb_id };
  }
}

async function getAnidbIDFromTVDBId(id) {
  const { data, error } = await supabase
    .from("anidb_tvdb_tmdb_mapping")
    .select("anidb_id")
    .eq("tvdb_id", id);

  if (error && error.code !== "PGRST116") {
    return {
      success: false,
      message: "Error querying anidb_tvdb_tmdb_mapping.",
    };
  }

  if (data.length > 0) {
    return { success: true, anidb_id: data[0].anidb_id };
  }
}

module.exports = {
  getAnime,
  getAnimeChain,
  checkIfAnime,
  getMapping,
  getRelations,
  getRelatedAnimeInfo,
  getSimilarAnimeDetails,
  getMultipleSimilarAnimeDetails,
  getAnidbIDFromTMDBId,
  getAnidbIDFromTVDBId,
};
