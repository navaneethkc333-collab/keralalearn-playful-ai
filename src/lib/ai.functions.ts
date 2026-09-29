import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GEMINI_MODEL = "gemini-2.5-flash";

async function callGemini(prompt: string, json: boolean): Promise<string> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("The AI key is not set up yet.");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: json ? { responseMimeType: "application/json", temperature: 0.8 } : { temperature: 0.7 },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    console.error("Gemini error", res.status, body);
    if (res.status === 429) throw new Error("The AI teacher is busy. Please try again in a minute.");
    throw new Error("The AI teacher could not answer right now.");
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("The AI teacher gave an empty answer.");
  return text;
}

const base = z.object({
  classLevel: z.number().int().min(1).max(4),
  subject: z.string().min(1).max(40),
  topic: z.string().min(1).max(120),
  language: z.enum(["en", "ml"]),
});

export const getLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => base.parse(d))
  .handler(async ({ data }) => {
    const lang = data.language === "ml" ? "Malayalam (with simple English words where helpful)" : "simple English";
    const prompt = `You are a warm, friendly primary school teacher in Kerala, India, following the Kerala State (SCERT) syllabus.
Explain the topic "${data.topic}" from ${data.subject} for a Class ${data.classLevel} child (age ${data.classLevel + 5}).
Write in ${lang}. Use very short sentences, fun examples from Kerala life (coconut trees, boats, Onam, rain, elephants).
Return JSON: {"title": string, "intro": string, "points": [{"heading": string, "text": string, "emoji": string}] (3-5 items), "example": string, "funFact": string}.`;
    const raw = await callGemini(prompt, true);
    return JSON.parse(raw) as {
      title: string;
      intro: string;
      points: { heading: string; text: string; emoji: string }[];
      example: string;
      funFact: string;
    };
  });

export type QuizQuestion = { question: string; options: string[]; answerIndex: number; explanation: string };

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => base.extend({ difficulty: z.enum(["easy", "medium", "hard"]) }).parse(d))
  .handler(async ({ data }) => {
    const lang = data.language === "ml" ? "Malayalam" : "simple English";
    const prompt = `Create a ${data.difficulty} quiz of 5 multiple-choice questions for a Class ${data.classLevel} student in Kerala (Kerala State syllabus)
on "${data.topic}" (${data.subject}). Write in ${lang}. Each question has exactly 4 short options with one correct answer. Vary the position of the correct answer.
Return JSON: {"questions": [{"question": string, "options": [string,string,string,string], "answerIndex": number (0-3), "explanation": string (one kind short sentence)}]}.`;
    const raw = await callGemini(prompt, true);
    const parsed = JSON.parse(raw) as { questions: QuizQuestion[] };
    const questions = (parsed.questions ?? [])
      .filter((q) => Array.isArray(q.options) && q.options.length === 4 && q.answerIndex >= 0 && q.answerIndex < 4)
      .slice(0, 5);
    if (questions.length === 0) throw new Error("Could not make a quiz. Please try again.");
    return { questions };
  });

export const getFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    base.extend({ score: z.number().int(), total: z.number().int(), mistakes: z.array(z.string().max(300)).max(5) }).parse(d),
  )
  .handler(async ({ data }) => {
    const lang = data.language === "ml" ? "Malayalam" : "simple English";
    const prompt = `A Class ${data.classLevel} child scored ${data.score}/${data.total} on "${data.topic}" (${data.subject}).
Questions they got wrong: ${data.mistakes.join(" | ") || "none"}.
In ${lang}, write 2-3 short, encouraging sentences: praise effort, and give one simple tip to improve. No markdown.`;
    return { feedback: (await callGemini(prompt, false)).trim() };
  });
