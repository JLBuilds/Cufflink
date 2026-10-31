import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Server-side: the signed-in user and an RLS-scoped client, or /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
