import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { WearFlow } from "./WearFlow";

export const metadata: Metadata = { title: "Can I wear this?" };
export const maxDuration = 120;

export default function WearPage() {
  return (
    <>
      <PageHeader back="/" title="Can I wear this?" />
      <WearFlow />
    </>
  );
}
