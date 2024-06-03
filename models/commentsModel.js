const supabase = require("../supabaseClient");

async function getComments(id) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("activity_id", id);

  if (error) {
    console.error("Error fetching data from Supabase:", error);
    return;
  }

  // Fetch usernames separately and append to each comment
  const enhancedData = await Promise.all(
    data.map(async (comment) => {
      const { data: profileData, error: profileError } = await supabase
        .from("profile")
        .select("username")
        .eq("id", comment.user_id)
        .single(); // Assuming user_id is unique and returns a single profile

      if (profileError) {
        console.error(
          "Error fetching profile data from Supabase:",
          profileError
        );
        return { ...comment, username: null }; // Return comment with null username on error
      }

      return { ...comment, username: profileData.username };
    })
  );

  return enhancedData;
}

module.exports = { getComments };
