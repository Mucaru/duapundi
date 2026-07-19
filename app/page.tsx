import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomeClient } from "@/components/home-client";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id, name")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) redirect("/onboarding");

  return <HomeClient fallbackName={profile.name} />;
}
