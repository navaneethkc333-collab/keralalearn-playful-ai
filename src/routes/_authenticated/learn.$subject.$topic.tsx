import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLesson, generateQuiz, getFeedback, type QuizQuestion } from "@/lib/ai.functions";
import { subjectById } from "@/lib/syllabus";
import { useProfile, useAttempts } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SpeakButton } from "@/components/SpeakButton";

export const Route = createFileRoute("/_authenticated/learn/$subject/$topic")({
  head: ({ params }) => ({ meta: [{ title: `${params.topic} — Vidya Kalari` }] }),
  component: TopicPage,
});

type Diff = "easy" | "medium" | "hard";
const ORDER: Diff[] = ["easy", "medium", "hard"];

function TopicPage() {
  const { subject, topic } = Route.useParams();
  const s = subjectById(subject);
  const { data: p } = useProfile();
  const { data: attempts = [] } = useAttempts();
  const [tab, setTab] = useState<"lesson" | "quiz">("lesson");
  if (!p || !s) return <p className="text-muted-foreground">Loading…</p>;
  const lang = (p.language === "ml" ? "ml" : "en") as "en" | "ml";

  // Adaptive difficulty from last attempt on this topic
  const last = attempts.find((a) => a.topic === topic);
  let difficulty: Diff = "easy";
  if (last) {
    const idx = ORDER.indexOf(last.difficulty as Diff);
    const pct = last.score / last.total;
    difficulty = ORDER[Math.max(0, Math.min(2, idx + (pct >= 0.8 ? 1 : pct < 0.5 ? -1 : 0)))];
  }
  const ctx = { classLevel: p.class_level, subject: s.name, topic, language: lang };

  return (
    <div className="space-y-5">
      <Link to="/learn/$subject" params={{ subject }} className="text-sm font-semibold text-primary">← {s.name}</Link>
      <h1 className="text-3xl font-bold">{s.emoji} {topic}</h1>
      <div className="flex gap-2">
        <Button variant={tab === "lesson" ? "default" : "outline"} className="rounded-full" onClick={() => setTab("lesson")}>📘 Learn</Button>
        <Button variant={tab === "quiz" ? "default" : "outline"} className="rounded-full" onClick={() => setTab("quiz")}>🎯 Quiz ({difficulty})</Button>
      </div>
      {tab === "lesson" ? <Lesson ctx={ctx} onQuiz={() => setTab("quiz")} /> : <Quiz ctx={ctx} difficulty={difficulty} subjectId={s.id} userId={p.id} />}
    </div>
  );
}

type Ctx = { classLevel: number; subject: string; topic: string; language: "en" | "ml" };

