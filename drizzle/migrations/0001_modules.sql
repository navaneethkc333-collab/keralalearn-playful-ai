CREATE TABLE public.topic_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  topic text NOT NULL,
  class_level int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject, topic)
);
GRANT SELECT, INSERT, DELETE ON public.topic_completions TO authenticated;
GRANT ALL ON public.topic_completions TO service_role;
ALTER TABLE public.topic_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tc select" ON public.topic_completions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own tc insert" ON public.topic_completions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tc delete" ON public.topic_completions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  topic text NOT NULL,
  difficulty text NOT NULL,
  score int NOT NULL,
  max_score int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.game_results TO authenticated;
GRANT ALL ON public.game_results TO service_role;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gr select" ON public.game_results FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own gr insert" ON public.game_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.skill_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity text NOT NULL,
  prompt text NOT NULL DEFAULT '',
  response text NOT NULL DEFAULT '',
  score int NOT NULL,
  feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.skill_results TO authenticated;
GRANT ALL ON public.skill_results TO service_role;
ALTER TABLE public.skill_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sr select" ON public.skill_results FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sr insert" ON public.skill_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  class_level int NOT NULL,
  total int NOT NULL,
  obtained int NOT NULL,
  subject_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.assessment_results TO authenticated;
GRANT ALL ON public.assessment_results TO service_role;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ar select" ON public.assessment_results FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own ar insert" ON public.assessment_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ar update" ON public.assessment_results FOR UPDATE TO authenticated USING (auth.uid() = user_id);