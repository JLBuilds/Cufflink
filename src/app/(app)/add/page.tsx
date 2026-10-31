import type { Metadata } from "next";
import { CaptureFlow } from "@/components/CaptureFlow";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { loadItems } from "@/lib/data";

export const metadata: Metadata = { title: "Add" };
export const maxDuration = 120;

export default async function AddPage() {
  const { supabase, user } = await requireUser();
  const rows = await loadItems(supabase, user.id);
  const items = rows.filter((r) => r.confirmed_by_user).map((r) => ({ id: r.id, name: r.name as string, category: r.category as string }));
  return (
    <>
      <PageHeader back="/wardrobe" title="Add to wardrobe" />
      <CaptureFlow mode="add" items={items} />
    </>
  );
}
