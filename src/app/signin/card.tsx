import type { ReactNode } from "react";
import { Wordmark, Label } from "@/components/ui";
import { site } from "@/lib/site";

// Shared frame for the sign-in flow's screens (form, sent, errors).
export function SignInCard({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="bg-card border-line w-full max-w-md rounded-2xl border p-8 shadow-[0_14px_34px_rgba(0,0,0,0.08)] sm:p-10">
        <Wordmark size={22} />
        <Label>{site.org}</Label>
        {children}
      </div>
    </main>
  );
}
