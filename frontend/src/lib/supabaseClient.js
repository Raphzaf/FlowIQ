import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const getJwtRole = (token) => {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload)?.role || null;
  } catch {
    return null;
  }
};

const jwtRole = getJwtRole(supabaseAnonKey);

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? "Missing Supabase environment variables."
  : jwtRole === "service_role"
    ? "REACT_APP_SUPABASE_ANON_KEY is using a service_role key. Use the public anon or publishable key in frontend env."
    : "";

export const hasSupabaseEnv = !supabaseConfigError;

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
