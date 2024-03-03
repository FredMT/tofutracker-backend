const supabase = require("../supabaseClient");
const cron = require("node-cron");

cron.schedule("*/45 16 4 * * *", () => {
  console.log("cron");
});
