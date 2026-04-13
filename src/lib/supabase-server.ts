import { createClient } from "@supabase/supabase-js";

function maybeRelaxTlsForLocalSupabase() {
  const allowInsecureTls = process.env.SUPABASE_ALLOW_INSECURE_TLS === "true";

  // Local Supabase access in this environment fails certificate validation.
  // Keep it opt-in and dev-only so production behavior stays strict.
  if (allowInsecureTls && process.env.NODE_ENV !== "production") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";
  }
}

export function createSupabaseServerClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    return null;
  }

  maybeRelaxTlsForLocalSupabase();

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
