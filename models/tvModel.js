import supabase from "../supabaseClient.js";

async function fetchTVDataFromSupabase(id) {
  let { data, error } = await supabase
    .from("tmdb_tv_json")
    .select("tv_data")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code !== "PGRST116") console.log(error);
    return null;
  }

  return data.tv_data;
}

async function insertTVDataIntoSupabase(id, tvData) {
  const { error } = await supabase
    .from("tmdb_tv_json")
    .insert([{ id, tv_data: tvData }]);
  if (error) {
    console.error(`Error inserting TV show details into database: ${error}`);
  }
}

async function fetchSeasonDataFromDB(id, season_number) {
  let { data: seasonData, error: seasonDataError } = await supabase
    .from("tmdb_tv_seasons_json")
    .select("json")
    .eq("tv_id", id)
    .eq("season_number", season_number)
    .single();

  return { seasonData, seasonDataError };
}

async function insertSeasonDataIntoDB(id, season_number, seasonData) {
  const { error } = await supabase
    .from("tmdb_tv_seasons_json")
    .insert([
      { id: seasonData._id, tv_id: id, season_number, json: seasonData },
    ]);
  if (error) {
    console.log(
      `Error inserting TV show season details into database: ${error}`
    );
    throw new Error(error.message);
  }
}

export {
  fetchTVDataFromSupabase,
  insertTVDataIntoSupabase,
  fetchSeasonDataFromDB,
  insertSeasonDataIntoDB,
};
