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

module.exports = { getAnime, getAnimeChain };
