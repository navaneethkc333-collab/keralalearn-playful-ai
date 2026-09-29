import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, TOPICS } from "@/lib/syllabus";
import { useProfile, useAttempts, levelFromPoints } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "My Dashboard — Vidya Kalari" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: p } = useProfile();
  const { data: attempts = [] } = useAttempts();
  const qc = useQueryClient();
  const setLang = useMutation({
    mutationFn: async (language: string) => {
      if (!p) return;
      const { error } = await supabase.from("profiles").update({ language }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
  if (!p) return <p className="text-muted-foreground">Loading…</p>;
  const ml = p.language === "ml";
  const topics = TOPICS[p.class_level];
  const level = levelFromPoints(p.points);

  // Suggest the weakest topic
  const byTopic = new Map<string, { s: number; t: number; subject: string }>();
  attempts.forEach((a) => {
    const k = a.topic;
    const v = byTopic.get(k) ?? { s: 0, t: 0, subject: a.subject };
    v.s += a.score;
    v.t += a.total;
    byTopic.set(k, v);
  });
  const weak = [...byTopic.entries()].filter(([, v]) => v.s / v.t < 0.6).sort((a, b) => a[1].s / a[1].t - b[1].s / b[1].t)[0];

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl bg-primary p-6 text-primary-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-5xl">🧒</div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{ml ? "നമസ്കാരം" : "Hello"}, {p.full_name || p.username}!</h1>
            <p className="opacity-90">Class {p.class_level} · Level {level} · {p.points} stars</p>
            <Progress value={p.points % 100} className="mt-2 h-3 bg-primary-foreground/30" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={ml ? "secondary" : "outline"} className="text-foreground" onClick={() => setLang.mutate("en")}>English</Button>
            <Button size="sm" variant={ml ? "outline" : "secondary"} className="text-foreground" onClick={() => setLang.mutate("ml")}>മലയാളം</Button>
          </div>
        </div>
      </Card>

      {weak && (
        <Card className="rounded-3xl border-2 border-accent p-5">
          <p className="font-semibold">🎯 {ml ? "ഇത് വീണ്ടും പരിശീലിക്കാം" : "Let's practise this again"}:</p>
          <Link to="/learn/$subject/$topic" params={{ subject: weak[1].subject, topic: weak[0] }} className="text-lg font-bold text-primary underline">
            {weak[0]}
          </Link>
        </Card>
      )}

      <h2 className="text-2xl font-bold">{ml ? "വിഷയങ്ങൾ" : "Choose a subject"}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUBJECTS.map((s) => {
          const list = topics[s.id];
          const done = list.filter((t) => attempts.some((a) => a.topic === t && a.score / a.total >= 0.6)).length;
          return (
            <Link key={s.id} to="/learn/$subject" params={{ subject: s.id }}>
              <Card className={`${s.color} h-full rounded-3xl border-0 p-6 transition-transform hover:-translate-y-1`}>
                <div className="text-5xl">{s.emoji}</div>
                <div className="mt-3 font-display text-xl font-semibold">{ml ? s.ml : s.name}</div>
                <div className="mt-1 text-sm">{done}/{list.length} topics mastered</div>
                <Progress value={(done / list.length) * 100} className="mt-2 h-2 bg-card/60" />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
