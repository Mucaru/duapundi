import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Dipakai di server components & server actions (actions/). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Dipanggil dari Server Component tanpa write access ke cookies —
            // aman diabaikan kalau ada middleware yang refresh session.
          }
        },
      },
    }
  );
}
