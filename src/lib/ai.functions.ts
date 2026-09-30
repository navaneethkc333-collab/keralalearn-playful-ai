import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GEMINI_MODEL = "gemini-2.5-flash";

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function callGemini(prompt: string | Part[], json: boolean): Promise<string> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("The AI key is not set up yet.");
  const parts = typeof prompt === "string" ? [{ text: prompt }] : prompt;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: json ? { responseMimeType: "application/json", temperature: 0.9 } : { temperature: 0.7 },
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

async function geminiJson<T>(prompt: string | Part[]): Promise<T> {
  const raw = await callGemini(prompt, true);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("The AI teacher's answer was muddled. Please try again.");
  }
}

const langName = (l: "en" | "ml") => (l === "ml" ? "Malayalam" : "simple English");

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
    return geminiJson<{
      title: string;
      intro: string;
      points: { heading: string; text: string; emoji: string }[];
      example: string;
      funFact: string;
    }>(prompt);
  });

export type QuizQuestion = { question: string; options: string[]; answerIndex: number; explanation: string };

const validQ = (q: QuizQuestion) =>
  q && typeof q.question === "string" && Array.isArray(q.options) && q.options.length === 4 && q.answerIndex >= 0 && q.answerIndex < 4;

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    base.extend({ difficulty: z.enum(["easy", "medium", "hard"]), count: z.number().int().min(3).max(10).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const n = data.count ?? 5;
    const prompt = `Create a ${data.difficulty} quiz of ${n} multiple-choice questions for a Class ${data.classLevel} student in Kerala (Kerala State syllabus)
on "${data.topic}" (${data.subject}). Write in ${langName(data.language)}. Each question has exactly 4 SHORT options (max 4 words) with one correct answer. Vary the position of the correct answer. Random seed: ${Math.random()}.
Return JSON: {"questions": [{"question": string, "options": [string,string,string,string], "answerIndex": number (0-3), "explanation": string (one kind short sentence)}]}.`;
    const parsed = await geminiJson<{ questions: QuizQuestion[] }>(prompt);
    const questions = (parsed.questions ?? []).filter(validQ).slice(0, n);
    if (questions.length === 0) throw new Error("Could not make a quiz. Please try again.");
    return { questions };
  });

export const getFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    base.extend({ score: z.number().int(), total: z.number().int(), mistakes: z.array(z.string().max(300)).max(5) }).parse(d),
  )
  .handler(async ({ data }) => {
    const prompt = `A Class ${data.classLevel} child scored ${data.score}/${data.total} on "${data.topic}" (${data.subject}).
Questions they got wrong: ${data.mistakes.join(" | ") || "none"}.
In ${langName(data.language)}, write 2-3 short, encouraging sentences: praise effort, and give one simple tip to improve. No markdown.`;
    return { feedback: (await callGemini(prompt, false)).trim() };
  });

/* ---------------- Skill Development ---------------- */

const activityEnum = z.enum(["drawing", "story", "poem", "maths", "english", "malayalam"]);
export type Activity = z.infer<typeof activityEnum>;

export const getSkillPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ activity: activityEnum, classLevel: z.number().int().min(1).max(4), language: z.enum(["en", "ml"]) }).parse(d))
  .handler(async ({ data }) => {
    const kind = {
      drawing: "a simple, fun drawing idea a child can draw with a pencil (e.g. a boat on the backwaters)",
      story: "a story-writing prompt with a character and a situation",
      poem: "a poem-writing prompt about nature, family, festivals or animals of Kerala",
    } as Record<string, string>;
    const prompt = `Give ${kind[data.activity]} for a Class ${data.classLevel} child in Kerala. Write in ${langName(data.language)}. Seed ${Math.random()}.
Return JSON: {"prompt": string (one or two short sentences), "tips": [string, string]}.`;
    return geminiJson<{ prompt: string; tips: string[] }>(prompt);
  });

export type SkillEval = { score: number; feedback: string; strengths: string[]; improvements: string[]; grammar: string[] };

export const evaluateSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        activity: z.enum(["drawing", "story", "poem"]),
        classLevel: z.number().int().min(1).max(4),
        language: z.enum(["en", "ml"]),
        prompt: z.string().max(600),
        text: z.string().max(6000).optional(),
        imageBase64: z.string().max(3_000_000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const criteria = {
      drawing: "effort, relevance to the prompt, creativity and detail (be generous: it's a child's mouse/finger drawing)",
      story: "creativity, relevance, sentence structure, grammar and completeness",
      poem: "creativity, relevance, vocabulary and completeness",
    }[data.activity];
    const instr = `You are a kind teacher evaluating a Class ${data.classLevel} child's ${data.activity} in Kerala.
Prompt given: "${data.prompt}". Judge on ${criteria}. Reply in ${langName(data.language)}.
Return JSON: {"score": integer 0-100, "feedback": string (2 encouraging sentences), "strengths": [string], "improvements": [string] (1-3 simple tips), "grammar": [string] (grammar/spelling suggestions, empty for drawing)}.`;
    if (data.activity === "drawing") {
      if (!data.imageBase64) throw new Error("Please draw something first.");
      return geminiJson<SkillEval>([{ text: instr }, { inline_data: { mime_type: "image/png", data: data.imageBase64 } }]);
    }
    if (!data.text?.trim()) throw new Error("Please write something first.");
    return geminiJson<SkillEval>(`${instr}\n\nChild's writing:\n"""${data.text}"""`);
  });

