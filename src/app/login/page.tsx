"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export default function LoginPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createBrowserSupabaseClient>>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSupabase(createBrowserSupabaseClient());
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setStatus("error");
      setErrorMessage("Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setStatus("error");
      setErrorMessage("Enter a valid email and a password (8+ characters).");
      return;
    }

    setStatus("loading");
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("idle");
    router.push("/app");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md items-center px-4">
      <Card>
        <h1 className="text-xl font-semibold">VA Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">Sign in to manage tenants, cycles, and deliverables.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <TextField label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
          <TextField label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
          {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
          <Button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
