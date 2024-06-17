import { createClient } from "@supabase/supabase-js";

// Create and export the Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default supabase;
