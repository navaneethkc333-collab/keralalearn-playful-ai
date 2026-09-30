import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useSkills } from "@/hooks/useProfile";
import { ACTIVITIES } from "@/lib/skills";

export const Route = createFileRoute("/_authenticated/skills/")({
  head: () => ({ meta: [{ title: "Skill Development — Vidya Kalari" }] }),
  component: Skills,
});

function Skills() {
  const { data: results = [] } = useSkills();
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">🎨 Skill Development</h1>
      <p className="text-muted-foreground">Pick an activity. Your AI teacher will give you a task and check your work.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIVITIES.map((a) => {
          const mine = results.filter((r) => r.activity === a.id);
          const best = mine.reduce((m, r) => Math.max(m, r.score), 0);
          return (
            <Link key={a.id} to="/skills/$activity" params={{ activity: a.id }}>
              <Card className={`${a.color} h-full rounded-3xl border-0 p-6 transition-transform hover:-translate-y-1`}>
                <div className="text-5xl">{a.emoji}</div>
                <div className="mt-3 font-display text-xl font-semibold">{a.name}</div>
                <p className="text-sm">{a.desc}</p>
                <p className="mt-2 text-sm font-bold">{mine.length ? `Done ${mine.length}× · Best ${best}` : "Not tried yet"}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
