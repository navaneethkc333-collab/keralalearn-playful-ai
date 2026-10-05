import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Heart, Volume2, VolumeX, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateTopicGame, type GameMode, type GameRound, type QuizQuestion } from "@/lib/ai.functions";
import type { GeneratedTopicGame } from "@/lib/topic-game";
import { GameCharacter } from "@/components/GameCharacter";
import { useGameSound } from "@/hooks/useGameSound";
import { awardPoints, useGames } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { speak } from "@/components/SpeakButton";

type Difficulty = "easy" | "medium" | "hard";
const LABELS: Record<GameMode, string> = { balloon: "Balloon Pop", match: "Match the Pairs", sequence: "Put in Order" };
const ICONS: Record<GameMode, string> = { balloon: "🎈", match: "🧩", sequence: "🔢" };
const COLORS = ["bg-coral", "bg-sky", "bg-sun", "bg-leaf"];

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i]; const b = copy[j];
    if (a !== undefined && b !== undefined) { copy[i] = b; copy[j] = a; }
  }
  return copy;
}

export function TopicGame({ classLevel, subject, subjectName, topic, language, userId }: {
  classLevel: number; subject: string; subjectName: string; topic: string; language: "en" | "ml"; userId: string;
}) {
  const { data: games = [] } = useGames();
  const qc = useQueryClient();
  const gameFn = useServerFn(generateTopicGame);
  const sound = useGameSound();
  const [game, setGame] = useState<GeneratedTopicGame | null>(null);
  const requested = useRef(false);
  const previous = games.find((g) => g.subject === subject && g.topic === topic);
  const difficulty: Difficulty = previous
    ? ((["easy", "medium", "hard"] as Difficulty[])[Math.max(0, Math.min(2, ["easy", "medium", "hard"].indexOf(previous.difficulty) + (previous.score / previous.max_score >= 0.7 ? 1 : previous.score / previous.max_score < 0.4 ? -1 : 0)))] ?? "easy")
    : "easy";
  const [rounds, setRounds] = useState<GameRound[] | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [mode, setMode] = useState<GameMode | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [finished, setFinished] = useState(false);
  const [balloonPicked, setBalloonPicked] = useState<number | null>(null);
  const [balloonExpired, setBalloonExpired] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTime = useRef(0);
  const roundDuration = difficulty === "easy" ? 16000 : difficulty === "medium" ? 13000 : 10000;
  const load = useMutation({
    mutationFn: () => gameFn({ data: { classLevel, subject: subjectName, topic, language, difficulty, previousMode: mode ?? undefined } }),
    retry: false,
    onMutate: () => {
      if (timer.current) clearTimeout(timer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    onSuccess: (generated) => {
      const chosen = generated.mode;
      const generatedQuestions = chosen === "balloon" ? generated.questions : null;
      const generatedRounds = chosen === "balloon" ? null : generated.rounds;
      setGame(generated);
      setMode(chosen); setQuestions(generatedQuestions); setRounds(generatedRounds); setRound(0); setScore(0);
      setLives(3); setSelected(null); setMatched([]); setStep(0); setMistakes(0); setFeedback("");
      setFinished(false); setBalloonPicked(null); setBalloonExpired(false);
      if (generatedRounds?.[0]) setChoices(shuffled(chosen === "match" ? generatedRounds[0].pairs?.map((p) => p.right) ?? [] : generatedRounds[0].items ?? []));
    },
    onError: (error) => toast.error((error as Error).message),
  });

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    load.mutate();
    // Generate once on entry; new games require an explicit replay action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useMutation({
    mutationFn: async ({ finalScore, maxScore }: { finalScore: number; maxScore: number }) => {
      const { error } = await supabase.from("game_results").insert({ user_id: userId, subject, topic, difficulty, score: finalScore, max_score: maxScore });
      if (error) throw error;
      await awardPoints(userId, Math.round(finalScore / 20));
      await Promise.all([qc.invalidateQueries({ queryKey: ["games"] }), qc.invalidateQueries({ queryKey: ["profile"] })]);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const total = mode === "balloon" ? questions?.length ?? 0 : rounds?.length ?? 0;
  function end(finalScore: number) {
    if (timer.current) clearTimeout(timer.current);
    sound.play("finish");
    setFinished(true);
    save.mutate({ finalScore, maxScore: total * 100 });
  }
  function nextRound(finalScore: number, remainingLives = lives) {
    if (remainingLives <= 0 || round + 1 >= total) { end(finalScore); return; }
    const next = round + 1;
    setRound(next); setSelected(null); setMatched([]); setStep(0); setMistakes(0); setFeedback("");
    setBalloonPicked(null); setBalloonExpired(false);
    const upcoming = rounds?.[next];
    if (upcoming) setChoices(shuffled(mode === "match" ? upcoming.pairs?.map((p) => p.right) ?? [] : upcoming.items ?? []));
  }

  useEffect(() => {
    if (mode !== "balloon" || finished || !questions?.[round] || balloonPicked !== null || balloonExpired) return;
    startTime.current = Date.now();
    timer.current = setTimeout(() => {
      setBalloonExpired(true);
      sound.play("wrong");
      setFeedback("The balloons flew away!");
      const remaining = lives - 1;
      setLives(remaining);
      advanceTimer.current = setTimeout(() => nextRound(score, remaining), 950);
    }, roundDuration);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // One clock per question; answer handlers cancel the active clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, round, finished, questions]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  if (load.isPending || (!mode && !load.isError)) return (
    <div className="mx-auto max-w-2xl py-8 text-center">
      <Sparkles className="mx-auto h-14 w-14 animate-pulse text-primary motion-reduce:animate-none" />
      <h2 className="mt-3 text-2xl font-bold" role="status">AI is generating your game…</h2>
      <p className="mt-3 text-lg text-muted-foreground">{topic} · {difficulty} level</p>
      <div className="mt-5 flex justify-center gap-4 text-3xl" aria-hidden="true">🎨 🧩 🎵</div>
    </div>
  );

  if (load.isError) return <div className="py-8 text-center"><p role="alert" className="text-destructive">{load.error.message}</p><Button className="mt-4" onClick={() => load.mutate()}>Try again</Button></div>;
  if (!mode || !game) return null;

  if (finished) return (
    <div className="mx-auto max-w-2xl py-8 text-center">
      <div className="flex justify-center"><GameCharacter character={game.character} happy /></div>
      <h2 className="mt-3 text-3xl font-bold">{game.title} · {score}/{total * 100}</h2>
      <p className="mt-2 text-muted-foreground">+{Math.round(score / 20)} stars</p>
      <Button className="mt-6 rounded-full" onClick={() => load.mutate()} disabled={load.isPending}>
        Generate another game
      </Button>
    </div>
  );

  const current = rounds?.[round];
  const question = questions?.[round];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3 border-b pb-4">
        <GameCharacter character={game.character} happy={feedback.includes("!")} />
        <div className="min-w-0 flex-1"><h2 className="break-words text-xl font-bold sm:text-2xl">{game.title}</h2><p className="mt-1 font-semibold text-primary">{game.character.name}</p><p className="mt-1 break-words text-sm">{game.character.greeting}</p></div>
        <Button variant="outline" size="icon" className="shrink-0" aria-label={sound.enabled ? "Mute game sound" : "Enable game sound"} aria-pressed={sound.enabled} title={sound.enabled ? "Mute game sound" : "Enable game sound"} onClick={() => { sound.setEnabled(!sound.enabled); if (sound.enabled) window.speechSynthesis?.cancel(); }}>{sound.enabled ? <Volume2 /> : <VolumeX />}</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
        <span>{ICONS[mode]} {LABELS[mode]} · {round + 1}/{total}</span>
        {mode === "balloon" && <span className="flex gap-1" aria-label={`${lives} lives left`}>{[0, 1, 2].map((k) => <Heart key={k} className={`h-5 w-5 ${k < lives ? "fill-coral text-coral" : "text-muted"}`} />)}</span>}
        <span>⭐ {score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(round / total) * 100}%` }} /></div>
      <Card className="p-5 text-center">
        <h2 className="text-xl font-bold sm:text-2xl">{mode === "balloon" ? question?.question : current?.prompt}</h2>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => speak(mode === "balloon" ? question?.question ?? "" : current?.prompt ?? "", language)} aria-label="Listen to question"><Volume2 /> Listen</Button>
      </Card>

      {mode === "balloon" && question && (
        <div className="grid min-h-64 grid-cols-2 gap-3 rounded-lg bg-sky/20 p-4 sm:grid-cols-4">
          {question.options.map((option, index) => (
            <Button key={`${round}-${index}`} variant="ghost" disabled={balloonPicked !== null || balloonExpired}
              className={`${COLORS[index] ?? "bg-leaf"} relative h-28 w-full whitespace-normal rounded-[50%] px-3 text-center text-base font-bold text-foreground shadow-md transition-transform hover:-translate-y-2 sm:h-36 ${balloonPicked === index ? "ring-4 ring-primary" : ""}`}
              onClick={() => {
                if (timer.current) clearTimeout(timer.current);
                setBalloonPicked(index);
                const right = index === question.answerIndex;
                sound.play(right ? "correct" : "wrong");
                const gained = right ? 50 + Math.round(Math.max(0, 1 - (Date.now() - startTime.current) / roundDuration) * 50) : 0;
                const updatedScore = score + gained;
                const remaining = right ? lives : lives - 1;
                setScore(updatedScore); setLives(remaining);
                setFeedback(right ? `Great pop! +${gained}` : question.explanation);
                advanceTimer.current = setTimeout(() => nextRound(updatedScore, remaining), 1100);
              }}>{option}</Button>
          ))}
        </div>
      )}

      {mode === "match" && current?.pairs && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-3">{current.pairs.map((pair, index) => (
            <Button key={index} variant={selected === pair.left ? "default" : "outline"} disabled={matched.includes(index)}
              className="h-16 w-full whitespace-normal px-2 text-center text-base" onClick={() => { sound.play("tap"); setSelected(pair.left); setFeedback(""); }}>
              {matched.includes(index) ? "✓ " : ""}{pair.left}
            </Button>
          ))}</div>
          <div className="space-y-3">{choices.map((answer, index) => (
            <Button key={index} variant="secondary" disabled={matched.some((m) => current.pairs?.[m]?.right === answer)}
              className="h-16 w-full whitespace-normal px-2 text-center text-base" onClick={() => {
                if (!selected) { setFeedback("Choose a piece on the left first."); return; }
                const pairIndex = current.pairs?.findIndex((p) => p.left === selected) ?? -1;
                const right = current.pairs?.[pairIndex]?.right === answer;
                sound.play(right ? "correct" : "wrong");
                const updatedMistakes = mistakes + (right ? 0 : 1);
                setMistakes(updatedMistakes); setSelected(null);
                if (!right) { setFeedback("Try another match!"); return; }
                const updatedMatched = [...matched, pairIndex];
                setMatched(updatedMatched); setFeedback("Nice match!");
                if (updatedMatched.length === 4) {
                  const updatedScore = score + Math.max(40, 100 - updatedMistakes * 15);
                  setScore(updatedScore);
                  advanceTimer.current = setTimeout(() => nextRound(updatedScore), 900);
                }
              }}>{matched.some((m) => current.pairs?.[m]?.right === answer) ? "✓ " : ""}{answer}</Button>
          ))}</div>
        </div>
      )}

      {mode === "sequence" && current?.items && (
        <div className="space-y-4">
          <div className="flex min-h-16 flex-wrap items-center gap-2 rounded-lg border-2 border-dashed border-primary p-3" aria-label="Your order">
            {current.items.slice(0, step).map((item, index) => <span key={index} className="rounded-md bg-primary px-3 py-2 font-bold text-primary-foreground">{index + 1}. {item}</span>)}
            {step === 0 && <span className="text-muted-foreground">Your order…</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">{choices.map((item, index) => (
            <Button key={index} variant="secondary" disabled={(current.items?.indexOf(item) ?? -1) < step}
              className="h-20 w-full whitespace-normal px-2 text-center text-base" onClick={() => {
                if (item !== current.items?.[step]) { sound.play("wrong"); setMistakes((n) => n + 1); setFeedback("Not yet — try another piece!"); return; }
                sound.play("correct");
                setStep(step + 1); setFeedback("That's right!");
                if (step + 1 === 4) {
                  const updatedScore = score + Math.max(40, 100 - mistakes * 15);
                  setScore(updatedScore);
                  advanceTimer.current = setTimeout(() => nextRound(updatedScore), 900);
                }
              }}>{item}</Button>
          ))}</div>
        </div>
      )}
      <p className="min-h-7 text-center font-semibold text-primary" aria-live="polite">{feedback}</p>
    </div>
  );
}