function Lesson({ ctx, onQuiz }: { ctx: Ctx; onQuiz: () => void }) {
  const fn = useServerFn(getLesson);
  const q = useQuery({ queryKey: ["lesson", ctx], queryFn: () => fn({ data: ctx }), staleTime: Infinity, retry: false });
  if (q.isLoading) return <Card className="rounded-3xl p-8 text-center"><Sparkles className="mx-auto h-8 w-8 animate-pulse text-primary" /><p className="mt-2">Your AI teacher is preparing the lesson…</p></Card>;
  if (q.error) return <Card className="rounded-3xl p-6"><p className="text-destructive">{(q.error as Error).message}</p><Button className="mt-3" onClick={() => q.refetch()}>Try again</Button></Card>;
  const l = q.data!;
  const all = [l.title, l.intro, ...l.points.map((x) => `${x.heading}. ${x.text}`), l.example].join(". ");
  return (
    <div className="space-y-4">
      <Card className="rounded-3xl p-6">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{l.title}</h2>
            <p className="mt-2 text-lg">{l.intro}</p>
          </div>
          <SpeakButton text={all} lang={ctx.language} />
        </div>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {l.points.map((x, i) => (
          <Card key={i} className="rounded-2xl p-5">
            <div className="text-3xl">{x.emoji}</div>
            <h3 className="mt-1 text-lg font-semibold">{x.heading}</h3>
            <p>{x.text}</p>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl bg-secondary p-5"><b>Example:</b> {l.example}</Card>
      <Card className="rounded-2xl bg-accent p-5 text-accent-foreground">💡 <b>Fun fact:</b> {l.funFact}</Card>
      <Button size="lg" className="rounded-full" onClick={onQuiz}>I'm ready for the quiz!</Button>
    </div>
  );
}

function Quiz({ ctx, difficulty, subjectId, userId }: { ctx: Ctx; difficulty: Diff; subjectId: string; userId: string }) {
  const quizFn = useServerFn(generateQuiz);
  const fbFn = useServerFn(getFeedback);
  const qc = useQueryClient();
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: () => quizFn({ data: { ...ctx, difficulty } }),
    onSuccess: (r) => { setQuestions(r.questions); setI(0); setAnswers([]); setPicked(null); setFeedback(null); },
    onError: (e) => toast.error((e as Error).message),
  });

  const finish = useMutation({
    mutationFn: async (results: boolean[]) => {
      const score = results.filter(Boolean).length;
      const total = results.length;
      const { error } = await supabase.from("quiz_attempts").insert({ user_id: userId, subject: subjectId, topic: ctx.topic, difficulty, score, total });
      if (error) throw error;
      const { data: prof } = await supabase.from("profiles").select("points, streak, last_active").eq("id", userId).single();
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const streak = prof?.last_active === today ? prof.streak : prof?.last_active === yesterday ? (prof?.streak ?? 0) + 1 : 1;
      await supabase.from("profiles").update({ points: (prof?.points ?? 0) + score * 10, streak, last_active: today }).eq("id", userId);
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["attempts"] });
      const mistakes = questions!.filter((_, k) => !results[k]).map((q) => q.question);
      try {
        const r = await fbFn({ data: { ...ctx, score, total, mistakes } });
        setFeedback(r.feedback);
      } catch {
        setFeedback(null);
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!questions)
    return (
      <Card className="rounded-3xl p-8 text-center">
        <p className="text-5xl">🎯</p>
        <p className="mt-2 text-lg">5 questions · level <b>{difficulty}</b>. Each right answer = 10 stars!</p>
        <Button size="lg" className="mt-4 rounded-full" disabled={start.isPending} onClick={() => start.mutate()}>
          {start.isPending ? "Making your quiz…" : "Start quiz"}
        </Button>
      </Card>
    );

  if (answers.length === questions.length) {
    const score = answers.filter(Boolean).length;
    return (
      <Card className="rounded-3xl p-8 text-center">
        <p className="text-6xl">{score >= 4 ? "🏆" : score >= 3 ? "⭐" : "💪"}</p>
        <h2 className="mt-2 text-3xl font-bold">{score} / {questions.length}</h2>
        <p className="text-lg">+{score * 10} stars</p>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">{finish.isPending ? "Your teacher is writing a note…" : feedback}</p>
        <Button className="mt-6 rounded-full" onClick={() => start.mutate()} disabled={start.isPending}>Play again</Button>
      </Card>
    );
  }

  const q = questions[i];
  const answered = picked !== null;
  return (
    <Card className="rounded-3xl p-6">
      <Progress value={(i / questions.length) * 100} className="h-3" />
      <div className="mt-4 flex items-start gap-3">
        <h2 className="flex-1 text-2xl font-bold">{q.question}</h2>
        <SpeakButton text={`${q.question}. ${q.options.join(", ")}`} lang={ctx.language} />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {q.options.map((o, k) => {
          const correct = k === q.answerIndex;
          const cls = !answered ? "bg-card hover:bg-secondary" : correct ? "bg-success text-success-foreground" : k === picked ? "bg-destructive text-destructive-foreground" : "bg-muted opacity-60";
          return (
            <button key={k} disabled={answered} onClick={() => setPicked(k)} className={`${cls} flex items-center gap-2 rounded-2xl border-2 p-4 text-left text-lg font-semibold transition-colors`}>
              {answered && correct && <CheckCircle2 className="h-5 w-5" />}
              {answered && !correct && k === picked && <XCircle className="h-5 w-5" />}
              {o}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-5">
          <p className="rounded-2xl bg-secondary p-4">{picked === q.answerIndex ? "🎉 Great job! " : "🙂 Nice try! "}{q.explanation}</p>
          <Button
            className="mt-4 rounded-full"
            onClick={() => {
              const next = [...answers, picked === q.answerIndex];
              setAnswers(next);
              setPicked(null);
              if (next.length === questions.length) finish.mutate(next);
              else setI(i + 1);
            }}
          >
            {i + 1 === questions.length ? "See my score" : "Next question"}
          </Button>
        </div>
      )}
    </Card>
  );
}
