"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Ported from Groove. Single user: no public sign-up; the account is
// created in the Supabase dashboard.
export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
