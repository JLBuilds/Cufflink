import { requireUser } from "@/lib/auth";
import { BottomNav } from "./BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <div className="flex-1 w-full max-w-lg mx-auto pb-28">{children}</div>
      <BottomNav />
    </>
  );
}
