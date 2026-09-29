import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Star, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useProfile, levelFromPoints } from "@/hooks/useProfile";

export function AppHeader() {
  const { data: p } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/dashboard" className="font-display text-xl font-semibold text-primary">
          🌴 Vidya Kalari
        </Link>
        <nav className="ml-4 hidden gap-4 text-sm font-semibold sm:flex">
          <Link to="/dashboard" activeProps={{ className: "text-primary" }}>Home</Link>
          <Link to="/progress" activeProps={{ className: "text-primary" }}>My Progress</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm font-bold">
          {p && (
            <>
              <span className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-accent-foreground">
                <Star className="h-4 w-4" /> {p.points}
              </span>
              <span className="hidden items-center gap-1 rounded-full bg-secondary px-3 py-1 sm:flex">
                <Flame className="h-4 w-4 text-coral" /> {p.streak}
              </span>
              <span className="hidden rounded-full bg-primary px-3 py-1 text-primary-foreground md:inline">
                Level {levelFromPoints(p.points)}
              </span>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Log out"
            onClick={async () => {
              await supabase.auth.signOut();
              qc.clear();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
