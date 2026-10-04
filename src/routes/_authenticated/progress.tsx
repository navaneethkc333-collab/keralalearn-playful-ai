import { createFileRoute } from "@tanstack/react-router";
import { SUBJECTS, TOPICS } from "@/lib/syllabus";
import { ACTIVITIES } from "@/lib/skills";
import { useAttempts, useProfile, useCompletions, useGames, useSkills, useAssessments, levelFromPoints } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progress — Vidya Kalari" }, { name: "description", content: "See your learning progress, game scores and achievements in Vidya Kalari." }, { property: "og:title", content: "Progress — Vidya Kalari" }, { property: "og:description", content: "See your learning progress, game scores and achievements in Vidya Kalari." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: ProgressPage,
});

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

function Stat({ e, l, v }: { e: string; l: string; v: string | number }) {
  return (
    <Card className="rounded-3xl p-5 text-center">
      <div className="text-3xl">{e}</div>
      <div className="font-display text-3xl font-bold">{v}</div>
      <div className="text-sm text-muted-foreground">{l}</div>
    </Card>
  );
}

function ProgressPage() {
  const { data: p } = useProfile();
  const { data: attempts = [] } = useAttempts();
  const { data: done = [] } = useCompletions();
  const { data: games = [] } = useGames();
  const { data: skills = [] } = useSkills();
  const { data: tests = [] } = useAssessments();
  if (!p) return <p className="text-muted-foreground">Loading…</p>;

  const topics = TOPICS[p.class_level] ?? TOPICS[1]!;
  const allTopics = SUBJECTS.reduce((n, s) => n + topics[s.id].length, 0);
  const doneHere = done.filter((c) => c.class_level === p.class_level);
  const completion = allTopics ? Math.round((doneHere.length / allTopics) * 100) : 0;

  const testPct = tests.map((t) => Math.round((t.obtained / t.total) * 100));
  const gamePct = games.map((g) => Math.round((g.score / g.max_score) * 100));
  const subjTest = (id: string) => {
    let o = 0, t = 0;
    tests.forEach((r) => { const s = (r.subject_scores as Record<string, { obtained: number; total: number }>)?.[id]; if (s) { o += s.obtained; t += s.total; } });
    return t ? Math.round((o / t) * 100) : null;
  };
  const lastGame = games[0];

  const badges = [
    doneHere.length >= 1 && { e: "📘", l: "First Topic" },
    games.length >= 1 && { e: "🎈", l: "Game Player" },
    tests.length >= 1 && { e: "📋", l: "First Test" },
    skills.length >= 1 && { e: "🎨", l: "Young Artist" },
    attempts.some((a) => a.score === a.total) && { e: "🏆", l: "Perfect Quiz" },
    testPct.some((x) => x >= 90) && { e: "🥇", l: "Test Star" },
    p.streak >= 3 && { e: "🔥", l: "3-Day Streak" },
    p.points >= 500 && { e: "🌟", l: "Star Learner" },
  ].filter(Boolean) as { e: string; l: string }[];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">📊 Progress</h1>

      <Card className="rounded-3xl p-6">
        <h2 className="text-xl font-bold">Overall progress</h2>
        <div className="mt-2 flex justify-between font-semibold"><span>Learning completion (Class {p.class_level})</span><span>{completion}%</span></div>
        <Progress value={completion} className="mt-1 h-4" />
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat e="📘" l="Topics completed" v={doneHere.length} />
          <Stat e="🎈" l="Games completed" v={games.length} />
          <Stat e="📋" l="Assessments" v={tests.length} />
          <Stat e="🎨" l="Skill activities" v={skills.length} />
        </div>
      </Card>

      <Card className="rounded-3xl p-6">
        <h2 className="text-xl font-bold">Subject-wise progress</h2>
        <div className="mt-4 space-y-4">
          {SUBJECTS.map((s) => {
            const n = topics[s.id].filter((t) => doneHere.some((c) => c.subject === s.id && c.topic === t)).length;
            const pct = Math.round((n / topics[s.id].length) * 100);
            const q = attempts.filter((a) => a.subject === s.id);
            const qp = q.length ? Math.round((q.reduce((m, a) => m + a.score, 0) / q.reduce((m, a) => m + a.total, 0)) * 100) : null;
            return (
              <div key={s.id}>
                <div className="flex flex-wrap justify-between gap-2 font-semibold">
                  <span>{s.emoji} {s.name}</span>
                  <span className="text-sm text-muted-foreground">{n}/{topics[s.id].length} topics · quizzes {qp ?? 0}%</span>
                </div>
                <Progress value={pct} className="mt-1 h-3" />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl p-6">
          <h2 className="text-xl font-bold">Assessment performance</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat e="🆕" l="Latest score" v={`${testPct[0] ?? 0}%`} />
            <Stat e="📈" l="Average score" v={`${avg(testPct)}%`} />
          </div>
          <div className="mt-4 space-y-2">
            {SUBJECTS.map((s) => {
              const v = subjTest(s.id);
              return (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="w-28 font-semibold">{s.emoji} {s.name.split(" ")[0]}</span>
                  <Progress value={v ?? 0} className="h-2 flex-1" />
                  <span className="w-10 text-right">{v ?? 0}%</span>
                </div>
              );
            })}
          </div>
          <h3 className="mt-4 font-semibold">History</h3>
          <ul className="divide-y text-sm">
            {tests.map((t) => (
              <li key={t.id} className="flex justify-between py-2">
                <span>{new Date(t.created_at).toLocaleDateString()}</span>
                <span className="font-bold">{t.obtained}/{t.total}</span>
              </li>
            ))}
            {!tests.length && <li className="py-2 text-muted-foreground">No assessments yet.</li>}
          </ul>
        </Card>

        <Card className="rounded-3xl p-6">
          <h2 className="text-xl font-bold">Game performance</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat e="🎮" l="Games played" v={games.length} />
            <Stat e="📊" l="Average score" v={`${avg(gamePct)}%`} />
            <Stat e="🏅" l="Highest score" v={games.reduce((m, g) => Math.max(m, g.score), 0)} />
            <Stat e="⚙️" l="Current level" v={lastGame?.difficulty ?? "—"} />
          </div>
          <h2 className="mt-6 text-xl font-bold">Skill development</h2>
          <div className="mt-3 space-y-2">
            {ACTIVITIES.map((a) => {
              const mine = skills.filter((s) => s.activity === a.id);
              const v = avg(mine.map((m) => m.score));
              return (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <span className="w-44 font-semibold">{a.emoji} {a.name}</span>
                  <Progress value={v} className="h-2 flex-1" />
                  <span className="w-16 text-right">{mine.length ? `${v} (${mine.length})` : "0"}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="rounded-3xl p-6">
        <h2 className="text-xl font-bold">Achievements</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat e="⭐" l="Points" v={p.points} />
          <Stat e="🎖️" l="Level" v={levelFromPoints(p.points)} />
          <Stat e="🔥" l="Day streak" v={p.streak} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {!badges.length && <p className="text-muted-foreground">Complete a topic, game, test or activity to earn your first badge!</p>}
          {badges.map((b) => (
            <div key={b.l} className="rounded-2xl bg-accent px-4 py-3 text-center text-accent-foreground">
              <div className="text-3xl">{b.e}</div>
              <div className="text-sm font-bold">{b.l}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
