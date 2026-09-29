import { createFileRoute, Link } from "@tanstack/react-router";
import { subjectById, TOPICS, type SubjectId } from "@/lib/syllabus";
import { useProfile, useAttempts } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/learn/$subject/")({
  head: () => ({ meta: [{ title: "Topics — Vidya Kalari" }] }),
  component: SubjectPage,
});

function SubjectPage() {
  const { subject } = Route.useParams();
  const s = subjectById(subject);
  const { data: p } = useProfile();
  const { data: attempts = [] } = useAttempts();
  if (!s) return <p>Subject not found.</p>;
  if (!p) return <p className="text-muted-foreground">Loading…</p>;
  const list = TOPICS[p.class_level]?.[s.id as SubjectId] ?? [];
  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="text-sm font-semibold text-primary">← Back</Link>
      <h1 className="text-3xl font-bold">{s.emoji} {p.language === "ml" ? s.ml : s.name} · Class {p.class_level}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((t, i) => {
          const tries = attempts.filter((a) => a.topic === t);
          const best = tries.reduce((m, a) => Math.max(m, Math.round((a.score / a.total) * 100)), 0);
          return (
            <Link key={t} to="/learn/$subject/$topic" params={{ subject: s.id, topic: t }}>
              <Card className="flex items-center gap-4 rounded-2xl p-5 transition-colors hover:bg-secondary">
                <div className={`${s.color} flex h-12 w-12 items-center justify-center rounded-full font-display text-xl font-bold`}>{i + 1}</div>
                <div className="flex-1">
                  <div className="font-semibold">{t}</div>
                  <div className="text-sm text-muted-foreground">{tries.length ? `Best score ${best}%` : "Not started"}</div>
                </div>
                <div className="text-2xl">{best >= 80 ? "🏆" : best >= 60 ? "⭐" : "▶️"}</div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
