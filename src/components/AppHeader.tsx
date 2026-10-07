import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Star, Flame, BookOpen, Palette, ClipboardCheck, BarChart3, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useProfile, levelFromPoints } from "@/hooks/useProfile";

const NAV = [
  { to: "/learning", label: "Subject Learning", short: "Learn", icon: BookOpen },
  { to: "/skills", label: "Skill Development", short: "Skills", icon: Palette },
  { to: "/assessment", label: "Assessment", short: "Test", icon: ClipboardCheck },
  { to: "/progress", label: "Progress", short: "Progress", icon: BarChart3 },
] as const;

export function AppHeader() {
  const { data: p } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (
    <>
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link to="/learning" className="shrink-0 font-display text-xl font-semibold text-primary">
            🌴 Vidya Kalari
          </Link>
          <nav className="ml-4 hidden items-center gap-1 text-sm font-semibold md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-primary/10 !text-primary" }}
              >
                <n.icon className="h-4 w-4" />
                <span className="hidden lg:inline">{n.label}</span>
                <span className="lg:hidden">{n.short}</span>
              </Link>
            ))}
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
                <span className="hidden rounded-full bg-primary px-3 py-1 text-primary-foreground xl:inline">
                  Level {levelFromPoints(p.points)}
                </span>
              </>
            )}
            <Button variant="ghost" size="icon" aria-label="Settings" asChild>
              <Link to="/settings" activeProps={{ className: "bg-primary/10 text-primary" }}><Settings className="h-4 w-4" /></Link>
            </Button>
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
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-card md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="flex flex-col items-center gap-0.5 py-2 text-xs font-semibold text-muted-foreground"
            activeProps={{ className: "!text-primary bg-primary/10" }}
          >
            <n.icon className="h-5 w-5" />
            {n.short}
          </Link>
        ))}
      </nav>
    </>
  );
}
