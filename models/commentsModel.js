const supabase = require("../supabaseClient");

async function getComments(id, userId) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("activity_id", id);

  if (error) {
    console.error("Error fetching data from Supabase:", error);
    return;
  }

  const { data: hasLiked, error: hasLikedError } = await supabase
    .from("likes")
    .select("*")
    .eq("user_id", userId)
    .eq("reference_id", id);

  if (hasLikedError) {
    console.error("Error fetching likes data from Supabase:", hasLikedError);
    return;
  }

  // Fetch usernames separately and append to each comment
  const enhancedData = await Promise.all(
    data.map(async (comment) => {
      const { data: profileData, error: profileError } = await supabase
        .from("profile")
        .select("username")
        .eq("id", comment.user_id)
        .single();

      if (profileError) {
        console.error(
          "Error fetching profile data from Supabase:",
          profileError
        );
        return { ...comment, username: null };
      }

      return {
        ...comment,
        username: profileData.username,
        hasLiked: Boolean(
          hasLiked.filter((like) => like.activity_id === comment.id).length
        ),
      };
    })
  );

  return enhancedData;
}

module.exports = { getComments };
