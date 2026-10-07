import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Settings — Vidya Kalari" },
    { name: "description", content: "Change your class and learning language in Vidya Kalari." },
    { property: "og:title", content: "Settings — Vidya Kalari" },
    { property: "og:description", content: "Change your class and learning language in Vidya Kalari." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Settings,
});

function Settings() {
  const { data: p } = useProfile();
  const qc = useQueryClient();
  const [classLevel, setClassLevel] = useState(1);
  const [language, setLanguage] = useState<"en" | "ml">("en");
  useEffect(() => { if (p) { setClassLevel(p.class_level); setLanguage(p.language === "ml" ? "ml" : "en"); } }, [p]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ class_level: classLevel, language }).eq("id", p!.id);
      if (error) throw error;
      await qc.invalidateQueries();
    },
    onSuccess: () => toast.success("Settings saved!"),
    onError: (e) => toast.error((e as Error).message),
  });
  if (!p) return <p className="text-muted-foreground">Loading…</p>;
  const changed = classLevel !== p.class_level || language !== p.language;
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-3xl font-bold">⚙️ Settings</h1>
      <Card className="space-y-3 rounded-3xl p-6">
        <h2 className="text-xl font-bold">My class</h2>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((c) => (
            <Button key={c} size="lg" variant={classLevel === c ? "default" : "outline"} aria-pressed={classLevel === c} className="rounded-2xl text-lg" onClick={() => setClassLevel(c)}>Class {c}</Button>
          ))}
        </div>
      </Card>
      <Card className="space-y-3 rounded-3xl p-6">
        <h2 className="text-xl font-bold">Language</h2>
        <div className="grid grid-cols-2 gap-2">
          {([["en", "English"], ["ml", "മലയാളം"]] as const).map(([v, label]) => (
            <Button key={v} size="lg" variant={language === v ? "default" : "outline"} aria-pressed={language === v} className="rounded-2xl text-lg" onClick={() => setLanguage(v)}>{label}</Button>
          ))}
        </div>
      </Card>
      <Button size="lg" className="w-full rounded-full" disabled={!changed || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
