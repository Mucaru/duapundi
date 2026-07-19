import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";

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

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="font-display text-2xl font-semibold text-ink">
        Halo, {profile.name} 👋
      </p>
      <p className="text-sm text-ink-muted">
        Household kamu sudah siap. Bagian catat transaksi menyusul di tahap
        berikutnya.
      </p>
      <form action={signOut}>
        <Button variant="outline" type="submit">
          Keluar
        </Button>
      </form>
    </main>
  );
}
