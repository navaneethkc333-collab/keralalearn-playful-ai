import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateQuiz, type QuizQuestion } from "@/lib/ai.functions";
import { subjectById } from "@/lib/syllabus";
import { useProfile, useGames, awardPoints } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { speak } from "@/components/SpeakButton";

export const Route = createFileRoute("/_authenticated/game/$subject/$topic")({
  head: ({ params }) => ({ meta: [{ title: `Balloon Pop: ${params.topic} — Vidya Kalari` }] }),
  component: GamePage,
});

type Diff = "easy" | "medium" | "hard";
const ROUND_MS: Record<Diff, number> = { easy: 14000, medium: 11000, hard: 8000 };
const BALLOON = ["bg-coral", "bg-sky", "bg-sun", "bg-leaf"];

function GamePage() {
  const { subject, topic } = Route.useParams();
  const s = subjectById(subject);
  const { data: p } = useProfile();
  const { data: games = [] } = useGames();
  const quizFn = useServerFn(generateQuiz);
  const qc = useQueryClient();

  const last = games.find((g) => g.topic === topic);
  let difficulty: Diff = "easy";
  if (last) {
    const pct = last.score / last.max_score;
    const order: Diff[] = ["easy", "medium", "hard"];
    const idx = order.indexOf(last.difficulty as Diff);
    difficulty = order[Math.max(0, Math.min(2, idx + (pct >= 0.7 ? 1 : pct < 0.4 ? -1 : 0)))] ?? "easy";
  }

  const [qs, setQs] = useState<QuizQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [popped, setPopped] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [roundKey, setRoundKey] = useState(0);
  const startTs = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useMutation({
    mutationFn: () =>
      quizFn({ data: { classLevel: p!.class_level, subject: s!.name, topic, language: p!.language === "ml" ? "ml" : "en", difficulty, count: 8 } }),
    onSuccess: (r) => {
      setQs(r.questions); setI(0); setLives(3); setScore(0); setOver(false); setPopped(null); setRoundKey((k) => k + 1);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const save = useMutation({
    mutationFn: async (final: number) => {
      const max = (qs?.length ?? 8) * 100;
      const { error } = await supabase.from("game_results").insert({ user_id: p!.id, subject, topic, difficulty, score: final, max_score: max });
      if (error) throw error;
      await awardPoints(p!.id, Math.round(final / 20));
      qc.invalidateQueries({ queryKey: ["games"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function next(newLives: number, newScore: number) {
    if (!qs) return;
    if (newLives <= 0 || i + 1 >= qs.length) {
      setOver(true);
      save.mutate(newScore);
    } else {
      setI(i + 1);
      setPopped(null);
      setRoundKey((k) => k + 1);
    }
  }

  // round timer: balloon escapes
  useEffect(() => {
    if (!qs || over) return;
    startTs.current = Date.now();
    timer.current = setTimeout(() => {
      const nl = lives - 1;
      setLives(nl);
      toast("🎈 The balloons flew away!");
      next(nl, score);
    }, ROUND_MS[difficulty]);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey, over]);

  if (!p || !s) return <p className="text-muted-foreground">Loading…</p>;
  const lang = p.language === "ml" ? "ml" : "en";

  if (!qs)
    return (
      <div className="space-y-5">
        <Link to="/learn/$subject/$topic" params={{ subject, topic }} className="text-sm font-semibold text-primary">← {topic}</Link>
        <Card className="rounded-3xl p-8 text-center">
          <p className="text-6xl">🎈</p>
          <h1 className="mt-2 text-3xl font-bold">Balloon Pop</h1>
          <p className="mt-2 text-lg">Pop the balloon with the right answer before it flies away! 3 lives · level <b>{difficulty}</b>.</p>
          <Button size="lg" className="mt-5 rounded-full" disabled={load.isPending} onClick={() => load.mutate()}>
            {load.isPending ? "Blowing up balloons…" : "Start Game"}
          </Button>
        </Card>
      </div>
    );

  if (over)
    return (
      <Card className="mx-auto max-w-xl rounded-3xl p-8 text-center">
        <p className="text-6xl">{score >= qs.length * 60 ? "🏆" : "🎉"}</p>
        <h2 className="mt-2 text-3xl font-bold">Score: {score}</h2>
        <p className="text-muted-foreground">+{Math.round(score / 20)} stars</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button className="rounded-full" onClick={() => load.mutate()} disabled={load.isPending}>Play again</Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/learn/$subject/$topic" params={{ subject, topic }}>Back to topic</Link>
          </Button>
        </div>
      </Card>
    );

  const q = qs[i];
  if (!q) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between font-bold">
        <span>Question {i + 1}/{qs.length}</span>
        <span className="flex gap-1">{[0, 1, 2].map((k) => <Heart key={k} className={`h-6 w-6 ${k < lives ? "fill-coral text-coral" : "text-muted"}`} />)}</span>
        <span>⭐ {score}</span>
      </div>
      <Card className="rounded-3xl p-5 text-center">
        <h2 className="text-xl font-bold sm:text-2xl">{q.question}</h2>
        <button className="mt-1 text-sm text-primary underline" onClick={() => speak(q.question, lang)}>🔊 Listen</button>
      </Card>
      <div key={roundKey} className="relative h-[420px] overflow-hidden rounded-3xl bg-sky/20">
        <style>{`@keyframes rise{from{transform:translateY(0)}to{transform:translateY(-560px)}}`}</style>
        {q.options.map((o, k) => (
          <button
            key={k}
            disabled={popped !== null}
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              setPopped(k);
              const right = k === q.answerIndex;
              const speed = Math.max(0, 1 - (Date.now() - startTs.current) / ROUND_MS[difficulty]);
              const gained = right ? 50 + Math.round(speed * 50) : 0;
              const ns = score + gained;
              const nl = right ? lives : lives - 1;
              setScore(ns);
              setLives(nl);
              toast(right ? `🎉 Pop! +${gained}` : `Oops! ${q.explanation}`);
              setTimeout(() => next(nl, ns), 900);
            }}
            className={`${BALLOON[k]} absolute flex h-28 w-28 items-center justify-center rounded-full p-2 text-center text-sm font-bold text-foreground shadow-lg transition-opacity sm:h-32 sm:w-32 sm:text-base ${popped !== null && k !== q.answerIndex ? "opacity-30" : ""} ${popped !== null && k === q.answerIndex ? "ring-4 ring-primary" : ""}`}
            style={{
              left: `${4 + k * 24}%`,
              bottom: "-130px",
              animation: popped === null ? `rise ${ROUND_MS[difficulty] / 1000 + k * 0.4}s linear forwards` : undefined,
              animationPlayState: popped === null ? "running" : "paused",
            }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
