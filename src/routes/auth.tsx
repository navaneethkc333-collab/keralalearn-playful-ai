import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => z.object({ mode: z.enum(["login", "signup"]).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Student Login — Vidya Kalari" },
      { name: "description", content: "Log in or create your student account." },
      { property: "og:title", content: "Student Login — Vidya Kalari" },
      { property: "og:description", content: "Log in or create your student account." },
    ],
  }),
  component: AuthPage,
});

const toEmail = (u: string) => `${u.trim().toLowerCase()}@students.vidyakalari.app`;

function AuthPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "login");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", username: "", password: "", classLevel: 1, language: "en" });
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const username = f.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { toast.error("Username: 3–20 letters, numbers or _"); return; }
    if (f.password.length < 6) { toast.error("Password needs at least 6 characters"); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!f.name.trim()) throw new Error("Please enter your name");
        const { error } = await supabase.auth.signUp({
          email: toEmail(username),
          password: f.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: f.name.trim(), username, class_level: f.classLevel, language: f.language },
          },
        });
        if (error) throw new Error(error.message.includes("registered") ? "That username is taken" : error.message);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password: f.password });
        if (error) throw new Error("Wrong username or password");
      }
      navigate({ to: "/learning" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md rounded-3xl p-8">
        <div className="text-center text-4xl">🐘</div>
        <h1 className="mt-2 text-center text-3xl font-bold">{mode === "login" ? "Welcome back!" : "Join Vidya Kalari"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input id="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
          )}
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          </div>
          {mode === "signup" && (
            <>
              <div>
                <Label>Class</Label>
                <div className="mt-1 grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((c) => (
                    <Button key={c} type="button" variant={f.classLevel === c ? "default" : "outline"} onClick={() => setF({ ...f, classLevel: c })}>
                      {c}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Language</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Button type="button" variant={f.language === "en" ? "default" : "outline"} onClick={() => setF({ ...f, language: "en" })}>English</Button>
                  <Button type="button" variant={f.language === "ml" ? "default" : "outline"} onClick={() => setF({ ...f, language: "ml" })}>മലയാളം</Button>
                </div>
              </div>
            </>
          )}
          <Button type="submit" size="lg" className="w-full rounded-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </Button>
        </form>
        <button className="mt-4 w-full text-sm font-semibold text-primary" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
      </Card>
    </div>
  );
}
