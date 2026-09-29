import { createFileRoute } from "@tanstack/react-router";
import { SUBJECTS } from "@/lib/syllabus";
import { useAttempts, useProfile, levelFromPoints } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "My Progress — Vidya Kalari" }] }),
  component: ProgressPage,
});

const BADGES = [
  { id: "first", label: "First Quiz", emoji: "🌱", test: (n: number) => n >= 1 },
  { id: "ten", label: "10 Quizzes", emoji: "🌳", test: (n: number) => n >= 10 },
];

function ProgressPage() {
  const { data: p } = useProfile();
  const { data: attempts = [] } = useAttempts();
  if (!p) return <p className="text-muted-foreground">Loading…</p>;
  const perfect = attempts.some((a) => a.score === a.total);
  const badges = [
    ...BADGES.filter((b) => b.test(attempts.length)),
    ...(perfect ? [{ id: "perfect", label: "Perfect Score", emoji: "🏆" }] : []),
    ...(p.streak >= 3 ? [{ id: "streak", label: "3-Day Streak", emoji: "🔥" }] : []),
    ...(p.points >= 500 ? [{ id: "star", label: "Star Learner", emoji: "🌟" }] : []),
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Progress</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[["⭐", "Stars", p.points], ["🎖️", "Level", levelFromPoints(p.points)], ["🔥", "Day streak", p.streak], ["📝", "Quizzes", attempts.length]].map(([e, l, v]) => (
          <Card key={l as string} className="rounded-3xl p-5 text-center">
            <div className="text-3xl">{e}</div>
            <div className="font-display text-3xl font-bold">{v}</div>
            <div className="text-sm text-muted-foreground">{l}</div>
          </Card>
        ))}
      </div>
      <Card className="rounded-3xl p-6">
        <h2 className="text-xl font-bold">Subjects</h2>
        <div className="mt-4 space-y-4">
          {SUBJECTS.map((s) => {
            const list = attempts.filter((a) => a.subject === s.id);
            const sc = list.reduce((m, a) => m + a.score, 0);
            const tt = list.reduce((m, a) => m + a.total, 0);
            const pct = tt ? Math.round((sc / tt) * 100) : 0;
            return (
              <div key={s.id}>
                <div className="flex justify-between font-semibold"><span>{s.emoji} {s.name}</span><span>{tt ? `${pct}%` : "—"}</span></div>
                <Progress value={pct} className="mt-1 h-3" />
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="rounded-3xl p-6">
        <h2 className="text-xl font-bold">Badges</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {badges.length === 0 && <p className="text-muted-foreground">Finish a quiz to earn your first badge!</p>}
          {badges.map((b) => (
            <div key={b.id} className="rounded-2xl bg-accent px-4 py-3 text-center text-accent-foreground">
              <div className="text-3xl">{b.emoji}</div>
              <div className="text-sm font-bold">{b.label}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="rounded-3xl p-6">
        <h2 className="text-xl font-bold">Recent quizzes</h2>
        <ul className="mt-3 divide-y">
          {attempts.slice(0, 15).map((a) => (
            <li key={a.id} className="flex justify-between py-2 text-sm">
              <span>{a.topic} <span className="text-muted-foreground">({a.difficulty})</span></span>
              <span className="font-bold">{a.score}/{a.total}</span>
            </li>
          ))}
          {attempts.length === 0 && <li className="py-2 text-muted-foreground">No quizzes yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
