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
export const questionSchema = z.object({
  question: z.string().min(3).max(240),
  options: z.array(z.string().min(1).max(60)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1).max(240),
}).refine((q) => new Set(q.options).size === 4, "Answers must differ");
const roundSchema = z.object({
  prompt: z.string().min(3).max(240),
  pairs: z.array(z.object({ left: z.string().min(1).max(60), right: z.string().min(1).max(60) })).length(4).optional(),
  items: z.array(z.string().min(1).max(60)).length(4).optional(),
});
export const topicGameSchema = z.object({
  title: z.string().min(1).max(80),
  mode: z.enum(["balloon", "match", "sequence"]),
  character: characterSchema,
  questions: z.array(questionSchema).max(6).default([]),
  rounds: z.array(roundSchema).max(3).default([]),
}).superRefine((game, ctx) => {
  const valid = game.mode === "balloon" ? game.questions.length === 6 : game.rounds.length === 3 && game.rounds.every((r) =>
    game.mode === "match" ? r.pairs?.length === 4 && new Set(r.pairs.map((p) => p.left)).size === 4 && new Set(r.pairs.map((p) => p.right)).size === 4
      : r.items?.length === 4 && new Set(r.items).size === 4);
  if (!valid) ctx.addIssue({ code: "custom", message: "Incomplete game" });
});
export type GameCharacter = z.infer<typeof characterSchema>;
export type GeneratedTopicGame = z.infer<typeof topicGameSchema>;