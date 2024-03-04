const supabase = require("../supabaseClient");
const cron = require("node-cron");
const { fetchTrendingFromAPIS } = require("../controllers/trendingController");

cron.schedule("42 13 * * *", async () => {
  console.log(
    "Running cron job every day at 13:42 to fetch and update trending items"
  );
  const data = await fetchTrendingFromAPIS();

  const { error } = await supabase.from("trending").update([data]).eq("id", 1);

  if (error) {
    console.error("Supabase error:", error);
    throw new Error(error.message);
  }

  console.log("Cron job done");
});
