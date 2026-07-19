import { createBrowserClient } from "@supabase/ssr";

/**
 * Dipakai di client components. JANGAN log hasil query di sini ke
 * console dalam production build — bisa kebawa ke error tracking dan
 * mem-bocorkan data transaksi. Lihat lib/supabase/README untuk aturan
 * logging.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
