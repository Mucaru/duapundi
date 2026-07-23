import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh session token di tiap request. Tanpa ini, session bisa expired
 * diam-diam dan user tiba-tiba "logout" tanpa alasan jelas — krusial
 * untuk app yang sering dibuka lalu ditinggal (offline-first usage
 * pattern: buka app, input transaksi, tutup lagi).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Wajib dipanggil supaya token ke-refresh — jangan hapus baris ini
  // walau nilainya sepertinya tidak dipakai langsung.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Kalau refresh token-nya invalid (misal: cookie session lama nyangkut
  // dari testing sebelumnya, atau project Supabase pernah di-reset),
  // Supabase SDK bakal retry beberapa kali dengan backoff sebelum nyerah
  // — ini penyebab loading super lambat (puluhan detik) yang kejadian.
  // Begitu ketauan, langsung clear cookie session-nya supaya request
  // berikutnya gak ngulang retry pakai token yang sama-sama rusak.
  if (error?.code === "refresh_token_not_found" || error?.status === 400) {
    await supabase.auth.signOut();
  }

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const isPublicAsset =
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/manifest") ||
    request.nextUrl.pathname.startsWith("/icons") ||
    request.nextUrl.pathname.startsWith("/sw.js");

  if ((!user || error) && !isAuthRoute && !isPublicAsset) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !error && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
