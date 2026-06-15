import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const supabaseUrl = "https://aawpwpexjpendjutqqzq.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhd3B3cGV4anBlbmRqdXRxcXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTQ0MjgsImV4cCI6MjA5NzA3MDQyOH0.ZsjD3eY9qlSJqym1E394hQie1fDix7kXLwk1b7SF6Os";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
