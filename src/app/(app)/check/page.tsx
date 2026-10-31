import type { Metadata } from "next";
import { CaptureFlow } from "@/components/CaptureFlow";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Check" };
// Extraction + judgement are two model calls; give them room.
export const maxDuration = 120;

export default function CheckPage() {
  return (
    <>
      <PageHeader back="/" title="Should I buy this?" />
      <CaptureFlow mode="check" />
    </>
  );
}
