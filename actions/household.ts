"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./auth";

export async function createHouseholdAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("household_name") ?? "").trim();
  if (!name) return { error: "Nama household wajib diisi." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", {
    household_name: name,
  });

  if (error) {
    if (error.message.includes("already_in_household")) {
      return { error: "Kamu sudah tergabung di sebuah household." };
    }
    return { error: "Gagal membuat household. Coba lagi." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function joinHouseholdAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const code = String(formData.get("invite_code") ?? "")
    .trim()
    .toLowerCase();
  if (!code) return { error: "Kode undangan wajib diisi." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_household_by_invite_code", {
    code,
  });

  if (error) {
    if (error.message.includes("invalid_invite_code")) {
      return { error: "Kode undangan tidak valid." };
    }
    if (error.message.includes("household_full")) {
      return { error: "Household ini sudah penuh (maksimal 2 anggota)." };
    }
    if (error.message.includes("already_in_household")) {
      return { error: "Kamu sudah tergabung di sebuah household." };
    }
    return { error: "Gagal join household. Coba lagi." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function leaveHouseholdAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_household");

  if (error) {
    return { error: "Gagal keluar dari household. Coba lagi." };
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

/** Dipanggil dari halaman Settings untuk menampilkan kode undangan ke user. */
export async function getHouseholdInviteInfo() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) return null;

  const { data: household } = await supabase
    .from("households")
    .select("id, name, invite_code")
    .eq("id", profile.household_id)
    .single();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("household_id", profile.household_id);

  return { household, members: members ?? [] };
}
