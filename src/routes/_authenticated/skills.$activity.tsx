import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSkillPrompt, evaluateSkill, getPracticeSet, evaluatePractice, type SkillEval, type PracticeQ } from "@/lib/ai.functions";
import { activityById } from "@/lib/skills";
import { useProfile, awardPoints } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SpeakButton } from "@/components/SpeakButton";
import { DrawingCanvas, type DrawingHandle } from "@/components/DrawingCanvas";

export const Route = createFileRoute("/_authenticated/skills/$activity")({
  head: ({ params }) => ({ meta: [{ title: `${activityById(params.activity)?.name ?? "Activity"} — Vidya Kalari` }, { name: "description", content: `Practice ${activityById(params.activity)?.name ?? "skills"} with a fresh activity in Vidya Kalari.` }, { property: "og:title", content: `${activityById(params.activity)?.name ?? "Activity"} — Vidya Kalari` }, { property: "og:description", content: `Practice ${activityById(params.activity)?.name ?? "skills"} with a fresh activity in Vidya Kalari.` }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { activity } = Route.useParams();
  const a = activityById(activity);
  const { data: p } = useProfile();
  if (!a) return <p>Activity not found.</p>;
  if (!p) return <p className="text-muted-foreground">Loading…</p>;
  const ctx = { classLevel: p.class_level, language: (p.language === "ml" ? "ml" : "en") as "en" | "ml", userId: p.id };
  return (
    <div className="space-y-5">
      <Link to="/skills" className="text-sm font-semibold text-primary">← Skill Development</Link>
      <h1 className="text-3xl font-bold">{a.emoji} {a.name}</h1>
      {a.id === "drawing" || a.id === "story" || a.id === "poem" ? (
        <Creative key={a.id} activity={a.id} ctx={ctx} />
      ) : (
        <Practice key={a.id} subject={a.id} ctx={ctx} />
      )}
    </div>
  );
}

type Ctx = { classLevel: number; language: "en" | "ml"; userId: string };

function useSaveResult() {
  const qc = useQueryClient();
  return async (userId: string, activity: string, prompt: string, response: string, score: number, feedback: unknown) => {
    const { error } = await supabase.from("skill_results").insert({ user_id: userId, activity, prompt, response, score, feedback: feedback as never });
    if (error) throw error;
    await awardPoints(userId, Math.round(score / 10));
    qc.invalidateQueries({ queryKey: ["skills"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };
}

function Creative({ activity, ctx }: { activity: "drawing" | "story" | "poem"; ctx: Ctx }) {
  const promptFn = useServerFn(getSkillPrompt);
  const evalFn = useServerFn(evaluateSkill);
  const saveResult = useSaveResult();
  const [task, setTask] = useState<{ prompt: string; tips: string[] } | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<SkillEval | null>(null);
  const canvas = useRef<DrawingHandle>(null);

  const getTask = useMutation({
    mutationFn: () => promptFn({ data: { activity, classLevel: ctx.classLevel, language: ctx.language } }),
    onSuccess: (t) => { setTask(t); setText(""); setResult(null); },
    onError: (e) => toast.error((e as Error).message),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!task) return;
      let imageBase64: string | undefined;
      if (activity === "drawing") {
        if (canvas.current?.isEmpty()) throw new Error("Please draw something first.");
        imageBase64 = canvas.current?.toBase64() ?? undefined;
      }
      const r = await evalFn({ data: { activity, classLevel: ctx.classLevel, language: ctx.language, prompt: task.prompt, text: activity === "drawing" ? undefined : text, imageBase64 } });
      const score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
      const clean = { ...r, score };
      await saveResult(ctx.userId, activity, task.prompt, activity === "drawing" ? "[drawing]" : text, score, clean);
      setResult(clean);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!task)
    return (
      <Card className="rounded-3xl p-8 text-center">
        <Button size="lg" className="rounded-full" disabled={getTask.isPending} onClick={() => getTask.mutate()}>
          {getTask.isPending ? "Thinking of an idea…" : "Give me a task"}
        </Button>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl bg-secondary p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-lg font-semibold">{task.prompt}</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{task.tips?.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
          <SpeakButton text={task.prompt} lang={ctx.language} />
        </div>
        <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => getTask.mutate()} disabled={getTask.isPending}>New idea</Button>
      </Card>
      {activity === "drawing" ? (
        <DrawingCanvas ref={canvas} />
      ) : (
        <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={activity === "poem" ? "Write your poem here…" : "Write your story here…"} className="rounded-2xl text-lg" />
      )}
      <Button size="lg" className="rounded-full" disabled={submit.isPending} onClick={() => submit.mutate()}>
        {submit.isPending ? "Your teacher is checking…" : "Submit"}
      </Button>
      {result && <ResultCard score={result.score} feedback={result.feedback} strengths={result.strengths} improvements={result.improvements} grammar={result.grammar} />}
    </div>
  );
}

function ResultCard({ score, feedback, strengths = [], improvements = [], grammar = [] }: { score: number; feedback: string; strengths?: string[]; improvements?: string[]; grammar?: string[] }) {
  return (
    <Card className="rounded-3xl border-2 border-primary p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary font-display text-3xl font-bold text-primary-foreground">{score}</div>
        <p className="flex-1 text-lg">{feedback}</p>
      </div>
      {strengths.length > 0 && <Section title="🌟 Well done" items={strengths} />}
      {grammar.length > 0 && <Section title="✏️ Grammar & spelling" items={grammar} />}
      {improvements.length > 0 && <Section title="🚀 To improve" items={improvements} />}
    </Card>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="list-disc pl-5">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}

function Practice({ subject, ctx }: { subject: "maths" | "english" | "malayalam"; ctx: Ctx }) {
  const setFn = useServerFn(getPracticeSet);
  const evalFn = useServerFn(evaluatePractice);
  const saveResult = useSaveResult();
  const [qs, setQs] = useState<PracticeQ[] | null>(null);
  const [given, setGiven] = useState<string[]>([]);
  const [res, setRes] = useState<Awaited<ReturnType<typeof evaluatePractice>> | null>(null);

  const load = useMutation({
    mutationFn: () => setFn({ data: { subject, classLevel: ctx.classLevel, language: ctx.language } }),
    onSuccess: (r) => { setQs(r.questions); setGiven(r.questions.map(() => "")); setRes(null); },
    onError: (e) => toast.error((e as Error).message),
  });
  const check = useMutation({
    mutationFn: async () => {
      const items = qs!.map((q, i) => ({ question: q.question, answer: q.answer, given: given[i] ?? "" }));
      const r = await evalFn({ data: { subject, classLevel: ctx.classLevel, language: ctx.language, items } });
      await saveResult(ctx.userId, subject, qs!.map((q) => q.question).join(" | "), given.join(" | "), r.score, r);
      setRes(r);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!qs)
    return (
      <Card className="rounded-3xl p-8 text-center">
        <Button size="lg" className="rounded-full" disabled={load.isPending} onClick={() => load.mutate()}>
          {load.isPending ? "Preparing activities…" : "Start activity"}
        </Button>
      </Card>
    );

  return (
    <div className="space-y-3">
      {qs.map((q, i) => (
        <Card key={i} className="rounded-2xl p-4">
          <div className="flex items-start gap-2">
            <p className="flex-1 font-semibold">{i + 1}. {q.question}</p>
            <SpeakButton text={q.question} lang={subject === "malayalam" ? "ml" : subject === "english" ? "en" : ctx.language} />
          </div>
          <Input className="mt-2 text-lg" disabled={!!res} value={given[i] ?? ""} onChange={(e) => setGiven(given.map((g, k) => (k === i ? e.target.value : g)))} placeholder="Your answer" />
          {res && (
            <p className={`mt-2 flex items-center gap-1 text-sm font-semibold ${res.results[i]?.correct ? "text-success" : "text-destructive"}`}>
              {res.results[i]?.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {res.results[i]?.correct ? "Correct!" : `Answer: ${q.answer}`} {res.results[i]?.note && `· ${res.results[i]?.note}`}
            </p>
          )}
        </Card>
      ))}
      {!res ? (
        <Button size="lg" className="rounded-full" disabled={check.isPending} onClick={() => check.mutate()}>
          {check.isPending ? "Checking…" : "Check my answers"}
        </Button>
      ) : (
        <>
          <ResultCard score={res.score} feedback={res.feedback} improvements={res.improvements} />
          <Button className="rounded-full" onClick={() => load.mutate()} disabled={load.isPending}>New activities</Button>
        </>
      )}
    </div>
  );
}
