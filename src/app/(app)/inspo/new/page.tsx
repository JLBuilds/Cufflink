import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { InspoForm } from "./InspoForm";

export const metadata: Metadata = { title: "Inspo" };
export const maxDuration = 120;

export default function NewInspoPage() {
  return (
    <>
      <PageHeader back="/inspo" title="What's missing?" />
      <InspoForm />
    </>
  );
}
