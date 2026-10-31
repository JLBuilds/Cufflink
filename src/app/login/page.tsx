import type { Metadata } from "next";
import { login } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex-1 flex flex-col justify-center px-6 py-16 max-w-sm mx-auto w-full">
      <p className="label">Personal style check</p>
      <h1 className="font-serif text-5xl mt-2 tracking-tight">Cufflink</h1>
      <div className="h-px bg-gold/60 my-8" />
      <form action={login} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="label">Email</span>
          <input name="email" type="email" autoComplete="email" required className="bg-card border border-line rounded-md px-3 py-3 text-base outline-none focus:border-cognac" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Password</span>
          <input name="password" type="password" autoComplete="current-password" required className="bg-card border border-line rounded-md px-3 py-3 text-base outline-none focus:border-cognac" />
        </label>
        {error && <p className="text-sm text-brick">{error}</p>}
        <button className="mt-2 bg-ink text-paper rounded-md py-3.5 font-medium tracking-wide">Sign in</button>
      </form>
    </main>
  );
}
