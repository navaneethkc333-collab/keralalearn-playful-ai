import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase.from("profiles").select("*").eq("id", u.user.id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useAttempts() {
  return useQuery({
    queryKey: ["attempts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quiz_attempts").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });
}

export function useCompletions() {
  return useQuery({
    queryKey: ["completions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("topic_completions").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useGames() {
  return useQuery({
    queryKey: ["games"],
    queryFn: async () => {
      const { data, error } = await supabase.from("game_results").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });
}

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("skill_results").select("id, activity, score, created_at").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });
}

export function useAssessments() {
  return useQuery({
    queryKey: ["assessments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assessment_results").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function levelFromPoints(points: number) {
  return Math.floor(points / 100) + 1;
}

/** Adds stars and updates the daily streak. */
export async function awardPoints(userId: string, stars: number) {
  const { data: prof } = await supabase.from("profiles").select("points, streak, last_active").eq("id", userId).single();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = prof?.last_active === today ? prof.streak : prof?.last_active === yesterday ? (prof?.streak ?? 0) + 1 : 1;
  await supabase.from("profiles").update({ points: (prof?.points ?? 0) + stars, streak, last_active: today }).eq("id", userId);
}
