const supabase = require("../supabaseClient");

async function getCommentsLoggedInUser(id, userId) {
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

      const {
        data: { likes },
        error: likesError,
      } = await supabase
        .from("activity")
        .select("likes")
        .eq("reference_id", comment.id)
        .maybeSingle();

      if (likesError) {
        console.error(
          "Error fetching total comment likes data from Supabase:",
          likesError
        );
        return { ...comment, username: profileData.username, likes: 0 };
      }

      return {
        ...comment,
        username: profileData.username,
        hasLiked: Boolean(
          hasLiked.filter((like) => like.activity_id === comment.id).length
        ),
        likes,
      };
    })
  );

  return enhancedData;
}

async function getComments(id) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("activity_id", id);

  if (error) {
    console.error("Error fetching comments from Supabase:", error);
    return { ok: false, data: null };
  }

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

      const {
        data: { likes },
        error: likesError,
      } = await supabase
        .from("activity")
        .select("likes")
        .eq("reference_id", comment.id)
        .maybeSingle();

      if (likesError) {
        console.error(
          "Error fetching total comment likes data from Supabase:",
          likesError
        );
        return { ...comment, username: profileData.username, likes: 0 };
      }

      return {
        ...comment,
        username: profileData.username,
        likes,
      };
    })
  );

  return enhancedData;
}

module.exports = { getCommentsLoggedInUser, getComments };
