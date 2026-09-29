import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function speak(text: string, lang: "en" | "ml") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "ml" ? "ml-IN" : "en-IN";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

export function SpeakButton({ text, lang }: { text: string; lang: "en" | "ml" }) {
  return (
    <Button type="button" variant="outline" size="icon" aria-label="Read aloud" onClick={() => speak(text, lang)}>
      <Volume2 className="h-4 w-4" />
    </Button>
  );
}
