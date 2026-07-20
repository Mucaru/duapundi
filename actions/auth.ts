"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error: string | null;
}

/**
 * Aturan logging: JANGAN pernah console.log(error) mentah-mentah di sini
 * kalau error object bisa membawa data user (email, dst) yang ke-tangkap
 * error tracking (Sentry, dsb). Selalu return pesan yang sudah difilter.
 */
export async function signUp(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !password || !name) {
    return { error: "Semua field wajib diisi." };
  }
  if (password.length < 8) {
    return { error: "Password minimal 8 karakter." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    if (error.code === "over_email_send_rate_limit" || error.message.includes("rate limit")) {
      return {
        error:
          "Terlalu banyak percobaan daftar dalam waktu singkat (limit email bawaan Supabase). Tunggu beberapa menit, atau matikan 'Confirm email' sementara di Supabase Auth settings untuk testing.",
      };
    }
    if (error.code === "user_already_exists" || error.message.includes("already registered")) {
      return { error: "Email ini sudah terdaftar. Coba menu Masuk." };
    }
    if (error.code === "weak_password" || error.message.includes("Password")) {
      return { error: "Password terlalu lemah. Coba kombinasi yang lebih unik." };
    }
    return { error: `Gagal daftar: ${error.message}` };
  }

  redirect("/onboarding");
}

export async function signIn(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Email atau password salah." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