export type PracticeQ = { question: string; answer: string };

export const getPracticeSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ subject: z.enum(["maths", "english", "malayalam"]), classLevel: z.number().int().min(1).max(4), language: z.enum(["en", "ml"]) }).parse(d))
  .handler(async ({ data }) => {
    const subj = { maths: "Mathematics (mental maths, word problems)", english: "English (spelling, grammar, vocabulary)", malayalam: "Malayalam (അക്ഷരങ്ങൾ, വാക്കുകൾ, വാക്യങ്ങൾ)" }[data.subject];
    const lang = data.subject === "malayalam" ? "Malayalam" : data.subject === "english" ? "English" : langName(data.language);
    const prompt = `Create 5 short-answer practice questions in ${subj} for a Class ${data.classLevel} student (Kerala State syllabus). Write in ${lang}. Answers must be one word or a number. Seed ${Math.random()}.
Return JSON: {"questions": [{"question": string, "answer": string}]}.`;
    const r = await geminiJson<{ questions: PracticeQ[] }>(prompt);
    const questions = (r.questions ?? []).filter((q) => q?.question && q?.answer).slice(0, 5);
    if (!questions.length) throw new Error("Could not make activities. Please try again.");
    return { questions };
  });

export const evaluatePractice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subject: z.string().max(20),
        classLevel: z.number().int().min(1).max(4),
        language: z.enum(["en", "ml"]),
        items: z.array(z.object({ question: z.string().max(500), answer: z.string().max(200), given: z.string().max(300) })).min(1).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const prompt = `Check a Class ${data.classLevel} child's answers in ${data.subject}. Accept answers that are correct in meaning, ignoring small spelling slips and case.
Items: ${JSON.stringify(data.items)}
Reply in ${langName(data.language)}. Return JSON: {"results": [{"correct": boolean, "note": string (short)}], "improvements": [string] (1-3 tips), "feedback": string}.`;
    const r = await geminiJson<{ results: { correct: boolean; note: string }[]; improvements: string[]; feedback: string }>(prompt);
    const results = data.items.map((_, i) => ({ correct: !!r.results?.[i]?.correct, note: r.results?.[i]?.note ?? "" }));
    const score = Math.round((results.filter((x) => x.correct).length / data.items.length) * 100);
    return { results, score, improvements: r.improvements ?? [], feedback: r.feedback ?? "" };
  });

/* ---------------- Assessment ---------------- */

export type AssessQ = QuizQuestion & { subject: string; topic: string };

export const generateAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ classLevel: z.number().int().min(1).max(4), language: z.enum(["en", "ml"]), topics: z.record(z.string(), z.array(z.string().max(120)).max(10)) }).parse(d),
  )
  .handler(async ({ data }) => {
    const prompt = `Create a fresh assessment for a Class ${data.classLevel} student following the Kerala State syllabus.
Include exactly 3 multiple-choice questions for EACH subject: maths, english, malayalam, evs (12 total). Pick topics from: ${JSON.stringify(data.topics)}.
Malayalam questions in Malayalam; English questions in English; maths and evs in ${langName(data.language)}. Class-appropriate difficulty. 4 short options, one correct, varied positions. Seed ${Math.random()}.
Return JSON: {"questions": [{"subject": "maths"|"english"|"malayalam"|"evs", "topic": string (one of the given topics), "question": string, "options": [4 strings], "answerIndex": 0-3, "explanation": string}]}.`;
    const r = await geminiJson<{ questions: AssessQ[] }>(prompt);
    const questions = (r.questions ?? []).filter((q) => validQ(q) && ["maths", "english", "malayalam", "evs"].includes(q.subject));
    if (questions.length < 4) throw new Error("Could not make the assessment. Please try again.");
    return { questions };
  });

export const assessmentSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classLevel: z.number().int().min(1).max(4),
        language: z.enum(["en", "ml"]),
        subjectScores: z.record(z.string(), z.object({ obtained: z.number(), total: z.number() })),
        wrong: z.array(z.object({ subject: z.string().max(20), topic: z.string().max(120), question: z.string().max(500) })).max(12),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const prompt = `A Class ${data.classLevel} child took an assessment. Subject scores: ${JSON.stringify(data.subjectScores)}. Wrong answers: ${JSON.stringify(data.wrong)}.
Reply in ${langName(data.language)}. Return JSON: {"feedback": string (2 kind sentences), "improvements": [string] (2-4 simple areas), "recommended": [{"subject": string, "topic": string}] (topics from the wrong answers, max 4)}.`;
    return geminiJson<{ feedback: string; improvements: string[]; recommended: { subject: string; topic: string }[] }>(prompt);
  });
