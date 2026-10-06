import { z } from "zod";

export const characterSchema = z.object({
  name: z.string().min(1).max(40),
  body: z.enum(["round", "tall", "wide"]),
  ears: z.enum(["long", "round", "pointed", "none"]),
  accessory: z.enum(["crown", "bow", "antenna", "leaf"]),
  color: z.enum(["leaf", "sky", "coral", "sun"]),
  eyeSize: z.number().min(6).max(15),
  greeting: z.string().min(1).max(180),
});

export const gameModes = ["alphabet", "froggy", "aster"] as const;
export type GameMode = (typeof gameModes)[number];

export const normalizeAnswer = (s: string) => s.normalize("NFC").trim().toLowerCase().replace(/[.!?,'"]/g, "").replace(/\s+/g, " ");

const wordSchema = z.object({
  letter: z.string().min(1).max(3),
  clue: z.string().min(3).max(200),
  answer: z.string().min(1).max(30),
});
const choiceSchema = z.object({
  question: z.string().min(3).max(200),
  options: z.array(z.string().min(1).max(40)).length(3),
  answerIndex: z.number().int().min(0).max(2),
  explanation: z.string().min(1).max(200),
}).refine((q) => new Set(q.options.map(normalizeAnswer)).size === 3, "Answers must differ");

export const topicGameSchema = z.object({
  title: z.string().min(1).max(80),
  mode: z.enum(gameModes),
  character: characterSchema,
  words: z.array(wordSchema).max(10).default([]),
  questions: z.array(choiceSchema).max(8).default([]),
}).superRefine((game, ctx) => {
  const valid = game.mode === "alphabet"
    ? game.words.length >= 6 && new Set(game.words.map((w) => normalizeAnswer(w.letter))).size === game.words.length &&
      game.words.every((w) => normalizeAnswer(w.answer).startsWith(normalizeAnswer(w.letter)))
    : game.questions.length === 8;
  if (!valid) ctx.addIssue({ code: "custom", message: "Incomplete game" });
});

export type GameCharacter = z.infer<typeof characterSchema>;
export type GeneratedTopicGame = z.infer<typeof topicGameSchema>;
