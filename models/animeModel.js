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
    throw new Error("Internal server error.");
  }

  if (data.length > 0) {
    return true;
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
    throw new Error("Internal server error.");
  }

  if (data.length > 0) {
    return data[0];
  }
}

module.exports = { getAnime, getAnimeChain, checkIfAnime, getMapping };
