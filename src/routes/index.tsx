import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SUBJECTS } from "@/lib/syllabus";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vidya Kalari — AI Learning for Classes 1–4 (Kerala Syllabus)" },
      { name: "description", content: "Adaptive AI lessons, quizzes and rewards for Kerala primary students in English and Malayalam." },
      { property: "og:title", content: "Vidya Kalari — AI Learning for Classes 1–4" },
      { property: "og:description", content: "Adaptive AI lessons, quizzes and rewards for Kerala primary students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-5xl">🌴📚🐘</p>
        <h1 className="mt-6 text-4xl font-bold sm:text-6xl">
          Learn, play and grow with <span className="text-primary">Vidya Kalari</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          A friendly AI teacher for Classes 1 to 4, following the Kerala State syllabus. Lessons and quizzes change to match how you learn — in English or Malayalam.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg" className="rounded-full text-lg">
            <Link to="/auth" search={{ mode: "signup" }}>Start learning</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full text-lg">
            <Link to="/auth" search={{ mode: "login" }}>I have an account</Link>
          </Button>
        </div>
        <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4">
          {SUBJECTS.map((s) => (
            <div key={s.id} className={`${s.color} rounded-3xl p-6 shadow-sm`}>
              <div className="text-4xl">{s.emoji}</div>
              <div className="mt-2 font-display text-lg font-semibold text-foreground">{s.name}</div>
              <div className="text-sm text-foreground/80">{s.ml}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
