import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import type { GarmentAttributes } from "@/lib/style/types";
import { FixForm } from "./FixForm";

export const metadata: Metadata = { title: "Fix details" };
export const maxDuration = 120;

export default async function FixPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: ev } = await supabase.from("evaluations").select("attributes").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!ev) notFound();
  return (
    <>
      <PageHeader back={`/verdict/${id}`} title="What did it misread?" />
      <p className="px-5 -mt-2 mb-5 text-sm text-muted">Correct anything wrong (fabric and length are the usual culprits), then it judges again.</p>
      <FixForm evalId={id} initial={ev.attributes as GarmentAttributes} />
    </>
  );
}
