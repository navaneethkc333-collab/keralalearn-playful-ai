import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Heart, Volume2, VolumeX, Sparkles, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateTopicGame } from "@/lib/ai.functions";
import { normalizeAnswer, type GeneratedTopicGame, type GameMode } from "@/lib/topic-game";
import { GameCharacter } from "@/components/GameCharacter";
import { useGameSound } from "@/hooks/useGameSound";
import { awardPoints, useGames } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { speak } from "@/components/SpeakButton";

type Difficulty = "easy" | "medium" | "hard";
type Sound = ReturnType<typeof useGameSound>;
type Finish = (score: number, max: number) => void;

export function TopicGame({ classLevel, subject, subjectName, topic, language, userId }: {
  classLevel: number; subject: string; subjectName: string; topic: string; language: "en" | "ml"; userId: string;
}) {
  const { data: games = [] } = useGames();
  const qc = useQueryClient();
  const gameFn = useServerFn(generateTopicGame);
  const sound = useGameSound();
  const [generation, setGeneration] = useState(0);
  const [lastMode, setLastMode] = useState<GameMode | undefined>();
  const [result, setResult] = useState<{ score: number; max: number } | null>(null);
  const previous = games.find((g) => g.subject === subject && g.topic === topic);
  const ratio = previous ? previous.score / previous.max_score : 0;
  const difficulty: Difficulty = previous
    ? ((["easy", "medium", "hard"] as Difficulty[])[Math.max(0, Math.min(2, ["easy", "medium", "hard"].indexOf(previous.difficulty) + (ratio >= 0.7 ? 1 : ratio < 0.4 ? -1 : 0)))] ?? "easy")
    : "easy";

  const load = useQuery({
    queryKey: ["topic-game", userId, classLevel, subject, topic, language, generation],
    queryFn: () => gameFn({ data: { classLevel, subject: subjectName, topic, language, difficulty, previousMode: lastMode } }),
    retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const game = load.data;
  useEffect(() => { if (game) { setLastMode(game.mode); setResult(null); } }, [game]);

  const save = useMutation({
    mutationFn: async ({ finalScore, maxScore }: { finalScore: number; maxScore: number }) => {
      const { error } = await supabase.from("game_results").insert({ user_id: userId, subject, topic, difficulty, score: finalScore, max_score: maxScore });
      if (error) throw error;
      await awardPoints(userId, Math.round(finalScore / 20));
      await Promise.all([qc.invalidateQueries({ queryKey: ["games"] }), qc.invalidateQueries({ queryKey: ["profile"] })]);
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const finish: Finish = (score, max) => { sound.play("finish"); setResult({ score, max }); save.mutate({ finalScore: score, maxScore: max }); };

  if (load.isPending) return (
    <div className="mx-auto max-w-2xl py-8 text-center">
      <Sparkles className="mx-auto h-14 w-14 animate-pulse text-primary motion-reduce:animate-none" />
      <h2 className="mt-3 text-2xl font-bold" role="status">AI is generating your game…</h2>
      <p className="mt-3 text-lg text-muted-foreground">{topic} · {difficulty} level</p>
      <div className="mt-5 flex justify-center gap-4 text-3xl" aria-hidden="true">🎨 🧩 🎵</div>
    </div>
  );
  if (load.isError || !game) return <div className="py-8 text-center"><p role="alert" className="text-destructive">{load.error?.message ?? "Could not make the game."}</p><Button className="mt-4" onClick={() => void load.refetch()}>Try again</Button></div>;

  if (result) return (
    <div className="mx-auto max-w-2xl py-8 text-center">
      <div className="flex justify-center"><GameCharacter character={game.character} happy /></div>
      <h2 className="mt-3 text-3xl font-bold">{game.title} · {result.score}/{result.max}</h2>
      <p className="mt-2 text-muted-foreground">+{Math.round(result.score / 20)} stars</p>
      <Button className="mt-6 rounded-full" onClick={() => setGeneration((v) => v + 1)}>Generate another game</Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3 border-b pb-4">
        <GameCharacter character={game.character} />
        <div className="min-w-0 flex-1"><h2 className="break-words text-xl font-bold sm:text-2xl">{game.title}</h2><p className="mt-1 font-semibold text-primary">{game.character.name}</p><p className="mt-1 break-words text-sm">{game.character.greeting}</p></div>
        <Button variant="outline" size="icon" className="shrink-0" aria-label={sound.enabled ? "Mute game sound" : "Enable game sound"} aria-pressed={sound.enabled} onClick={() => { sound.setEnabled(!sound.enabled); if (sound.enabled) window.speechSynthesis?.cancel(); }}>{sound.enabled ? <Volume2 /> : <VolumeX />}</Button>
      </div>
      {game.mode === "alphabet" && <AlphabetGame key={generation} game={game} sound={sound} language={language} onFinish={finish} />}
      {game.mode === "froggy" && <FroggyGame key={generation} game={game} sound={sound} language={language} onFinish={finish} />}
      {game.mode === "aster" && <AsterGame key={generation} game={game} sound={sound} language={language} difficulty={difficulty} onFinish={finish} />}
    </div>
  );
}

type Props = { game: GeneratedTopicGame; sound: Sound; language: "en" | "ml"; onFinish: Finish };

function Prompt({ text, language }: { text: string; language: "en" | "ml" }) {
  return (
    <div className="rounded-lg border-b-4 border-primary bg-card p-4 text-center shadow-sm">
      <p className="text-lg font-bold sm:text-xl">{text}</p>
      <Button variant="ghost" size="sm" className="mt-1" onClick={() => speak(text, language)} aria-label="Listen to question"><Volume2 /> Listen</Button>
    </div>
  );
}

function AlphabetGame({ game, sound, language, onFinish }: Props) {
  const words = game.words;
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<("right" | "wrong" | undefined)[]>([]);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState("");
  const current = words[index];
  const score = status.filter((s) => s === "right").length * 100;

  function advance(right: boolean) {
    const next = [...status]; next[index] = right ? "right" : "wrong"; setStatus(next);
    sound.play(right ? "correct" : "wrong");
    setFeedback(right ? "Correct!" : `It was "${current?.answer}"`);
    setValue("");
    const updated = next.filter((s) => s === "right").length * 100;
    setTimeout(() => { setFeedback(""); if (index + 1 >= words.length) onFinish(updated, words.length * 100); else setIndex(index + 1); }, 1100);
  }
  if (!current) return null;
  return (
    <div className="space-y-4">
      <Prompt text={current.clue} language={language} />
      <div className="relative mx-auto aspect-square w-full max-w-md rounded-full bg-muted">
        {words.map((w, i) => {
          const angle = (i / words.length) * Math.PI * 2 - Math.PI / 2;
          const s = status[i];
          return (
            <span key={i} style={{ left: `${50 + 42 * Math.cos(angle)}%`, top: `${50 + 42 * Math.sin(angle)}%` }}
              className={`absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-lg font-bold shadow-sm sm:h-14 sm:w-14 ${s === "right" ? "bg-primary text-primary-foreground" : s === "wrong" ? "bg-destructive text-destructive-foreground" : i === index ? "game-pulse border-primary bg-secondary" : "bg-card"}`}>
              {w.letter}
            </span>
          );
        })}
        <form className="absolute inset-[22%] flex flex-col items-center justify-center gap-2 text-center" onSubmit={(e) => { e.preventDefault(); if (value.trim()) advance(normalizeAnswer(value) === normalizeAnswer(current.answer)); }}>
          <p className="font-semibold">Starts with <b className="text-xl">{current.letter}</b></p>
          <Input value={value} onChange={(e) => setValue(e.target.value)} aria-label="Your answer" className="h-12 text-center text-lg" autoFocus disabled={!!feedback} />
          <div className="flex gap-2">
            <Button type="submit" className="rounded-full" disabled={!!feedback || !value.trim()}>Check</Button>
            <Button type="button" variant="secondary" className="rounded-full" disabled={!!feedback} onClick={() => advance(false)}><SkipForward /> Skip</Button>
          </div>
        </form>
      </div>
      <p className="min-h-7 text-center font-bold text-primary" aria-live="polite">{feedback} <span className="text-foreground">⭐ {score} · {index + 1}/{words.length}</span></p>
    </div>
  );
}

const PAD_X = [20, 50, 80];

function FroggyGame({ game, sound, language, onFinish }: Props) {
  const qs = game.questions;
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [jump, setJump] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const q = qs[index];
  if (!q) return null;
  const right = jump !== null && jump === q.answerIndex;

  function pick(i: number) {
    if (jump !== null || !q) return;
    setJump(i);
    const ok = i === q.answerIndex;
    sound.play(ok ? "correct" : "wrong");
    const newScore = score + (ok ? 100 : 0); const newLives = ok ? lives : lives - 1;
    setScore(newScore); setLives(newLives);
    setFeedback(ok ? "Great jump!" : `Splash! ${q.explanation}`);
    setTimeout(() => {
      setJump(null); setFeedback("");
      if (newLives <= 0 || index + 1 >= qs.length) onFinish(newScore, qs.length * 100); else setIndex(index + 1);
    }, ok ? 1100 : 2200);
  }
  return (
    <div className="space-y-3">
      <Prompt text={q.question} language={language} />
      <div className="flex justify-between font-bold"><span className="flex gap-1" aria-label={`${lives} lives left`}>{[0, 1, 2].map((k) => <Heart key={k} className={`h-5 w-5 ${k < lives ? "fill-coral text-coral" : "text-muted"}`} />)}</span><span>🪷 {index + 1}/{qs.length}</span><span>⭐ {score}</span></div>
      <div className="relative h-96 overflow-hidden rounded-lg bg-sky">
        {[15, 45, 75].map((x, k) => <span key={k} className="game-bob absolute h-16 w-24 rounded-full bg-card/30" style={{ left: `${x}%`, top: `${20 + k * 25}%`, animationDelay: `${k * 0.7}s` }} />)}
        {q.options.map((option, i) => (
          <button key={`${index}-${i}`} onClick={() => pick(i)} disabled={jump !== null}
            className={`game-bob absolute top-10 flex h-28 w-28 -translate-x-1/2 items-center justify-center rounded-full border-4 border-foreground/30 bg-leaf p-2 text-center text-base font-bold text-foreground shadow-lg transition-transform hover:scale-110 sm:h-32 sm:w-32 sm:text-lg ${jump === i && !right ? "game-shake bg-destructive" : ""}`}
            style={{ left: `${PAD_X[i]}%`, animationDelay: `${i * 0.4}s` }}>
            <span className="absolute -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">{"ABC"[i]}</span>
            {option}
          </button>
        ))}
        <div className="absolute bottom-2 flex h-28 w-28 -translate-x-1/2 items-center justify-center rounded-full bg-leaf/80 transition-all duration-700 ease-out sm:h-32 sm:w-32"
          style={{ left: `${jump === null ? 50 : PAD_X[jump]}%`, bottom: jump === null ? "0.5rem" : "15rem" }}>
          <div className="scale-75"><GameCharacter character={game.character} happy={right} /></div>
        </div>
      </div>
      <p className="min-h-7 text-center font-semibold text-primary" aria-live="polite">{feedback}</p>
    </div>
  );
}

const STARS = Array.from({ length: 24 }, (_, i) => ({ left: (i * 37) % 100, delay: (i * 0.37) % 3, dur: 1.5 + ((i * 7) % 10) / 5 }));

function AsterGame({ game, sound, language, difficulty, onFinish }: Props & { difficulty: Difficulty }) {
  const qs = game.questions;
  const [index, setIndex] = useState(0);
  const [ships, setShips] = useState(5);
  const [score, setScore] = useState(0);
  const [lane, setLane] = useState(1);
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const duration = difficulty === "easy" ? 14 : difficulty === "medium" ? 11 : 8;
  const q = qs[index];
  if (!q) return null;

  function resolve(i: number | null) {
    if (picked !== null || !q) return;
    if (i !== null) setLane(i);
    setPicked(i ?? -1);
    const ok = i === q.answerIndex;
    sound.play(ok ? "correct" : "wrong");
    const newShips = Math.max(0, ships + (ok ? 2 : -2)); const newScore = score + (ok ? 100 : 0);
    setShips(newShips); setScore(newScore);
    setFeedback(ok ? "Correct! +2 ships" : i === null ? `Too slow! −2 · ${q.explanation}` : `Wrong! −2 · ${q.explanation}`);
    setTimeout(() => {
      setPicked(null); setFeedback("");
      if (newShips <= 0 || index + 1 >= qs.length) onFinish(newScore, qs.length * 100); else setIndex(index + 1);
    }, ok ? 1100 : 2200);
  }
  return (
    <div className="space-y-3">
      <Prompt text={q.question} language={language} />
      <div className="relative h-96 overflow-hidden rounded-lg bg-foreground text-background">
        {STARS.map((s, k) => <span key={k} className="game-star absolute top-0 h-3 w-0.5 rounded bg-background/60" style={{ left: `${s.left}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }} />)}
        <div className="absolute left-3 top-3 z-10 rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">🚀 {ships} · ⭐ {score} · {index + 1}/{qs.length}</div>
        <div key={index} className="game-drop absolute inset-x-0 top-12 grid grid-cols-3 gap-2 px-2" style={{ animationDuration: `${duration}s` }} onAnimationEnd={() => resolve(null)}>
          {q.options.map((option, i) => (
            <button key={i} onClick={() => resolve(i)} onMouseEnter={() => picked === null && setLane(i)} disabled={picked !== null}
              className={`flex h-24 items-center justify-center rounded-lg border-4 p-2 text-center text-base font-bold shadow-lg transition-colors sm:text-xl ${picked === null ? "border-primary bg-card text-foreground hover:bg-secondary" : i === q.answerIndex ? "border-primary bg-primary text-primary-foreground" : picked === i ? "border-destructive bg-destructive text-destructive-foreground" : "bg-card/50 text-foreground"}`}>
              {option}
            </button>
          ))}
        </div>
        <div className="absolute bottom-3 -translate-x-1/2 text-5xl transition-all duration-300" style={{ left: `${16.6 + lane * 33.3}%` }} aria-hidden="true">
          <span className={picked !== null && picked !== q.answerIndex ? "inline-block game-shake" : "inline-block"}>🚀</span>
        </div>
        {feedback && <p className="absolute inset-x-4 bottom-20 z-10 rounded-lg bg-card p-2 text-center font-bold text-foreground" aria-live="polite">{feedback}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:hidden">{["◀", "Fire", "▶"].map((label, k) => (
        <Button key={k} variant="secondary" disabled={picked !== null} onClick={() => k === 1 ? resolve(lane) : setLane((l) => Math.max(0, Math.min(2, l + (k === 0 ? -1 : 1))))}>{label}</Button>
      ))}</div>
    </div>
  );
}
