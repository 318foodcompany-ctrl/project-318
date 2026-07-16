const SUPABASE_URL = "https://qanetxmyoxpqnwsntmqz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbmV0eG15b3hwcW53c250bXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMzE5MDcsImV4cCI6MjA5OTcwNzkwN30.ichlxuWHLzMfImAEEs-kWZ2Rle-5R09xTKSLR6hEC0A";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
