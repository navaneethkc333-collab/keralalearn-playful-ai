import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateAssessment, assessmentSummary, type AssessQ } from "@/lib/ai.functions";
import { SUBJECTS, TOPICS, subjectById } from "@/lib/syllabus";
import { useProfile, awardPoints } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SpeakButton } from "@/components/SpeakButton";

export const Route = createFileRoute("/_authenticated/assessment")({
  head: () => ({ meta: [{ title: "Assessment — Vidya Kalari" }, { name: "description", content: "Take a class-level assessment across your Vidya Kalari subjects." }, { property: "og:title", content: "Assessment — Vidya Kalari" }, { property: "og:description", content: "Take a class-level assessment across your Vidya Kalari subjects." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AssessmentPage,
});

type Summary = { feedback: string; improvements: string[]; recommended: { subject: string; topic: string }[] };

function AssessmentPage() {
  const { data: p } = useProfile();
  const genFn = useServerFn(generateAssessment);
  const sumFn = useServerFn(assessmentSummary);
  const qc = useQueryClient();
  const [qs, setQs] = useState<AssessQ[] | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const start = useMutation({
    mutationFn: () => {
      const t = TOPICS[p!.class_level] ?? TOPICS[1]!;
      return genFn({ data: { classLevel: p!.class_level, language: p!.language === "ml" ? "ml" : "en", topics: t } });
    },
    onSuccess: (r) => { setQs(r.questions); setAnswers(r.questions.map(() => null)); setI(0); setDone(false); setSummary(null); },
    onError: (e) => toast.error((e as Error).message),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const subjectScores: Record<string, { obtained: number; total: number }> = {};
      const details = qs!.map((q, k) => {
        const correct = answers[k] === q.answerIndex;
        const s = (subjectScores[q.subject] ??= { obtained: 0, total: 0 });
        s.total += 1;
        if (correct) s.obtained += 1;
        return { ...q, given: answers[k], correct };
      });
      const obtained = details.filter((d) => d.correct).length;
      const { data: row, error } = await supabase
        .from("assessment_results")
        .insert({ user_id: p!.id, class_level: p!.class_level, total: qs!.length, obtained, subject_scores: subjectScores, details: details as never })
        .select("id")
        .single();
      if (error) throw error;
      await awardPoints(p!.id, obtained * 5);
      setDone(true);
      qc.invalidateQueries({ queryKey: ["assessments"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      try {
        const s = await sumFn({
          data: {
            classLevel: p!.class_level,
            language: p!.language === "ml" ? "ml" : "en",
            subjectScores,
            wrong: details.filter((d) => !d.correct).map((d) => ({ subject: d.subject, topic: d.topic, question: d.question })),
          },
        });
        setSummary(s);
        await supabase.from("assessment_results").update({ summary: s as never }).eq("id", row.id);
        qc.invalidateQueries({ queryKey: ["assessments"] });
      } catch {
        /* summary optional */
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!p) return <p className="text-muted-foreground">Loading…</p>;
  const lang = p.language === "ml" ? "ml" : "en";

  if (!qs)
    return (
      <Card className="mx-auto max-w-2xl rounded-3xl p-8 text-center">
        <p className="text-6xl">📋</p>
        <h1 className="mt-2 text-3xl font-bold">Class {p.class_level} Assessment</h1>
        <p className="mt-2 text-lg text-muted-foreground">A fresh test on all your subjects: Mathematics, English, Malayalam and EVS. New questions every time!</p>
        <Button size="lg" className="mt-5 rounded-full" disabled={start.isPending} onClick={() => start.mutate()}>
          {start.isPending ? "Preparing your test…" : "Start Assessment"}
        </Button>
      </Card>
    );

  if (done) {
    const obtained = qs.filter((q, k) => answers[k] === q.answerIndex).length;
    const pct = Math.round((obtained / qs.length) * 100);
    return (
      <div className="space-y-5">
        <Card className="rounded-3xl bg-primary p-6 text-center text-primary-foreground">
          <p className="text-5xl">{pct >= 80 ? "🏆" : pct >= 50 ? "⭐" : "💪"}</p>
          <h1 className="text-3xl font-bold">{obtained} / {qs.length} marks · {pct}%</h1>
          <p className="opacity-90">Total marks {qs.length} · Marks obtained {obtained}</p>
        </Card>
        <Card className="rounded-3xl p-6">
          <h2 className="text-xl font-bold">Subject-wise performance</h2>
          <div className="mt-3 space-y-3">
            {SUBJECTS.map((s) => {
              const list = qs.map((q, k) => ({ q, k })).filter((x) => x.q.subject === s.id);
              if (!list.length) return null;
              const ok = list.filter((x) => answers[x.k] === x.q.answerIndex).length;
              return (
                <div key={s.id}>
                  <div className="flex justify-between font-semibold"><span>{s.emoji} {s.name}</span><span>{ok}/{list.length}</span></div>
                  <Progress value={(ok / list.length) * 100} className="mt-1 h-3" />
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="rounded-3xl p-6">
          <h2 className="text-xl font-bold">Your teacher says</h2>
          {!summary ? <p className="mt-2 text-muted-foreground">Writing your report…</p> : (
            <>
              <p className="mt-2">{summary.feedback}</p>
              <h3 className="mt-4 font-semibold">🚀 Improvement areas</h3>
              <ul className="list-disc pl-5">{summary.improvements?.map((t, k) => <li key={k}>{t}</li>)}</ul>
              <h3 className="mt-4 font-semibold">📚 Practise these topics</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {summary.recommended?.map((r, k) =>
                  subjectById(r.subject) ? (
                    <Link key={k} to="/learn/$subject/$topic" params={{ subject: r.subject, topic: r.topic }} className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-primary">
                      {subjectById(r.subject)?.emoji} {r.topic}
                    </Link>
                  ) : null,
                )}
              </div>
            </>
          )}
        </Card>
        <Card className="rounded-3xl p-6">
          <h2 className="text-xl font-bold">Answers & explanations</h2>
          <ol className="mt-3 space-y-3">
            {qs.map((q, k) => {
              const ok = answers[k] === q.answerIndex;
              return (
                <li key={k} className="rounded-2xl bg-muted p-4">
                  <p className="flex items-start gap-2 font-semibold">
                    {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
                    {k + 1}. {q.question}
                  </p>
                  <p className="text-sm">Your answer: {answers[k] != null ? q.options[answers[k]!] : "—"} · Correct: <b>{q.options[q.answerIndex]}</b></p>
                  <p className="text-sm text-muted-foreground">{q.explanation}</p>
                </li>
              );
            })}
          </ol>
        </Card>
        <Button size="lg" className="rounded-full" onClick={() => start.mutate()} disabled={start.isPending}>Take a new assessment</Button>
      </div>
    );
  }

  const q = qs[i];
  if (!q) return null;
  const s = subjectById(q.subject);
  const answeredCount = answers.filter((a) => a !== null).length;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex justify-between text-sm font-semibold"><span>Question {i + 1} of {qs.length}</span><span>{answeredCount} answered</span></div>
      <Progress value={(answeredCount / qs.length) * 100} className="h-3" />
      <Card className="rounded-3xl p-6">
        <span className={`${s?.color ?? "bg-secondary"} rounded-full px-3 py-1 text-xs font-bold`}>{s?.emoji} {s?.name}</span>
        <div className="mt-3 flex items-start gap-3">
          <h2 className="flex-1 text-2xl font-bold">{q.question}</h2>
          <SpeakButton text={`${q.question}. ${q.options.join(", ")}`} lang={q.subject === "malayalam" ? "ml" : q.subject === "english" ? "en" : lang} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {q.options.map((o, k) => (
            <button key={k} onClick={() => setAnswers(answers.map((a, j) => (j === i ? k : a)))} className={`rounded-2xl border-2 p-4 text-left text-lg font-semibold transition-colors ${answers[i] === k ? "border-primary bg-primary/10" : "bg-card hover:bg-secondary"}`}>
              {o}
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-between">
          <Button variant="outline" className="rounded-full" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
          {i + 1 < qs.length ? (
            <Button className="rounded-full" onClick={() => setI(i + 1)}>Next</Button>
          ) : (
            <Button className="rounded-full" disabled={submit.isPending || answeredCount < qs.length} onClick={() => submit.mutate()}>
              {submit.isPending ? "Checking…" : answeredCount < qs.length ? `Answer all (${qs.length - answeredCount} left)` : "Submit"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
